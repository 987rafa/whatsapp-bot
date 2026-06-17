const { getContact, getAllContacts, getContactsByTag, tagContact, updateContactNotes } = require('../services/database');
const { handleGroupCommand } = require('../services/groups');
const { addScheduledMessage, deleteScheduledMessage, getScheduledMessages } = require('../services/database');
const { reloadScheduler } = require('../services/scheduler');
const { askGemini, clearChat } = require('../services/ai');
const { clearMemory, getMemory } = require('../services/memory');
const { getRandomFact, getRandomQuote, getRandomCompliment, getRandomAdvice, getRandomJoke } = require('../services/knowledge');
const { magic8ball, flipCoin, rollDice, startTrivia, answerTrivia } = require('../services/games');
const { getWeather } = require('../services/weather');

const commands = new Map();

function register(name, handler) {
  commands.set(name.toLowerCase(), handler);
}

function getJid(msg) {
  return msg.key.remoteJid;
}

function getContactId(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  return sender.replace('@s.whatsapp.net', '');
}

register('ping', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: 'pong 🏓' }, { quoted: msg });
});

register('help', async (sock, msg) => {
  const isGroup = getJid(msg).includes('@g.us');
  let text = '🤖 *COMANDOS*\n\n';
  text += '▸ !ping | !say\n▸ !perfil | !tag | !nota | !contactos\n▸ !dato | !frase | !chiste | !consejo\n▸ !cumplido | !hora | !fecha\n▸ !8ball <preg> | !moneda | !dado <caras>\n▸ !trivia | !clima <ciudad>\n▸ !calc <expr>\n▸ !char <texto> (IA)\n▸ !olvidar (borra memoria)\n';
  if (isGroup) text += '\n▸ !welcome | !antispam | !admin\n';
  text += '\n▸ !schedule add/list/remove';

  await sock.sendMessage(getJid(msg), { text }, { quoted: msg });
});

register('say', async (sock, msg, args) => {
  if (!args.length) return sock.sendMessage(getJid(msg), { text: 'Uso: !say <texto>' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: args.join(' ') }, { quoted: msg });
});

register('perfil', async (sock, msg) => {
  const contactId = getContactId(msg);
  const contact = getContact(contactId);
  if (!contact) return sock.sendMessage(getJid(msg), { text: 'Sin datos aún.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  const emoji = emojis[contact.tag] || '👤';
  await sock.sendMessage(getJid(msg), {
    text: `${emoji} *${contact.name || contactId}*\n🏷️ ${contact.tag || 'sin tag'}\n📊 ${contact.message_count} msgs\n🕐 ${contact.first_seen}\n📝 ${contact.notes || 'sin nota'}`,
  }, { quoted: msg });
});

register('tag', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const allowed = ['novia', 'amigo', 'familia', 'trabajo', 'extraño'];
  if (!sub || !allowed.includes(sub)) {
    return sock.sendMessage(getJid(msg), { text: `Uso: !tag <${allowed.join('|')}>\nEj: !tag novia\nEn grupo: !tag amigo @usuario` }, { quoted: msg });
  }
  const jid = getJid(msg);
  const isGroup = jid.includes('@g.us');
  if (isGroup && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const targetId = mentioned.replace('@s.whatsapp.net', '');
    const name = args.slice(1).join(' ') || targetId;
    tagContact(targetId, sub, name);
    await sock.sendMessage(jid, { text: `✅ @${targetId} → ${sub}`, mentions: [mentioned] }, { quoted: msg });
  } else {
    const contactId = getContactId(msg);
    const name = args.slice(1).join(' ') || contactId;
    tagContact(contactId, sub, name);
    await sock.sendMessage(jid, { text: `✅ Tag actualizado → ${sub}` }, { quoted: msg });
  }
});

register('nota', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !nota <texto>' }, { quoted: msg });
  updateContactNotes(getContactId(msg), text);
  await sock.sendMessage(getJid(msg), { text: '✅ Nota guardada.' }, { quoted: msg });
});

register('contactos', async (sock, msg, args) => {
  const tag = args[0]?.toLowerCase();
  const contacts = tag ? getContactsByTag(tag) : getAllContacts();
  if (!contacts.length) return sock.sendMessage(getJid(msg), { text: 'Sin contactos.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  let t = tag ? `📋 *${tag}s*\n\n` : '📋 *Contactos*\n\n';
  for (const c of contacts.slice(0, 20)) t += `${emojis[c.tag] || '👤'} ${c.name || c.id} (${c.message_count})\n`;
  if (contacts.length > 20) t += `\ny ${contacts.length - 20} más`;
  t += `\n\nTotal: ${contacts.length}`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
});

register('dato', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `🧠 ${getRandomFact()}` }, { quoted: msg });
});

