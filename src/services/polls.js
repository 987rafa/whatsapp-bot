const { db } = require('./database');

db.exec(`CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  votes TEXT DEFAULT '{}',
  creator TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const activePolls = new Map();

function createPoll(chatId, question, options, creator) {
  const result = db.prepare('INSERT INTO polls (chat_id, question, options, creator) VALUES (?, ?, ?, ?)')
    .run(chatId, question, JSON.stringify(options), creator);
  return result.lastInsertRowid;
}

function getPoll(id) {
  const p = db.prepare('SELECT * FROM polls WHERE id = ?').get(id);
  if (!p) return null;
  return { ...p, options: JSON.parse(p.options), votes: JSON.parse(p.votes || '{}') };
}

function votePoll(pollId, optionIndex, userId) {
  const poll = getPoll(pollId);
  if (!poll) return 'no-existe';
  if (poll.votes[userId]) return 'ya-voto';
  if (optionIndex < 0 || optionIndex >= poll.options.length) return 'invalido';
  poll.votes[userId] = optionIndex;
  db.prepare('UPDATE polls SET votes = ? WHERE id = ?').run(JSON.stringify(poll.votes), pollId);
  return 'ok';
}

function getPollResults(poll) {
  const counts = new Array(poll.options.length).fill(0);
  Object.values(poll.votes).forEach(idx => counts[idx]++);
  const total = Object.keys(poll.votes).length;
  let r = `🗳️ *${poll.question}*\n\n`;
  poll.options.forEach((opt, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    r += `${i + 1}. ${opt}\n${bar} ${counts[i]} votos (${pct}%)\n\n`;
  });
  r += `Total: ${total} votos`;
  return r;
}

module.exports = { createPoll, getPoll, votePoll, getPollResults, activePolls };
