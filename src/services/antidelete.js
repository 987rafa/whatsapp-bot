const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS antidelete (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  message_text TEXT,
  deleted_at TEXT DEFAULT (datetime('now'))
)`);

function saveDeletedMessage(chatId, sender, text) {
  db.prepare('INSERT INTO antidelete (chat_id, sender, message_text) VALUES (?, ?, ?)').run(chatId, sender, text || '*mensaje multimedia*');
}

function getRecentDeleted(chatId, limit = 5) {
  return db.prepare('SELECT * FROM antidelete WHERE chat_id = ? ORDER BY deleted_at DESC LIMIT ?').all(chatId, limit);
}

module.exports = { saveDeletedMessage, getRecentDeleted };
