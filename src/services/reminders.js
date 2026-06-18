const { getPendingReminders, markReminderSent } = require('./database');

let interval = null;

function startReminderChecker(sock) {
  if (interval) clearInterval(interval);

  interval = setInterval(async () => {
    try {
      const reminders = getPendingReminders();
      for (const r of reminders) {
        try {
          await sock.sendMessage(r.chat_id, {
            text: `⏰ *Recordatorio:* ${r.message}`,
          });
          markReminderSent(r.id);
          console.log(`⏰ Recordatorio enviado #${r.id}`);
        } catch (err) {
          console.error(`Error enviando recordatorio #${r.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error en reminder checker:', err.message);
    }
  }, 15000);

  console.log('⏰ Recordatorios activos (cada 15s)');
}

function stopReminderChecker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports = { startReminderChecker, stopReminderChecker };
