const { getGroupConfig, updateGroupConfig } = require('./database');

const spamTracker = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of spamTracker) {
    const valid = timestamps.filter(t => now - t < 60000);
    if (valid.length === 0) spamTracker.delete(key);
    else spamTracker.set(key, valid);
  }
}, 30000);

function getJid(notification) {
  return notification.jid;
}

async function handleGroupJoin(sock, notification) {
  const groupId = getJid(notification);
  const config = getGroupConfig(groupId);
  if (!config.welcome_enabled) return;

  const message = config.welcome_message.replace('{{name}}', notification.participants.join(', '));
  await sock.sendMessage(groupId, { text: message });
}

async function isAdmin(groupId, participantId) {
  const config = getGroupConfig(groupId);
  const admins = JSON.parse(config.admins || '[]');
  return admins.includes(participantId);
}

async function checkAntiSpam(sock, msg, groupId, sender) {
  const config = getGroupConfig(groupId);
  if (!config.anti_spam_enabled) return false;

  const now = Date.now();
  const window = (config.anti_spam_window || 10) * 1000;

  if (!spamTracker.has(sender)) {
    spamTracker.set(sender, []);
  }

  const timestamps = spamTracker.get(sender);
  const recent = timestamps.filter(t => now - t < window);
  recent.push(now);
  spamTracker.set(sender, recent);

  if (recent.length > (config.anti_spam_limit || 5)) {
    await sock.sendMessage(groupId, {
      text: `@${sender.split('@')[0]}, no hagas spam!`,
      mentions: [sender],
    });
    return true;
  }

  return false;
}

async function handleGroupCommand(sock, msg, command, args) {
  const groupId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  const isGroupAdmin = await isAdmin(groupId, sender);

  switch (command) {
    case 'welcome': {
      if (!isGroupAdmin) return sock.sendMessage(groupId, { text: 'Solo admins pueden usar este comando.' }, { quoted: msg });
      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        updateGroupConfig(groupId, { welcome_enabled: 1 });
        await sock.sendMessage(groupId, { text: '✅ Bienvenidas activadas.' }, { quoted: msg });
      } else if (sub === 'off') {
        updateGroupConfig(groupId, { welcome_enabled: 0 });
        await sock.sendMessage(groupId, { text: '❌ Bienvenidas desactivadas.' }, { quoted: msg });
      } else if (sub === 'set') {
        const text = args.slice(1).join(' ');
        if (!text) return sock.sendMessage(groupId, { text: 'Uso: !welcome set <mensaje>. Usa {{name}}' }, { quoted: msg });
        updateGroupConfig(groupId, { welcome_message: text });
        await sock.sendMessage(groupId, { text: '✅ Mensaje de bienvenida actualizado.' }, { quoted: msg });
      } else {
        const config = getGroupConfig(groupId);
        await sock.sendMessage(groupId, {
          text: `🤖 Bienvenidas:\nEstado: ${config.welcome_enabled ? '✅' : '❌'}\nMensaje: ${config.welcome_message}\n\n!welcome on/off/set <texto>`,
        }, { quoted: msg });
      }
      break;
    }

    case 'antispam': {
      if (!isGroupAdmin) return sock.sendMessage(groupId, { text: 'Solo admins.' }, { quoted: msg });
      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        updateGroupConfig(groupId, { anti_spam_enabled: 1 });
        await sock.sendMessage(groupId, { text: '✅ Anti-spam activado.' }, { quoted: msg });
      } else if (sub === 'off') {
        updateGroupConfig(groupId, { anti_spam_enabled: 0 });
        await sock.sendMessage(groupId, { text: '❌ Anti-spam desactivado.' }, { quoted: msg });
      } else {
        const config = getGroupConfig(groupId);
        await sock.sendMessage(groupId, {
          text: `🛡️ Anti-spam: ${config.anti_spam_enabled ? '✅' : '❌'}\nLímite: ${config.anti_spam_limit}msgs/${config.anti_spam_window}s`,
        }, { quoted: msg });
      }
      break;
    }

    case 'admin': {
      if (!isGroupAdmin) return sock.sendMessage(groupId, { text: 'Solo admins.' }, { quoted: msg });
      const sub = args[0]?.toLowerCase();
      if (sub === 'add') {
        const mention = args[1];
        if (!mention) return sock.sendMessage(groupId, { text: 'Uso: !admin add @usuario' }, { quoted: msg });
        const config = getGroupConfig(groupId);
        const admins = JSON.parse(config.admins || '[]');
        if (!admins.includes(mention)) admins.push(mention);
        updateGroupConfig(groupId, { admins });
        await sock.sendMessage(groupId, { text: `✅ Admin añadido: ${mention}` }, { quoted: msg });
      } else if (sub === 'remove') {
        const mention = args[1];
        if (!mention) return sock.sendMessage(groupId, { text: 'Uso: !admin remove @usuario' }, { quoted: msg });
        const config = getGroupConfig(groupId);
        const admins = JSON.parse(config.admins || '[]').filter(a => a !== mention);
        updateGroupConfig(groupId, { admins });
        await sock.sendMessage(groupId, { text: `✅ Admin eliminado: ${mention}` }, { quoted: msg });
      } else {
        await sock.sendMessage(groupId, { text: '👑 !admin add/remove/list' }, { quoted: msg });
      }
      break;
    }

    default:
      return false;
  }
  return true;
}

module.exports = { handleGroupJoin, checkAntiSpam, handleGroupCommand, isAdmin };
