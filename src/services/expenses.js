const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)`);

const add = db.prepare('INSERT INTO expenses (user_id, amount, category, description) VALUES (?, ?, ?, ?)');
const list = db.prepare("SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
const total = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date(created_at) = date('now')");
const byCategory = db.prepare("SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ? AND date(created_at) = date('now') GROUP BY category ORDER BY total DESC");

function addExpense(userId, amount, category, description) {
  return add.run(userId, amount, category || '', description || '').lastInsertRowid;
}

function listExpenses(userId) {
  return list.all(userId);
}

function getTodayTotal(userId) {
  return total.get(userId)?.total || 0;
}

function getByCategory(userId) {
  return byCategory.all(userId);
}

module.exports = { addExpense, listExpenses, getTodayTotal, getByCategory };
