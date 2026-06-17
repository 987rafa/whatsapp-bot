const { getContact, getAllContacts, getContactsByTag, tagContact, updateContactName, updateContactNotes, getUser } = require('../services/database');
const { handleGroupCommand } = require('../services/groups');
const { addScheduledMessage, deleteScheduledMessage, getScheduledMessages } = require('../services/database');
const { reloadScheduler } = require('../services/scheduler');

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
  text += '▸ !ping\n▸ !say <texto>\n▸ !info\n▸ !perfil\n▸ !contactos\n';
  text += '▸ !tag <etiqueta> @usuario\n▸ !nota <texto>\n';
  if (isGroup) text += '▸ !welcome\n▸ !antispam\n▸ !admin\n';
  text += '▸ !schedule\n\n📌 Etiquetas: novia, amigo, familia, trabajo, extraño';
  await sock.sendMessage(getJid(msg), { text }, { quoted: msg });
});

register('say', async (sock, msg, args) => {
  if (!args.length) {
    await sock.sendMessage(getJid(msg), { text: 'Uso: !say <mensaje>' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(getJid(msg), { text: args.join(' ') }, { quoted: msg });
});

register('info', async (sock, msg) => {
  const jid = getJid(msg);
  const sender = msg.key.participant || jid;
  await sock.sendMessage(jid, {
    text: `👤 *ID:* ${sender}\n💬 *Chat:* ${jid}\n👥 *Grupo:* ${jid.includes('@g.us') ? 'Sí' : 'No'}`,
  }, { quoted: msg });
});

register('perfil', async (sock, msg) => {
  const contactId = getContactId(msg);
  const contact = getContact(contactId);
  if (!contact) {
    await sock.sendMessage(getJid(msg), { text: 'Sin datos aún.' }, { quoted: msg });
    return;
  }
  const tagEmoji = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  const emoji = tagEmoji[contact.tag] || '👤';
  await sock.sendMessage(getJid(msg), {
    text: `${emoji} *${contact.name || contactId}*\n🏷️ Tag: ${contact.tag || 'sin tag'}\n📊 Mensajes: ${contact.message_count}\n🕐 Primera vez: ${contact.first_seen}\n🕐 Última vez: ${contact.last_seen}\n📝 Nota: ${contact.notes || 'sin nota'}`,
  }, { quoted: msg });
});

register('tag', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const allowed = ['novia', 'amigo', 'familia', 'trabajo', 'extraño'];

  if (!sub || !allowed.includes(sub)) {
    await sock.sendMessage(getJid(msg), {
      text: `Uso: !tag <etiqueta>\nEtiquetas: ${allowed.join(', ')}\n\nEj: !tag novia\nEj: !tag amigo @usuario (en grupo)`,
    }, { quoted: msg });
    return;
  }

  const jid = getJid(msg);
  const isGroup = jid.includes('@g.us');

  if (isGroup && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const targetId = mentioned.replace('@s.whatsapp.net', '');
    const name = args.slice(1).join(' ') || targetId;
    tagContact(targetId, sub, name);
    await sock.sendMessage(jid, { text: `✅ @${targetId} → *${sub}*`, mentions: [mentioned] }, { quoted: msg });
  } else {
    const contactId = getContactId(msg);
    const name = args.slice(1).join(' ') || contactId;
    tagContact(contactId, sub, name);
    await sock.sendMessage(jid, { text: `✅ Actualizado → *${sub}*` }, { quoted: msg });
  }
});

register('nota', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) {
    await sock.sendMessage(getJid(msg), { text: 'Uso: !nota <texto>' }, { quoted: msg });
    return;
  }
  const contactId = getContactId(msg);
  updateContactNotes(contactId, text);
  await sock.sendMessage(getJid(msg), { text: '✅ Nota guardada.' }, { quoted: msg });
});

register('contactos', async (sock, msg, args) => {
  const tag = args[0]?.toLowerCase();
  const contacts = tag ? getContactsByTag(tag) : getAllContacts();

  if (!contacts.length) {
    await sock.sendMessage(getJid(msg), { text: 'Sin contactos registrados.' }, { quoted: msg });
    return;
  }

  const tagEmoji = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  let text = tag ? `📋 *${tag}s*\n\n` : '📋 *Todos los contactos*\n\n';
  for (const c of contacts.slice(0, 20)) {
    const emoji = tagEmoji[c.tag] || '👤';
    text += `${emoji} ${c.name || c.id} (${c.message_count} msgs)\n`;
  }
  if (contacts.length > 20) text += `\ny ${contacts.length - 20} más...`;
  text += `\n\nTotal: ${contacts.length}`;
  await sock.sendMessage(getJid(msg), { text }, { quoted: msg });
});

register('schedule', async (sock, msg, args) => {
  const jid = getJid(msg);
  const sub = args[0]?.toLowerCase();

  if (sub === 'add') {
    const cronExpr = args[1];
    const message = args.slice(2).join(' ');
    if (!cronExpr || !message) {
      await sock.sendMessage(jid, { text: 'Uso: !schedule add "<cron>" <mensaje>' }, { quoted: msg });
      return;
    }
    const result = addScheduledMessage(jid, message, cronExpr);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Programado (ID: ${result.lastInsertRowid})` }, { quoted: msg });
  } else if (sub === 'list') {
    const messages = getScheduledMessages().filter(m => m.chat_id === jid);
    if (!messages.length) {
      await sock.sendMessage(jid, { text: 'Sin mensajes programados.' }, { quoted: msg });
      return;
    }
    let text = '📅 *Programados:*\n\n';
    for (const m of messages) {
      text += `*#${m.id}* \`${m.cron_expression}\`\n${m.message}\n\n`;
    }
    await sock.sendMessage(jid, { text }, { quoted: msg });
  } else if (sub === 'remove') {
    const id = parseInt(args[1]);
    if (isNaN(id)) {
      await sock.sendMessage(jid, { text: 'Uso: !schedule remove <id>' }, { quoted: msg });
      return;
    }
    deleteScheduledMessage(id);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Eliminado #${id}` }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, {
      text: '⏰ !schedule add "<cron>" <msg>\n!schedule list\n!schedule remove <id>\n\nEj: "0 9 * * 1-5"',
    }, { quoted: msg });
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
      console.error(`Error en !${commandName}:`, err);
      await sock.sendMessage(getJid(msg), { text: `Error en !${commandName}` }, { quoted: msg });
    }
  } else {
    await sock.sendMessage(getJid(msg), { text: `❌ !${commandName} no existe. Usa !help` }, { quoted: msg });
  }
}

module.exports = { processCommand, register };
