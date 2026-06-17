const { trackUser } = require('./database');
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

async function handleMessage(sock, msg) {
  const text = extractText(msg).trim();
  if (!text) return;

  const jid = getJid(msg);
  const sender = getSender(msg);

  trackUser(sender, text);

  if (isGroup(msg)) {
    const isSpam = await checkAntiSpam(sock, msg, jid, sender);
    if (isSpam) return;
  }

  if (text.startsWith('!')) {
    await processCommand(sock, msg, text);
    return;
  }

  await autoReply(sock, msg, text);
}

async function handleGroupNotification(sock, notification) {
  if (notification.action === 'add') {
    const { handleGroupJoin } = require('./groups');
    await handleGroupJoin(sock, notification);
  }
}

async function autoReply(sock, msg, body) {
  const lower = body.toLowerCase();
  const jid = getJid(msg);

  if (lower.includes('hola') || lower.includes('buenas')) {
    await sock.sendMessage(jid, { text: '¡Hola! 👋 ¿En qué puedo ayudarte?' }, { quoted: msg });
  } else if (lower.includes('gracias')) {
    await sock.sendMessage(jid, { text: '¡De nada! 😊' }, { quoted: msg });
  } else if (lower.includes('quien eres') || lower.includes('quién eres')) {
    await sock.sendMessage(jid, { text: 'Soy un bot de WhatsApp 🤖' }, { quoted: msg });
  } else if (lower.includes('adios') || lower.includes('bye') || lower.includes('chao')) {
    await sock.sendMessage(jid, { text: '¡Hasta luego! 👋' }, { quoted: msg });
  }
}

module.exports = { handleMessage, handleGroupNotification, getJid, getSender, isGroup, extractText };
