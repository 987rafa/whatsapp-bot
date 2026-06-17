const { trackContact, getContact } = require('./database');
const { checkAntiSpam } = require('./groups');
const { processCommand } = require('../commands/handler');
const { askGemini } = require('./ai');
const { addToMemory, getContext } = require('./memory');
const { getRandomFact, getRandomQuote, getRandomCompliment, getRandomAdvice, getRandomJoke } = require('./knowledge');
const { magic8ball, flipCoin, rollDice, startTrivia, answerTrivia, triviaTimeout } = require('./games');
const { getWeather } = require('./weather');

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

  if (text.startsWith('!')) {
    addToMemory(contactId, 'user', text);
    await processCommand(sock, msg, text);
    return;
  }

  addToMemory(contactId, 'user', text);
  await autoReply(sock, msg, text, contactId);
}

async function handleGroupNotification(sock, notification) {
  if (notification.action === 'add') {
    const { handleGroupJoin } = require('./groups');
    await handleGroupJoin(sock, notification);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

async function autoReply(sock, msg, body, contactId) {
  const lower = body.toLowerCase().trim();
  const jid = getJid(msg);
  const contact = getContact(contactId);
  const tag = contact?.tag || '';
  const name = contact?.name || contactId;
  const greeting = getGreeting();

  // --- MEMORY CHECK ---
  if (triviaTimeout(contactId) && lower.length < 50) {
    const result = answerTrivia(contactId, lower);
    if (result) {
      await sock.sendMessage(jid, { text: result }, { quoted: msg });
      return;
    }
  }

  // --- TAG-BASED REPLIES ---
  const tagReplies = {
    novia: [
      { words: ['hola', 'buenas', 'buen'], reply: `${greeting} mi amor ❤️ ¿Cómo estás?` },
      { words: ['gracias'], reply: 'Siempre para ti, hermosa 💕' },
      { words: ['te quiero', 'te amo'], reply: 'Yo también te quiero mucho mi amor 🥰❤️' },
      { words: ['extraño', 'extraña'], reply: 'Yo también te extraño, mi vida 💗' },
      { words: ['besos', 'beso'], reply: 'Un abrazo gigante para vos 🫂❤️' },
      { words: ['bonita', 'hermosa'], reply: 'Tú eres la hermosa, mi amor 💕' },
      { words: ['cómo estás', 'como estas', 'que tal'], reply: 'Bien mi amor, pensando en ti 💭❤️' },
      { words: ['adios', 'bye', 'chao', 'nos vemos'], reply: 'Cuídate mucho mi amor 💕 te quiero' },
    ],
    amigo: [
      { words: ['hola', 'buenas', 'buen'], reply: `¡${greeting}, ${name}! ¿Todo bien? 🤙` },
      { words: ['gracias'], reply: '¡De nada, bro! 😎' },
      { words: ['que haces', 'qué haces', 'como vas'], reply: 'Acá nomás, servidor 24/7 🤖 ¿Vos?' },
      { words: ['jaja', 'jajaja', 'lol', 'xd'], reply: 'Jajaja 😂 buena esa' },
      { words: ['amigo', 'bro', 'hermano', 'pana'], reply: 'Grande loco! 🙌' },
      { words: ['adios', 'bye', 'chao', 'nos vemos'], reply: 'Ahí nos vemos! 👋' },
      { words: ['fiesta', 'rumba', 'cerveza'], reply: '🔥🔥🔥 suena bien!' },
    ],
    familia: [
      { words: ['hola', 'buenas', 'buen'], reply: `${greeting}, ${name} 😊 ¿Cómo está todo?` },
      { words: ['gracias'], reply: 'Con gusto, para eso estoy 👍' },
      { words: ['bien', 'bueno'], reply: '¡Qué bueno! Me alegro 😊' },
      { words: ['adios', 'bye', 'chao'], reply: 'Cuídate mucho! 🙏' },
      { words: ['cómo estás', 'como estas'], reply: 'Todo bien gracias 🫶 ¿y usted?' },
    ],
  };

  if (tagReplies[tag]) {
    for (const rule of tagReplies[tag]) {
      if (rule.words.some(w => lower.includes(w))) {
        addToMemory(contactId, 'bot', rule.reply);
        await sock.sendMessage(jid, { text: rule.reply }, { quoted: msg });
        return;
      }
    }
  }

  // --- GENERAL KNOWLEDGE PATTERNS ---
  const generalRules = [
    { words: ['hola', 'buenas', 'buen día', 'buenas tardes', 'buenas noches'], reply: `¡${greeting}! 👋 ¿En qué te ayudo?` },
    { words: ['gracias', 'thank'], reply: '¡De nada! 😊' },
    { words: ['quien eres', 'quién eres', 'quien sos', 'qué eres'], reply: 'Soy tu bot de WhatsApp 🤖 Creado con Baileys y mucho cariño' },
    { words: ['adios', 'bye', 'chao', 'nos vemos', 'hasta luego'], reply: '¡Hasta luego! 👋' },
    { words: ['te quiero', 'te amo'], reply: tag === 'novia' ? 'Yo también te amo ❤️🥰' : '🥰❤️' },
    { words: ['bien y tú', 'bien y tu', 'bien gracias'], reply: '¡Me alegra! 🎉' },
    { words: ['qué haces', 'que haces', 'ocupado'], reply: 'Aquí disponible para ti 24/7 🤖' },
    { words: ['dato', 'dato curioso', 'sabías que', 'sabias que'], reply: `🐝 ${getRandomFact()}` },
    { words: ['frase', 'cita', 'quote', 'inspira'], reply: `"${getRandomQuote().text}" — ${getRandomQuote().author} ✨` },
    { words: ['cumplido', 'piropo', 'algo bonito'], reply: getRandomCompliment() },
    { words: ['consejo', 'tip', 'recomienda'], reply: `💡 ${getRandomAdvice()}` },
    { words: ['chiste', 'broma', 'joke', 'risa'], reply: getRandomJoke() },
    { words: ['hora', 'qué hora es', 'que hora es'], reply: `🕐 Son las ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` },
    { words: ['fecha', 'qué día es', 'que dia es', 'fecha de hoy'], reply: `📅 Hoy es ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` },
    { words: ['día de la semana', 'que día es', 'que dia es hoy'], reply: `📅 ${new Date().toLocaleDateString('es-CO', { weekday: 'long' })}` },
  ];

  for (const rule of generalRules) {
    if (rule.words.some(w => lower.includes(w))) {
      addToMemory(contactId, 'bot', rule.reply);
      await sock.sendMessage(jid, { text: rule.reply }, { quoted: msg });
      return;
    }
  }

  // --- WEATHER ---
  const climaMatch = lower.match(/clima\s+(\w+)|tiempo\s+(\w+)|clima|tiempo/);
  if (climaMatch) {
    const location = climaMatch[1] || climaMatch[2] || '';
    const report = await getWeather(location || 'Bogotá');
    if (report) {
      await sock.sendMessage(jid, { text: `🌤️ Clima: ${report}` }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: 'No pude obtener el clima.' }, { quoted: msg });
    }
    return;
  }

  // --- CALCULATOR ---
  const calcMatch = lower.match(/^([\d\s+\-*/().]+)$/);
  if (calcMatch && /[+\-*/]/.test(lower) && !isNaN(eval(lower))) {
    try {
      const result = eval(lower);
      await sock.sendMessage(jid, { text: `🧮 ${lower} = ${result}` }, { quoted: msg });
      return;
    } catch {}
  }

  // --- GEMINI AI ---
  if (process.env.GEMINI_API_KEY) {
    const context = getContext(contactId, 3);
    const prompt = context ? `Contexto:\n${context}\n\nUsuario: ${body}` : body;
    const aiResponse = await askGemini(contactId, prompt, tag);
    if (aiResponse) {
      addToMemory(contactId, 'bot', aiResponse);
      await sock.sendMessage(jid, { text: aiResponse }, { quoted: msg });
      return;
    }
  }

  // --- FALLBACK (no AI key) ---
  const fallback = [
    'Interesante, cuéntame más 🤔',
    '¿En serio? 😮',
    'No sabía eso, gracias por contarme 👍',
    'Entiendo, ¿y qué más? 🤓',
    'Vaya, qué interesante 🧐',
    'Anotado ✅ Siempre aprendo algo nuevo contigo',
  ];
  const reply = fallback[Math.floor(Math.random() * fallback.length)];
  addToMemory(contactId, 'bot', reply);
  await sock.sendMessage(jid, { text: reply }, { quoted: msg });
}

module.exports = { handleMessage, handleGroupNotification, getJid, getSender, isGroup, extractText, getContactId };
