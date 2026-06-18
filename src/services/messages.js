const { trackContact } = require('./database');
const { checkAntiSpam } = require('./groups');
const { processCommand } = require('../commands/handler');
const { askGemini } = require('./ai');
const { addToMemory, getContext } = require('./memory');
const { getProfile, analyzeMessage } = require('./learning');
const { getSystemPrompt, randomDelay } = require('./personality');
const { triviaTimeout, answerTrivia } = require('./games');
const { extractUrls, scrapeLink } = require('./links');
const { saveDeletedMessage } = require('./antidelete');
const { checkRules } = require('./rules');

function extractText(msg) {
  return msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '';
}

function getJid(msg) {
  return msg.key.remoteJid;
}

function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isGroup(msg) {
  return getJid(msg).includes('@g.us');
}

function getBotJid(sock) {
  return sock.user?.id?.replace(/:.*$/, '') || '';
}

function getContactId(jid) {
  return jid.replace('@s.whatsapp.net', '');
}

function hasMedia(msg) {
  return !!msg.message?.audioMessage ||
    !!msg.message?.imageMessage ||
    !!msg.message?.videoMessage;
}

function isAudio(msg) {
  return !!msg.message?.audioMessage;
}

function isImage(msg) {
  return !!msg.message?.imageMessage;
}

async function downloadMedia(sock, msg) {
  try {
    return await sock.downloadMediaMessage(msg);
  } catch {
    return null;
  }
}

function isBotMentioned(msg, botJid) {
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  return mentions?.includes(botJid) || false;
}

function isReplyToBot(msg, botJid) {
  const replyTo = msg.message?.extendedTextMessage?.contextInfo?.participant;
  return replyTo === botJid;
}

function shouldReplyInGroup(msg, botJid) {
  if (isBotMentioned(msg, botJid)) return true;
  if (isReplyToBot(msg, botJid)) return true;
  const text = extractText(msg).trim().toLowerCase();
  if (!text) return false;
  const botShort = getContactId(botJid);
  if (text.startsWith(botShort)) return true;
  return false;
}

async function handleMessage(sock, msg) {
  const text = extractText(msg).trim();
  const jid = getJid(msg);
  const sender = getSender(msg);
  const contactId = getContactId(sender);
  const botJid = getBotJid(sock);
  const profile = getProfile(contactId) || {};

  trackContact(contactId);

  if (isGroup(msg)) {
    const isSpam = await checkAntiSpam(sock, msg, jid, sender);
    if (isSpam) return;

    if (!shouldReplyInGroup(msg, botJid)) {
      addToMemory(contactId, 'user', text);
      analyzeMessage(contactId, text, profile);
      return;
    }
  }

  if (isAudio(msg)) {
    await handleAudio(sock, msg, contactId, profile);
    return;
  }

  if (!text) return;

  analyzeMessage(contactId, text, profile);

  if (text.startsWith('!')) {
    addToMemory(contactId, 'user', text);
    await processCommand(sock, msg, text);
    return;
  }

  // Juegos, reglas y links se procesan sin guardar en memoria
  if (triviaTimeout(contactId) && text.length < 50) {
    const result = answerTrivia(contactId, text);
    if (result) {
      await sock.sendMessage(jid, { text: result }, { quoted: msg });
      return;
    }
  }

  const ruleResponse = checkRules(text, contactId);
  if (ruleResponse) {
    await new Promise(r => setTimeout(r, randomDelay()));
    await sock.sendMessage(jid, { text: ruleResponse }, { quoted: msg });
    return;
  }

  const urls = extractUrls(text);
  if (urls.length > 0) {
    const linkInfo = await scrapeLink(urls[0]);
    if (linkInfo) {
      await sock.sendMessage(jid, { text: linkInfo }, { quoted: msg });
      return;
    }
  }

  addToMemory(contactId, 'user', text);
  await aiReply(sock, msg, text, contactId, profile, false);
}

