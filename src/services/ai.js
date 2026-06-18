const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8';
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL = 'gemini-2.0-flash';

const chatSessions = new Map();

async function askGemini(userId, fullPrompt, tag) {
  try {
    if (!chatSessions.has(userId)) {
      const model = genAI.getGenerativeModel({ model: MODEL });
      const chat = model.startChat({ history: [] });
      chatSessions.set(userId, chat);
    }

    const chat = chatSessions.get(userId);
    const result = await chat.sendMessage(fullPrompt);
    let response = result.response.text();

    response = response
      .replace(/^\[.*?\]\s*/g, '')
      .replace(/^(?:Yo|Mi respuesta|Respuesta|Bot|Asistente|AI|IA)[\s:.-]*/i, '')
      .replace(/^"(.*)"$/, '$1')
      .trim();

    if (response.length > 400) {
      response = response.substring(0, 397) + '...';
    }

    return response;
  } catch (err) {
    console.error('Gemini error:', err.message);
    if (err.message?.includes('SAFETY') || err.message?.includes('safety')) {
      return '?';
    }
    return null;
  }
}

function clearChat(userId) {
  chatSessions.delete(userId);
}

module.exports = { askGemini, clearChat };
