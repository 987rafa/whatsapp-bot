const { trackContact, getContact } = require('./database');
const { checkAntiSpam } = require('./groups');
const { processCommand } = require('../commands/handler');

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
    await processCommand(sock, msg, text);
    return;
  }

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
  const lower = body.toLowerCase();
  const jid = getJid(msg);
  const contact = getContact(contactId);
  const tag = contact?.tag || '';
  const name = contact?.name || contactId;
  const greeting = getGreeting();

  const replies = {
    novia: {
      hola: `${greeting} mi amor ❤️ ¿Cómo estás?`,
      gracias: 'Siempre para ti, hermosa 💕',
      'te quiero': 'Yo también te quiero mucho mi amor 🥰',
      extraño: 'Yo también te extraño, mi vida 💗',
      besos: 'Un abrazo virtual gigante para vos 🫂❤️',
    },
    amigo: {
      hola: `¡${greeting}, ${name}! ¿Todo bien? 🤙`,
      gracias: '¡De nada, bro! 😎',
      'que haces': 'Acá nomás, servidor 24/7 🤖',
      jaja: 'Jajaja 😂',
      amigo: 'Grande loco! 🙌',
    },
    familia: {
      hola: `${greeting}, ${name} 😊 ¿Cómo está todo?`,
      gracias: 'Con gusto, para eso estoy 👍',
      bueno: 'Que estés bien! 🙏',
    },
  };

  const tagReplies = replies[tag];
  if (tagReplies) {
    for (const [key, reply] of Object.entries(tagReplies)) {
      if (lower.includes(key)) {
        await sock.sendMessage(jid, { text: reply }, { quoted: msg });
        return;
      }
    }
  }

  if (lower.includes('hola') || lower.includes('buenas') || lower.includes('buen')) {
    const personal = tag ? `${greeting}, ${name}${tag === 'novia' ? ' ❤️' : tag === 'amigo' ? ' 🤙' : ' 😊'}!` : `¡${greeting}! 👋`;
    await sock.sendMessage(jid, { text: personal }, { quoted: msg });
  } else if (lower.includes('gracias')) {
    await sock.sendMessage(jid, { text: '¡De nada! 😊' }, { quoted: msg });
  } else if (lower.includes('quien eres') || lower.includes('quién eres')) {
    await sock.sendMessage(jid, { text: 'Soy tu bot de WhatsApp 🤖' }, { quoted: msg });
  } else if (lower.includes('adios') || lower.includes('bye') || lower.includes('chao')) {
    const despedida = tag === 'novia' ? 'Cuídate mucho mi amor 💕' : tag === 'amigo' ? 'Ahí nos vemos! 👋' : '¡Hasta luego! 👋';
    await sock.sendMessage(jid, { text: despedida }, { quoted: msg });
  } else if (lower.includes('te quiero') || lower.includes('te amo')) {
    if (tag === 'novia') {
      await sock.sendMessage(jid, { text: 'Yo también te amo, mi vida ❤️🥰' }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: '🥰❤️' }, { quoted: msg });
    }
  }
}

module.exports = { handleMessage, handleGroupNotification, getJid, getSender, isGroup, extractText, getContactId };
