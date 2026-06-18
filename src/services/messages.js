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
    const buffer = await sock.downloadMediaMessage(msg);
    return buffer;
  } catch {
    return null;
  }
}

async function handleMessage(sock, msg) {
  const text = extractText(msg).trim();
  const jid = getJid(msg);
  const sender = getSender(msg);
  const contactId = getContactId(sender);

  trackContact(contactId);

  if (isGroup(msg)) {
    const isSpam = await checkAntiSpam(sock, msg, jid, sender);
    if (isSpam) return;
  }

  const profile = getProfile(contactId) || {};

  // Audio messages - transcribe with Gemini
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

  addToMemory(contactId, 'user', text);

  // Trivia check
  if (triviaTimeout(contactId) && text.length < 50) {
    const result = answerTrivia(contactId, text);
    if (result) {
      await sock.sendMessage(jid, { text: result }, { quoted: msg });
      return;
    }
  }

  // Custom auto-rules
  const ruleResponse = checkRules(text, contactId);
  if (ruleResponse) {
    await new Promise(r => setTimeout(r, randomDelay()));
    await sock.sendMessage(jid, { text: ruleResponse }, { quoted: msg });
    return;
  }

  // Link detection
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const linkInfo = await scrapeLink(urls[0]);
    if (linkInfo) {
      await sock.sendMessage(jid, { text: linkInfo }, { quoted: msg });
      return;
    }
  }

  // AI natural response
  await aiReply(sock, msg, text, contactId, profile, false);
}

async function handleAudio(sock, msg, contactId, profile) {
  const jid = getJid(msg);
  const audioBuffer = await downloadMedia(sock, msg);
  if (!audioBuffer) {
    await sock.sendMessage(jid, { text: 'No pude procesar el audio' }, { quoted: msg });
    return;
  }

  try {
    // Send audio to Gemini for transcription + response
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const systemPrompt = getSystemPrompt(profile);
    const context = getContext(contactId, 4);

    const result = await model.generateContent([
      { text: `${systemPrompt}\n\n${context ? 'Historial:\n' + context + '\n\n' : ''}Este es un mensaje de voz. Escúchalo y responde como lo harías naturalmente en WhatsApp, como si fuera una conversación normal. No digas "escuché tu audio" a menos que sea natural. Responde directo al contenido del audio.` },
      {
        inlineData: {
          mimeType: 'audio/ogg; codecs=opus',
          data: audioBuffer.toString('base64'),
        },
      },
    ]);

    let response = result.response.text().substring(0, 400);
    addToMemory(contactId, 'bot', response);

    const delay = randomDelay();
    await new Promise(r => setTimeout(r, delay));
    await sock.sendMessage(jid, { text: response }, { quoted: msg });
  } catch (err) {
    console.error('Error procesando audio:', err.message);
    await sock.sendMessage(jid, { text: 'No entendí bien el audio, ¿puedes escribirme?' }, { quoted: msg });
  }
}

async function aiReply(sock, msg, body, contactId, profile, isCommand = false) {
  const jid = getJid(msg);
  const context = getContext(contactId, 6);
  const systemPrompt = getSystemPrompt(profile);

  let prompt = `${systemPrompt}\n\n`;
  if (context) prompt += `Historial reciente:\n${context}\n\n`;
  prompt += `${profile.name || 'La persona'}: ${body}\n\nTu respuesta:`;

  const aiResponse = await askGemini(contactId, prompt, profile.tag || '');

  if (aiResponse) {
    addToMemory(contactId, 'bot', aiResponse);
    const delay = isCommand ? 500 : randomDelay();
    await new Promise(r => setTimeout(r, delay));
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

  const delay = 1500 + Math.random() * 2000;
  await new Promise(r => setTimeout(r, delay));
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
    if (!chatId || chatId === 'status@broadcast') return;

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
