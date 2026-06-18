const axios = require('axios');

function generatePassword(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

function countdown(year, month, day) {
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const diff = target - now;
  if (diff < 0) return 'Esa fecha ya pasó 📅';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `⏳ Faltan ${days} días, ${hours}h y ${minutes}min`;
}

async function convertCurrency(amount, from, to) {
  try {
    const { data } = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`, { timeout: 5000 });
    const rate = data.rates[to.toUpperCase()];
    if (!rate) return null;
    const result = (amount * rate).toFixed(2);
    return `${amount} ${from.toUpperCase()} = ${result} ${to.toUpperCase()}`;
  } catch {
    return null;
  }
}

async function getTopNews() {
  try {
    const { data } = await axios.get('https://gnews.io/api/v4/top-headlines?lang=es&country=co&max=5&token=' + (process.env.GNEWS_API_KEY || ''), { timeout: 5000 });
    if (!data.articles?.length) {
      // Fallback: RSS
      return [
        '📰 *Noticias destacadas:*\n\n' +
        '1. No se pudieron cargar las noticias.\n' +
        '2. Configura GNEWS_API_KEY para noticias.\n' +
        '3. .\n' +
        '4. .\n' +
        '5. .'
      ];
    }
    return data.articles.map((a, i) =>
      `${i + 1}. *${a.title}*\n${a.description || ''}\n`
    );
  } catch {
    return ['No pude cargar noticias ahora.'];
  }
}

module.exports = { generatePassword, countdown, convertCurrency, getTopNews };
