const { trackContact, getContact } = require('./database');
const { checkAntiSpam } = require('./groups');
const { processCommand } = require('../commands/handler');
const { askGemini, clearChat } = require('./ai');
const { addToMemory, getContext } = require('./memory');
const { getProfile, analyzeMessage, updateProfile } = require('./learning');
const { getSystemPrompt, randomDelay } = require('./personality');
const { triviaTimeout, answerTrivia } = require('./games');

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

async function handleMessage(sock, msg) {
  const text = extractText(msg).trim();
  if (!text) return;

  const jid = getJid(msg);
  const sender = getSender(msg);
  const contactId = getContactId(sender);

  trackContact(contactId);

  if (isGroup(msg)) {
    const isSpam = await checkAntiSpam(sock, msg, jid, sender);
    if (isSpam) return;
  }

  // Track for learning
  const profile = getProfile(contactId) || {};
  analyzeMessage(contactId, text, profile);

  // Commands bypass AI
  if (text.startsWith('!')) {
    addToMemory(contactId, 'user', text);
    await processCommand(sock, msg, text);
    return;
  }

  addToMemory(contactId, 'user', text);

  // Check trivia
  if (triviaTimeout(contactId) && text.length < 50) {
    const result = answerTrivia(contactId, text);
    if (result) {
      await sock.sendMessage(jid, { text: result }, { quoted: msg });
      return;
    }
  }

  // AI-powered natural response
  await aiReply(sock, msg, text, contactId, profile);
}

async function aiReply(sock, msg, body, contactId, profile) {
  const jid = getJid(msg);
  const context = getContext(contactId, 6);
  const systemPrompt = getSystemPrompt(profile);

  // Build enhanced prompt for Gemini
  let prompt = `${systemPrompt}\n\n`;
  if (context) {
    prompt += `Historial reciente de la conversación:\n${context}\n\n`;
  }
  prompt += `Mensaje de ${profile.name || 'la persona'}: ${body}\n\nTu respuesta natural:`;

  const aiResponse = await askGemini(contactId, prompt, profile.tag || '');

  if (aiResponse) {
    addToMemory(contactId, 'bot', aiResponse);

    // Human-like delay then send
    const delay = randomDelay();
    await new Promise(r => setTimeout(r, delay));

    await sock.sendMessage(jid, { text: aiResponse }, { quoted: msg });
    return;
  }

  // Fallback ultra natural
  await naturalFallback(sock, msg, body, contactId, profile);
}

async function naturalFallback(sock, msg, body, contactId, profile) {
  const jid = getJid(msg);
  const tag = profile?.tag || '';
  const name = profile?.name || '';

  // Short/ultra-casual responses for common patterns
  const lower = body.toLowerCase().trim();

  // One-word or very short reactions
  if (lower.length < 3) {
    await sock.sendMessage(jid, { text: ['jaja', 'sí', 'no', 'ok', 'sabes', 'pues'][Math.floor(Math.random() * 6)] }, { quoted: msg });
    return;
  }

  // Tag-specific natural starters
  const starters = {
    novia: [
      'Ay mi amor', 'Pues mira', 'La verdad', 'Es que', 'Ay no',
      'Mi vida', 'Corazón', 'Amor', 'Bebé',
    ],
    amigo: [
      'Pues parce', 'La verdad', 'Es que', 'Oye', 'Mira',
      'Sabes qué', 'Bro', 'Pana', 'Llave',
    ],
    familia: [
      'Pues', 'Mire', 'La verdad', 'Es que', 'Bueno',
    ],
  };

  const starterList = starters[tag] || ['Pues', 'Mira', 'La verdad', 'Es que', 'Oye', 'Bueno'];
  const starter = starterList[Math.floor(Math.random() * starterList.length)];

  const replies = [
    `${starter} no sé qué decirte la verdad jeje`,
    `${starter} interesante lo que me cuentas`,
    'Pues sí, puede ser',
    'No sabía eso, qué loco',
    'Jaja pues sí',
    'La verdad no tengo mucha idea de eso',
    'Qué interesante, cuéntame más',
    'Mmm no sé, qué piensas tú?',
    'Pues mira, cada quien tiene su opinión',
    'Sí, te entiendo completamente',
    'Qué loco, no sabía eso',
    'Hmm ya veo, y eso?',
  ];

  const reply = replies[Math.floor(Math.random() * replies.length)];
  const delay = 1500 + Math.random() * 2000;
  await new Promise(r => setTimeout(r, delay));
  await sock.sendMessage(jid, { text: reply }, { quoted: msg });
}

async function handleGroupNotification(sock, notification) {
  if (notification.action === 'add') {
    const { handleGroupJoin } = require('./groups');
    await handleGroupJoin(sock, notification);
  }
}

module.exports = { handleMessage, handleGroupNotification, getJid, getSender, isGroup, extractText, getContactId };
