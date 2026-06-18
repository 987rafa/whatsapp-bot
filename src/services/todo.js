const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const add = db.prepare('INSERT INTO todos (user_id, text) VALUES (?, ?)');
const list = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY done, created_at DESC');
const toggle = db.prepare('UPDATE todos SET done = CASE WHEN done THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?');
const remove = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');

function addTodo(userId, text) {
  return add.run(userId, text).lastInsertRowid;
}

function listTodos(userId) {
  return list.all(userId);
}

function toggleTodo(id, userId) {
  return toggle.run(id, userId).changes > 0;
}

function removeTodo(id, userId) {
  return remove.run(id, userId).changes > 0;
}

module.exports = { addTodo, listTodos, toggleTodo, removeTodo };