register('frase', async (sock, msg) => {
  const q = getRandomQuote();
  await sock.sendMessage(getJid(msg), { text: `✨ "${q.text}"\n— ${q.author}` }, { quoted: msg });
});

register('chiste', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomJoke() }, { quoted: msg });
});

register('consejo', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `💡 ${getRandomAdvice()}` }, { quoted: msg });
});

register('cumplido', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomCompliment() }, { quoted: msg });
});

register('hora', async (sock, msg) => {
  const h = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  await sock.sendMessage(getJid(msg), { text: `🕐 Son las ${h}` }, { quoted: msg });
});

register('fecha', async (sock, msg) => {
  const d = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await sock.sendMessage(getJid(msg), { text: `📅 ${d}` }, { quoted: msg });
});

register('8ball', async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: magic8ball(args.join(' ')) }, { quoted: msg });
});

register('moneda', async (sock, msg) => {
  const { flipCoin } = require('../services/games');
  await sock.sendMessage(getJid(msg), { text: flipCoin() }, { quoted: msg });
});

register('dado', async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: rollDice(args[0]) }, { quoted: msg });
});

register('trivia', async (sock, msg) => {
  const contactId = getContactId(msg);
  const game = startTrivia(contactId);
  if (!game) return sock.sendMessage(getJid(msg), { text: 'Ya tienes una trivia activa.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: game }, { quoted: msg });
});

register('clima', async (sock, msg, args) => {
  const location = args.join(' ') || 'Bogotá';
  const report = await getWeather(location);
  if (report) {
    await sock.sendMessage(getJid(msg), { text: `🌤️ ${report}` }, { quoted: msg });
  } else {
    await sock.sendMessage(getJid(msg), { text: 'No encontré esa ubicación.' }, { quoted: msg });
  }
});

register('calc', async (sock, msg, args) => {
  const expr = args.join(' ');
  try {
    const result = eval(expr);
    await sock.sendMessage(getJid(msg), { text: `🧮 ${expr} = ${result}` }, { quoted: msg });
  } catch {
    await sock.sendMessage(getJid(msg), { text: '❌ Expresión inválida' }, { quoted: msg });
  }
});

register('olvidar', async (sock, msg) => {
  clearMemory(getContactId(msg));
  clearChat(getContactId(msg));
  await sock.sendMessage(getJid(msg), { text: '🗑️ Memoria borrada. Ahora no recuerdo nada de ti.' }, { quoted: msg });
});

register('char', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !char <mensaje>' }, { quoted: msg });

  const contactId = getContactId(msg);
  const contact = getContact(contactId);
  const response = await askGemini(contactId, text, contact?.tag || '');
  await sock.sendMessage(getJid(msg), { text: response || '❌ No pude procesar eso.' }, { quoted: msg });
});

register('schedule', async (sock, msg, args) => {
  const jid = getJid(msg);
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const cronExpr = args[1];
    const message = args.slice(2).join(' ');
    if (!cronExpr || !message) return sock.sendMessage(jid, { text: 'Uso: !schedule add "<cron>" <msg>' }, { quoted: msg });
    const result = addScheduledMessage(jid, message, cronExpr);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Programado #${result.lastInsertRowid}` }, { quoted: msg });
  } else if (sub === 'list') {
    const msgs = getScheduledMessages().filter(m => m.chat_id === jid);
    if (!msgs.length) return sock.sendMessage(jid, { text: 'Sin programados.' }, { quoted: msg });
    let t = '📅 *Programados*\n\n';
    for (const m of msgs) t += `#${m.id} \`${m.cron_expression}\`\n${m.message}\n\n`;
    await sock.sendMessage(jid, { text: t }, { quoted: msg });
  } else if (sub === 'remove') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return sock.sendMessage(jid, { text: 'Uso: !schedule remove <id>' }, { quoted: msg });
    deleteScheduledMessage(id);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Eliminado #${id}` }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: '⏰ !schedule add "<cron>" <msg>\n!schedule list\n!schedule remove <id>' }, { quoted: msg });
  }
});

async function processCommand(sock, msg, body) {
  const parts = body.slice(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (msg.key.remoteJid?.includes('@g.us')) {
    const handled = await handleGroupCommand(sock, msg, commandName, args);
    if (handled) return;
  }

  const handler = commands.get(commandName);
  if (handler) {
    try {
      await handler(sock, msg, args);
    } catch (err) {
      console.error(`Error !${commandName}:`, err);
      await sock.sendMessage(getJid(msg), { text: `Error en !${commandName}` }, { quoted: msg });
    }
  } else {
    await sock.sendMessage(getJid(msg), { text: `❌ !${commandName} no existe. Usa !help` }, { quoted: msg });
  }
}

module.exports = { processCommand, register };
