const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bot.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    first_seen TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now')),
    message_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS groups_config (
    id TEXT PRIMARY KEY,
    welcome_enabled INTEGER DEFAULT 0,
    welcome_message TEXT DEFAULT 'Bienvenido(a) {{name}} al grupo! 🎉',
    anti_spam_enabled INTEGER DEFAULT 0,
    anti_spam_limit INTEGER DEFAULT 5,
    anti_spam_window INTEGER DEFAULT 10,
    admins TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    message TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, message_count, last_seen)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      message_count = message_count + 1,
      last_seen = datetime('now')
  `),
  getUser: db.prepare('SELECT * FROM users WHERE id = ?'),
  getGroupConfig: db.prepare('SELECT * FROM groups_config WHERE id = ?'),
  upsertGroupConfig: db.prepare(`
    INSERT INTO groups_config (id, welcome_enabled, welcome_message, anti_spam_enabled, anti_spam_limit, anti_spam_window, admins)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      welcome_enabled = COALESCE(?, welcome_enabled),
      welcome_message = COALESCE(?, welcome_message),
      anti_spam_enabled = COALESCE(?, anti_spam_enabled),
      anti_spam_limit = COALESCE(?, anti_spam_limit),
      anti_spam_window = COALESCE(?, anti_spam_window),
      admins = COALESCE(?, admins)
  `),
  addScheduledMessage: db.prepare(`
    INSERT INTO scheduled_messages (chat_id, message, cron_expression)
    VALUES (?, ?, ?)
  `),
  getScheduledMessages: db.prepare('SELECT * FROM scheduled_messages WHERE enabled = 1'),
  deleteScheduledMessage: db.prepare('DELETE FROM scheduled_messages WHERE id = ?'),
};

function trackUser(id) {
  stmts.upsertUser.run(id);
}

function getUser(id) {
  return stmts.getUser.get(id);
}

function getGroupConfig(id) {
  let config = stmts.getGroupConfig.get(id);
  if (!config) {
    stmts.upsertGroupConfig.run(id, 0, '', 0, 5, 10, '[]', null, null, null, null, null, null);
    config = stmts.getGroupConfig.get(id);
  }
  return config;
}

function updateGroupConfig(id, data) {
  const config = getGroupConfig(id);
  stmts.upsertGroupConfig.run(
    id,
    data.welcome_enabled ?? config.welcome_enabled,
    data.welcome_message ?? config.welcome_message,
    data.anti_spam_enabled ?? config.anti_spam_enabled,
    data.anti_spam_limit ?? config.anti_spam_limit,
    data.anti_spam_window ?? config.anti_spam_window,
    JSON.stringify(data.admins ?? JSON.parse(config.admins)),
    data.welcome_enabled ?? null,
    data.welcome_message ?? null,
    data.anti_spam_enabled ?? null,
    data.anti_spam_limit ?? null,
    data.anti_spam_window ?? null,
    data.admins ? JSON.stringify(data.admins) : null
  );
}

function addScheduledMessage(chatId, message, cronExpression) {
  return stmts.addScheduledMessage.run(chatId, message, cronExpression);
}

function getScheduledMessages() {
  return stmts.getScheduledMessages.all();
}

function deleteScheduledMessage(id) {
  stmts.deleteScheduledMessage.run(id);
}

module.exports = {
  db, trackUser, getUser, getGroupConfig, updateGroupConfig,
  addScheduledMessage, getScheduledMessages, deleteScheduledMessage,
};
