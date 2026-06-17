const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY || '';
let model = null;
let chatSessions = new Map();

if (API_KEY) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    systemInstruction: `Eres un asistente personal de WhatsApp. 
- Respondes en español de forma natural y breve (máximo 3 oraciones).
- Eres amigable, cálido y usas emojis ocasionalmente.
- Si te preguntan algo que no sabes, dilo con honestidad.
- Nunca inventes información.
- Adaptas tu tono según la etiqueta del usuario: si es "novia" eres cariñoso, si es "amigo" eres relajado, si es "familia" respetuoso, si no tiene etiqueta eres neutral y amigable.`,
  });
}

async function askGemini(userId, message, tag) {
  if (!model) return null;

  try {
    if (!chatSessions.has(userId)) {
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: `Mi etiqueta es: ${tag || 'ninguna'}` }] },
          { role: 'model', parts: [{ text: `Entendido, gracias.` }] },
        ],
      });
      chatSessions.set(userId, chat);
    }

    const chat = chatSessions.get(userId);
    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return response.substring(0, 500);
  } catch (err) {
    console.error('❌ Gemini error:', err.message);
    return null;
  }
}

function clearChat(userId) {
  chatSessions.delete(userId);
}

module.exports = { askGemini, clearChat };
