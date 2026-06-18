const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  day INTEGER NOT NULL,
  month INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const add = db.prepare('INSERT INTO birthdays (user_id, name, day, month) VALUES (?, ?, ?, ?)');
const list = db.prepare('SELECT * FROM birthdays WHERE user_id = ? ORDER BY month, day');
const remove = db.prepare('DELETE FROM birthdays WHERE id = ? AND user_id = ?');
const todayBirthdays = db.prepare("SELECT * FROM birthdays WHERE day = CAST(strftime('%d', 'now') AS INTEGER) AND month = CAST(strftime('%m', 'now') AS INTEGER)");

function addBirthday(userId, name, day, month) {
  return add.run(userId, name, day, month).lastInsertRowid;
}

function listBirthdays(userId) {
  return list.all(userId);
}

function removeBirthday(id, userId) {
  return remove.run(id, userId).changes > 0;
}

function getTodayBirthdays() {
  return todayBirthdays.all();
}

let birthdayInterval = null;

function startBirthdayChecker(sock) {
  if (birthdayInterval) clearInterval(birthdayInterval);

  const check = async () => {
    try {
      const { db } = require('./database');
      const today = db.prepare("SELECT * FROM birthdays WHERE day = CAST(strftime('%d', 'now') AS INTEGER) AND month = CAST(strftime('%m', 'now') AS INTEGER)").all();
      const sent = db.prepare("SELECT value FROM bot_config WHERE key = 'birthday_sent'").get();
      const todayStr = new Date().toISOString().substring(0, 10);
      if (sent?.value === todayStr) return;
      db.prepare("INSERT OR REPLACE INTO bot_config (key, value) VALUES ('birthday_sent', ?)").run(todayStr);

      for (const b of today) {
        try {
          await sock.sendMessage(b.user_id, { text: `🎂 ¡Hoy es el cumpleaños de *${b.name}*! 🎉 No olvides saludarlo 💕` });
          console.log(`🎂 Recordatorio de cumpleaños: ${b.name}`);
        } catch {}
      }
    } catch {}
  };

  check();
  birthdayInterval = setInterval(check, 3600000);
}

module.exports = { addBirthday, listBirthdays, removeBirthday, getTodayBirthdays, startBirthdayChecker };
