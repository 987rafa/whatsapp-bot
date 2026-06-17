const cron = require('node-cron');
const { getScheduledMessages } = require('./database');

const jobs = new Map();

function startScheduler(sock) {
  const messages = getScheduledMessages();
  for (const msg of messages) {
    scheduleMessage(sock, msg);
  }
  console.log(`⏰ ${messages.length} mensajes programados`);
}

function scheduleMessage(sock, msg) {
  if (jobs.has(msg.id)) jobs.get(msg.id).stop();

  const task = cron.schedule(msg.cron_expression, async () => {
    try {
      await sock.sendMessage(msg.chat_id, { text: msg.message });
      console.log(`📬 Enviado programado #${msg.id}`);
    } catch (err) {
      console.error(`Error #${msg.id}:`, err);
    }
  });

  jobs.set(msg.id, task);
}

function stopScheduler() {
  for (const t of jobs.values()) t.stop();
  jobs.clear();
}

function reloadScheduler(sock) {
  stopScheduler();
  startScheduler(sock);
}

module.exports = { startScheduler, scheduleMessage, stopScheduler, reloadScheduler };
