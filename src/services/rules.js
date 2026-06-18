const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS auto_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  response TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const rules = db.prepare('SELECT * FROM auto_rules WHERE user_id = ? AND enabled = 1');
const add = db.prepare('INSERT INTO auto_rules (user_id, trigger, response) VALUES (?, ?, ?)');
const remove = db.prepare('DELETE FROM auto_rules WHERE id = ? AND user_id = ?');
const toggle = db.prepare('UPDATE auto_rules SET enabled = CASE WHEN enabled THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?');

function getRules(userId) {
  return rules.all(userId);
}

function addRule(userId, trigger, response) {
  return add.run(userId, trigger.toLowerCase(), response).lastInsertRowid;
}

function removeRule(id, userId) {
  return remove.run(id, userId).changes > 0;
}

function toggleRule(id, userId) {
  return toggle.run(id, userId).changes > 0;
}

function checkRules(text, userId) {
  const userRules = rules.all(userId);
  const lower = text.toLowerCase();
  for (const rule of userRules) {
    if (lower.includes(rule.trigger)) {
      return rule.response;
    }
  }
  return null;
}

module.exports = { getRules, addRule, removeRule, toggleRule, checkRules };
