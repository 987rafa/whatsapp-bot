const facts = [
  'Los pulpos tienen 3 corazones y sangre azul 🐙',
  'Las hormigas nunca duermen 🐜',
  'Un día en Venus dura más que un año en Venus 🌍',
  'Los flamencos son rosas por su alimentación 🦩',
  'El corazón de un colibrí late 1200 veces por minuto 🐦',
  'El papel higiénico se inventó en China en el siglo II 📜',
  'Los koalas duermen 22 horas al día 🐨',
  'El agua caliente se congela más rápido que la fría 💧',
  'Las bananas son radioactivas 🍌',
  'Los tiburones existían antes que los árboles 🦈',
  'Una nube pesa aproximadamente 500 toneladas ☁️',
  'El ojo humano puede distinguir 10 millones de colores 👁️',
  'Las huellas de la lengua son únicas como las de los dedos 👅',
  'La miel nunca se echa a perder 🍯',
  'Los gatos tienen 32 músculos en cada oreja 🐱',
];

const quotes = [
  { text: 'El único modo de hacer un gran trabajo es amar lo que haces', author: 'Steve Jobs' },
  { text: 'La vida es lo que pasa mientras estás ocupado haciendo otros planes', author: 'John Lennon' },
  { text: 'No cuentes los días, haz que los días cuenten', author: 'Muhammad Ali' },
  { text: 'El éxito es ir de fracaso en fracaso sin perder el entusiasmo', author: 'Winston Churchill' },
  { text: 'Sé el cambio que quieres ver en el mundo', author: 'Mahatma Gandhi' },
  { text: 'La imaginación es más importante que el conocimiento', author: 'Albert Einstein' },
  { text: 'Todo lo que puedes imaginar es real', author: 'Pablo Picasso' },
  { text: 'La felicidad no es algo que pospones para el futuro; es algo que diseñas para el presente', author: 'Jim Rohn' },
  { text: 'El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor momento es ahora', author: 'Proverbio chino' },
  { text: 'No importa lo lento que vayas, mientras no te detengas', author: 'Confucio' },
];

const compliments = [
  'Tienes una sonrisa contagiosa 😊',
  'Eres más fuerte de lo que crees 💪',
  'Tu energía es increíble hoy ✨',
  'Eres único y eso es tu superpoder 🦸',
  'El mundo es mejor porque estás en él 🌎',
  'Tu forma de pensar es inspiradora 🌟',
  'Hoy es un gran día porque tú existes 🎉',
];

const advice = [
  'Bebe más agua durante el día 💧',
  'Toma descansos de 5 minutos cada hora ⏰',
  'Sonreír reduce el estrés 😊',
  'Dormir bien es clave para tu salud 🛌',
  'Haz una pausa y respira profundo 🧘',
  'Escribe 3 cosas por las que estás agradecido 🙏',
  'Camina 10 minutos al día al aire libre 🌳',
];

const jokes = [
  '¿Qué le dice un semáforo a otro? No me mires que me estoy cambiando 🚦',
  '¿Por qué los pájaros no usan WhatsApp? Porque ya tienen Twitter 🐦',
  '¿Qué hace una abeja en el gimnasio? Zumba 🐝',
  'Llamé al número equivocado y contestaron: "Es el número correcto". Me confundí más 📞',
  '¿Qué le dijo el pez al agua? Nada 🐟',
  'Los programadores son como los peces... siempre están en el mismo banco 🐠',
  '¿Cómo se dice "foo" en español? "Fú" 🤣',
];

const triviaQuestions = [
  { q: '¿Cuál es el planeta más grande del sistema solar?', a: 'Júpiter' },
  { q: '¿Cuántos huesos tiene el cuerpo humano adulto?', a: '206' },
  { q: '¿En qué año llegó el hombre a la luna?', a: '1969' },
  { q: '¿Cuál es el océano más grande?', a: 'Pacífico' },
  { q: '¿Quién pintó la Mona Lisa?', a: 'Leonardo da Vinci' },
  { q: '¿Cuál es el río más largo del mundo?', a: 'Amazonas' },
  { q: '¿Qué país tiene más habitantes?', a: 'India' },
  { q: '¿Cuál es el animal terrestre más rápido?', a: 'Guepardo (Chita)' },
  { q: '¿En qué país se inventó el sushi?', a: 'Japón' },
  { q: '¿Cuál es el idioma más hablado del mundo?', a: 'Inglés' },
];

function getRandomFact() {
  return facts[Math.floor(Math.random() * facts.length)];
}

function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function getRandomCompliment() {
  return compliments[Math.floor(Math.random() * compliments.length)];
}

function getRandomAdvice() {
  return advice[Math.floor(Math.random() * advice.length)];
}

function getRandomJoke() {
  return jokes[Math.floor(Math.random() * jokes.length)];
}

function getRandomTrivia() {
  return triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
}

function checkTriviaAnswer(answer, userAnswer) {
  return userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
}

module.exports = {
  getRandomFact, getRandomQuote, getRandomCompliment,
  getRandomAdvice, getRandomJoke, getRandomTrivia, checkTriviaAnswer,
  facts, quotes, compliments, triviaQuestions,
};
