const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8';
const genAI = new GoogleGenerativeAI(API_KEY);

// Each user gets their own chat session for context
const chatSessions = new Map();

async function askGemini(userId, fullPrompt, tag) {
  try {
    if (!chatSessions.has(userId)) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: 'Eres un amigo/conocido conversando por WhatsApp. Habla natural, como cualquier persona. Sin formalidades. NO digas que eres IA ni bot.' }],
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido, claro.' }],
          },
        ],
      });
      chatSessions.set(userId, chat);
    }

    const chat = chatSessions.get(userId);
    const result = await chat.sendMessage(fullPrompt);
    let response = result.response.text();

    // Clean up response
    response = response
      .replace(/^(?:Yo|Mi)\s+(?:respuesta|contestación|reply|response)\s*(?::|\.)?\s*/i, '')
      .replace(/^"(.*)"$/, '$1')
      .replace(/^(?:Bot|Asistente|AI|IA)\s*(?::|\.)?\s*/i, '')
      .trim();

    // Max 400 chars for chat
    if (response.length > 400) {
      response = response.substring(0, 397) + '...';
    }

    return response;
  } catch (err) {
    console.error('Gemini error:', err.message);
    return null;
  }
}

function clearChat(userId) {
  chatSessions.delete(userId);
}

module.exports = { askGemini, clearChat };
