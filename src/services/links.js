const axios = require('axios');
const cheerio = require('cheerio');
const urlModule = require('url');

const urlRegex = /https?:\/\/[^\s<>"']+/gi;

function extractUrls(text) {
  return text.match(urlRegex) || [];
}

async function scrapeLink(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });

    const $ = cheerio.load(data);

    const title = $('meta[property="og:title"]').attr('content')
      || $('meta[name="twitter:title"]').attr('content')
      || $('title').text()
      || '';

    const description = $('meta[property="og:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || '';

    const siteName = $('meta[property="og:site_name"]').attr('content')
      || new URL(url).hostname.replace('www.', '');

    const image = $('meta[property="og:image"]').attr('content') || '';

    const cleanTitle = title.substring(0, 120);
    const cleanDesc = description.substring(0, 200);

    let result = `🔗 *${cleanTitle}*\n📰 ${siteName}`;
    if (cleanDesc) result += `\n\n${cleanDesc}`;

    return result;
  } catch (err) {
    return null;
  }
}

module.exports = { extractUrls, scrapeLink };