async function handleAudio(sock, msg, contactId, profile) {
  const jid = getJid(msg);
  const audioBuffer = await downloadMedia(sock, msg);
  if (!audioBuffer) return;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const opts = { isOwner: contactId === '573507927769', isGroup: isGroup(msg) };
    const systemPrompt = getSystemPrompt(profile, opts);
    const context = getContext(contactId, 4);

    const result = await model.generateContent([
      { text: `${systemPrompt}\n\n${context ? 'Historial:\n' + context + '\n\n' : ''}Te enviaron un audio. Escúchalo y responde de forma natural, como si fuera una conversación normal de WhatsApp. Responde directo al contenido sin mencionar que es un audio a menos que sea necesario.` },
      {
        inlineData: {
          mimeType: 'audio/ogg; codecs=opus',
          data: audioBuffer.toString('base64'),
        },
      },
    ]);

    let response = result.response.text().substring(0, 400);
    addToMemory(contactId, 'bot', response);

    await new Promise(r => setTimeout(r, randomDelay()));
    await sock.sendMessage(jid, { text: response }, { quoted: msg });
  } catch (err) {
    console.error('Error audio:', err.message);
  }
}

async function aiReply(sock, msg, body, contactId, profile, isCommand = false) {
  const jid = getJid(msg);
  const context = getContext(contactId, 4);
  const opts = { isOwner: contactId === '573507927769', isGroup: isGroup(msg) };
  const systemPrompt = getSystemPrompt(profile, opts);

  let prompt = `${systemPrompt}\n\n`;
  if (context) prompt += `Historial reciente:\n${context}\n\n`;
  prompt += `${profile.name || 'La persona'}: ${body}\n\nTu respuesta:`;

  const aiResponse = await askGemini(contactId, prompt, profile.tag || '');

  if (aiResponse) {
    addToMemory(contactId, 'bot', aiResponse);
    await new Promise(r => setTimeout(r, isCommand ? 500 : randomDelay()));
    await sock.sendMessage(jid, { text: aiResponse }, { quoted: msg });
    return;
  }

  await naturalFallback(sock, msg, body, contactId, profile);
}

async function naturalFallback(sock, msg, body, contactId, profile) {
  const jid = getJid(msg);
  const tag = profile?.tag || '';
  const starters = {
    novia: ['Ay mi amor', 'Pues mira', 'Mi vida', 'Corazón', 'Amor'],
    amigo: ['Pues parce', 'Bro', 'Pana', 'Oye', 'Sabes qué'],
    familia: ['Pues', 'Mire', 'Bueno', 'La verdad'],
  };
  const list = starters[tag] || ['Pues', 'Mira', 'Oye', 'La verdad', 'Es que'];
  const s = list[Math.floor(Math.random() * list.length)];

  const replies = [
    `${s} no sé qué decirte la verdad`,
    `${s} interesante lo que me cuentas`,
    'Pues sí, puede ser',
    'No sabía eso, qué loco',
    'Jaja pues sí',
    'Qué interesante, cuéntame más',
    'Mmm no sé, qué piensas tú?',
  ];

  await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
  await sock.sendMessage(jid, { text: replies[Math.floor(Math.random() * replies.length)] }, { quoted: msg });
}

async function handleGroupNotification(sock, notification) {
  if (notification.action === 'add') {
    const { handleGroupJoin } = require('./groups');
    await handleGroupJoin(sock, notification);
  }
}

async function restoreDeletedMessage(sock, key) {
  try {
    const chatId = key.remoteJid;
    if (!chatId || chatId === 'status@broadcast' || !chatId.includes('@g.us')) return;

    const msg = await sock.loadMessage(key.id);
    if (!msg) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const sender = key.participant || key.remoteJid;
    const shortId = sender.replace('@s.whatsapp.net', '');

    saveDeletedMessage(chatId, shortId, text);

    await sock.sendMessage(chatId, {
      text: `🚫 *@${shortId} eliminó un mensaje:*\n${text || '*multimedia*'}`,
      mentions: [sender],
    });
  } catch {}
}

module.exports = {
  handleMessage, handleGroupNotification, restoreDeletedMessage,
  getJid, getSender, isGroup, extractText, getContactId,
};
