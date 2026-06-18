const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bot.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    message_count INTEGER DEFAULT 0,
    first_seen TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    message TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    sent INTEGER DEFAULT 0
  );
`);

const stmts = {
  trackContact: db.prepare(`
    INSERT INTO contacts (id, message_count, last_seen)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      message_count = message_count + 1,
      last_seen = datetime('now')
  `),
  getContact: db.prepare('SELECT * FROM contacts WHERE id = ?'),
  getContactsByTag: db.prepare('SELECT * FROM contacts WHERE tag = ? ORDER BY last_seen DESC'),
  getAllContacts: db.prepare('SELECT * FROM contacts ORDER BY last_seen DESC'),
  tagContact: db.prepare("UPDATE contacts SET tag = ?, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?"),
  updateContactName: db.prepare('UPDATE contacts SET name = ? WHERE id = ?'),
  updateContactNotes: db.prepare('UPDATE contacts SET notes = ? WHERE id = ?'),
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
  addReminder: db.prepare('INSERT INTO reminders (user_id, chat_id, message, remind_at) VALUES (?, ?, ?, ?)'),
  getPendingReminders: db.prepare("SELECT * FROM reminders WHERE sent = 0 AND remind_at <= datetime('now')"),
  markReminderSent: db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?'),
  getUserReminders: db.prepare("SELECT * FROM reminders WHERE user_id = ? AND sent = 0 ORDER BY remind_at"),
  deleteReminder: db.prepare('DELETE FROM reminders WHERE id = ?'),
};

function trackContact(id) {
  stmts.trackContact.run(id);
}

function getContact(id) {
  let c = stmts.getContact.get(id);
  if (!c) {
    stmts.trackContact.run(id);
    c = stmts.getContact.get(id);
  }
  return c;
}

function getContactsByTag(tag) {
  return stmts.getContactsByTag.all(tag);
}

function getAllContacts() {
  return stmts.getAllContacts.all();
}

function tagContact(id, tag, name) {
  stmts.tagContact.run(tag, name || '', id);
}

function updateContactName(id, name) {
  stmts.updateContactName.run(name, id);
}

function updateContactNotes(id, notes) {
  stmts.updateContactNotes.run(notes, id);
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

function addReminder(userId, chatId, message, remindAt) {
  return stmts.addReminder.run(userId, chatId, message, remindAt);
}

function getPendingReminders() {
  return stmts.getPendingReminders.all();
}

function markReminderSent(id) {
  stmts.markReminderSent.run(id);
}

function getUserReminders(userId) {
  return stmts.getUserReminders.all(userId);
}

function deleteReminder(id) {
  stmts.deleteReminder.run(id);
}

module.exports = {
  db, trackContact, getContact, getContactsByTag, getAllContacts,
  tagContact, updateContactName, updateContactNotes,
  getGroupConfig, updateGroupConfig,
  addScheduledMessage, getScheduledMessages, deleteScheduledMessage,
  addReminder, getPendingReminders, markReminderSent, getUserReminders, deleteReminder,
  DB_PATH,
};
