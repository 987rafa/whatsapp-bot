const { getUser } = require('../services/database');
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

register('ping', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: 'pong 🏓' }, { quoted: msg });
});

register('help', async (sock, msg) => {
  const isGroup = getJid(msg).includes('@g.us');
  let text = '📋 *Comandos:*\n\n';
  text += '┃ !ping\n┃ !say <texto>\n┃ !info\n┃ !userinfo\n';
  if (isGroup) text += '┃ !welcome\n┃ !antispam\n┃ !admin\n';
  text += '\n⏰ !schedule add/list/remove';
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

register('userinfo', async (sock, msg) => {
  const sender = msg.key.participant || msg.key.remoteJid;
  const user = getUser(sender);
  if (!user) {
    await sock.sendMessage(getJid(msg), { text: 'Sin datos aún.' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(getJid(msg), {
    text: `👤 *${sender.split('@')[0]}*\n📊 Mensajes: ${user.message_count}\n🕐 Primera vez: ${user.first_seen}\n🕐 Última: ${user.last_seen}`,
  }, { quoted: msg });
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
