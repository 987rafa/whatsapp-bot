const { getRandomTrivia, checkTriviaAnswer } = require('./knowledge');

const activeTrivia = new Map();

const responses = [
  'Sí, definitivamente 🎱',
  'Es seguro 👍',
  'Sin duda alguna ✅',
  'Pregunta de nuevo más tarde 🔮',
  'No cuentes con ello ❌',
  'Mis fuentes dicen que no 🚫',
  'Las señales apuntan a que sí 🌟',
  'Muy dudoso 🤔',
  'Sí, pero no ahora ⏳',
  'Totalmente, sin miedo al éxito 💯',
  'El destino lo dice... sí ✨',
  'Ni lo pienses ❌',
  'Podría ser... tal vez 🤷',
  'Claramente sí, obvio 🙌',
  'Las estrellas dicen que no 🌠',
];

function magic8ball(question) {
  if (!question) return 'Hazme una pregunta, ej: !8ball ¿hoy es mi día de suerte?';
  return `🎱 *Pregunta:* ${question}\n*Respuesta:* ${responses[Math.floor(Math.random() * responses.length)]}`;
}

function flipCoin() {
  return Math.random() < 0.5 ? '🪙 Cara' : '🪙 Sello';
}

function rollDice(sides = 6) {
  const max = Math.min(Math.max(parseInt(sides) || 6, 2), 100);
  return `🎲 Dado de ${max} caras: **${Math.floor(Math.random() * max) + 1}**`;
}

function startTrivia(userId) {
  if (activeTrivia.has(userId)) return null;
  const q = getRandomTrivia();
  activeTrivia.set(userId, { question: q.q, answer: q.a, asked: Date.now() });
  return `🧠 *Trivia:* ${q.q}`;
}

function answerTrivia(userId, answer) {
  const game = activeTrivia.get(userId);
  if (!game) return null;
  activeTrivia.delete(userId);
  const correct = checkTriviaAnswer(game.answer, answer);
  return correct
    ? `✅ ¡Correcto! La respuesta era: ${game.answer} 🎉`
    : `❌ Incorrecto. La respuesta era: ${game.answer}`;
}

function triviaTimeout(userId) {
  return activeTrivia.has(userId);
}

module.exports = { magic8ball, flipCoin, rollDice, startTrivia, answerTrivia, triviaTimeout };
