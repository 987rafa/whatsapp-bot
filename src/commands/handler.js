const { getContact, getAllContacts, getContactsByTag, tagContact, updateContactNotes } = require('../services/database');
const { handleGroupCommand } = require('../services/groups');
const { addScheduledMessage, deleteScheduledMessage, getScheduledMessages } = require('../services/database');
const { reloadScheduler } = require('../services/scheduler');
const { clearChat } = require('../services/ai');
const { clearMemory } = require('../services/memory');
const { getRandomFact, getRandomQuote, getRandomCompliment, getRandomAdvice, getRandomJoke } = require('../services/knowledge');
const { magic8ball, flipCoin, rollDice, startTrivia } = require('../services/games');
const { getWeather } = require('../services/weather');
const { addTodo, listTodos, toggleTodo, removeTodo } = require('../services/todo');
const { addExpense, listExpenses, getTodayTotal, getByCategory } = require('../services/expenses');
const { createPoll, getPoll, votePoll, getPollResults } = require('../services/polls');
const { getRules, addRule, removeRule, toggleRule } = require('../services/rules');
const { addBirthday, listBirthdays, removeBirthday } = require('../services/birthdays');
const { generatePassword, countdown, convertCurrency, getTopNews } = require('../services/utils');
const { imageToSticker } = require('../services/stickers');

const commands = new Map();

function register(name, handler) {
  commands.set(name.toLowerCase(), handler);
}

function getJid(msg) {
  return msg.key.remoteJid;
}

function getContactId(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  return sender.replace('@s.whatsapp.net', '');
}

register('ping', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: 'pong 🏓' }, { quoted: msg });
});

register('help', async (sock, msg) => {
  const isGroup = getJid(msg).includes('@g.us');
  let text = '🤖 *COMANDOS*\n\n';
  text += '▸ !ping | !say\n▸ !perfil | !tag | !nota | !contactos\n▸ !dato | !frase | !chiste | !consejo\n▸ !cumplido | !hora | !fecha\n▸ !8ball | !moneda | !dado | !trivia\n▸ !clima | !traduce | !calc\n▸ !password | !cuentaregresiva 2025/12/25\n▸ !convertir 100 USD COP\n▸ !recuerdame | !recordatorios\n▸ !dibuja <desc>\n▸ !noticias\n▸ !gasto 5000 uber | !gastos\n▸ !todo agregar/completar/listar/borrar\n▸ !cumpleaños Juan 15/06 | !cumples\n▸ !regla agregar/borrar/listar <trigger> <resp>\n▸ !encuesta ¿pregunta? | op1 | op2\n▸ !sticker (responde a imagen)\n▸ !reset\n';
  if (isGroup) text += '\n▸ !welcome | !antispam | !admin\n';
  text += '\n▸ !schedule add/list/remove';

  await sock.sendMessage(getJid(msg), { text }, { quoted: msg });
});

register('say', async (sock, msg, args) => {
  if (!args.length) return sock.sendMessage(getJid(msg), { text: 'Uso: !say <texto>' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: args.join(' ') }, { quoted: msg });
});

register('perfil', async (sock, msg) => {
  const contactId = getContactId(msg);
  const contact = getContact(contactId);
  if (!contact) return sock.sendMessage(getJid(msg), { text: 'Sin datos aún.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  const emoji = emojis[contact.tag] || '👤';
  await sock.sendMessage(getJid(msg), {
    text: `${emoji} *${contact.name || contactId}*\n🏷️ ${contact.tag || 'sin tag'}\n📊 ${contact.message_count} msgs\n🕐 ${contact.first_seen}\n📝 ${contact.notes || 'sin nota'}`,
  }, { quoted: msg });
});

register('tag', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const allowed = ['novia', 'amigo', 'familia', 'trabajo', 'extraño'];
  if (!sub || !allowed.includes(sub)) {
    return sock.sendMessage(getJid(msg), { text: `Uso: !tag <${allowed.join('|')}>\nEj: !tag novia\nEn grupo: !tag amigo @usuario` }, { quoted: msg });
  }
  const jid = getJid(msg);
  const isGroup = jid.includes('@g.us');
  if (isGroup && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const targetId = mentioned.replace('@s.whatsapp.net', '');
    const name = args.slice(1).join(' ') || targetId;
    tagContact(targetId, sub, name);
    await sock.sendMessage(jid, { text: `✅ @${targetId} → ${sub}`, mentions: [mentioned] }, { quoted: msg });
  } else {
    const contactId = getContactId(msg);
    const name = args.slice(1).join(' ') || contactId;
    tagContact(contactId, sub, name);
    await sock.sendMessage(jid, { text: `✅ Tag actualizado → ${sub}` }, { quoted: msg });
  }
});

register('nota', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !nota <texto>' }, { quoted: msg });
  updateContactNotes(getContactId(msg), text);
  await sock.sendMessage(getJid(msg), { text: '✅ Nota guardada.' }, { quoted: msg });
});

register('contactos', async (sock, msg, args) => {
  const tag = args[0]?.toLowerCase();
  const contacts = tag ? getContactsByTag(tag) : getAllContacts();
  if (!contacts.length) return sock.sendMessage(getJid(msg), { text: 'Sin contactos.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  let t = tag ? `📋 *${tag}s*\n\n` : '📋 *Contactos*\n\n';
  for (const c of contacts.slice(0, 20)) t += `${emojis[c.tag] || '👤'} ${c.name || c.id} (${c.message_count})\n`;
  if (contacts.length > 20) t += `\ny ${contacts.length - 20} más`;
  t += `\n\nTotal: ${contacts.length}`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
});

register('dato', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `🧠 ${getRandomFact()}` }, { quoted: msg });
});

register('frase', async (sock, msg) => {
  const q = getRandomQuote();
  await sock.sendMessage(getJid(msg), { text: `✨ "${q.text}"\n— ${q.author}` }, { quoted: msg });
});

register('chiste', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomJoke() }, { quoted: msg });
});

register('consejo', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `💡 ${getRandomAdvice()}` }, { quoted: msg });
});

register('cumplido', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomCompliment() }, { quoted: msg });
});

register('hora', async (sock, msg) => {
  const h = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  await sock.sendMessage(getJid(msg), { text: `🕐 Son las ${h}` }, { quoted: msg });
});

register('fecha', async (sock, msg) => {
  const d = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await sock.sendMessage(getJid(msg), { text: `📅 ${d}` }, { quoted: msg });
});

register('8ball', async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: magic8ball(args.join(' ')) }, { quoted: msg });
});

register('moneda', async (sock, msg) => {
  const { flipCoin } = require('../services/games');
  await sock.sendMessage(getJid(msg), { text: flipCoin() }, { quoted: msg });
});

register('dado', async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: rollDice(args[0]) }, { quoted: msg });
});

register('trivia', async (sock, msg) => {
  const contactId = getContactId(msg);
  const game = startTrivia(contactId);
  if (!game) return sock.sendMessage(getJid(msg), { text: 'Ya tienes una trivia activa.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: game }, { quoted: msg });
});

register('clima', async (sock, msg, args) => {
  const location = args.join(' ') || 'Bogotá';
  const report = await getWeather(location);
  if (report) {
    await sock.sendMessage(getJid(msg), { text: `🌤️ ${report}` }, { quoted: msg });
  } else {
    await sock.sendMessage(getJid(msg), { text: 'No encontré esa ubicación.' }, { quoted: msg });
  }
});

register('calc', async (sock, msg, args) => {
  const expr = args.join(' ');
  try {
    const result = eval(expr);
    await sock.sendMessage(getJid(msg), { text: `🧮 ${expr} = ${result}` }, { quoted: msg });
  } catch {
    await sock.sendMessage(getJid(msg), { text: '❌ Expresión inválida' }, { quoted: msg });
  }
});

register('olvidar', async (sock, msg) => {
  clearMemory(getContactId(msg));
  clearChat(getContactId(msg));
  await sock.sendMessage(getJid(msg), { text: '🗑️ Memoria borrada. Ahora no recuerdo nada de ti.' }, { quoted: msg });
});

register('reset', async (sock, msg) => {
  const cid = getContactId(msg);
  clearMemory(cid);
  clearChat(cid);
  await sock.sendMessage(getJid(msg), { text: 'Listo, empecemos de nuevo 👋' }, { quoted: msg });
});

register('traduce', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !traduce <texto>\nEj: !traduce Hello, how are you?' }, { quoted: msg });
  const { askGemini } = require('../services/ai');
  const resp = await askGemini('_translate', `Traduce al español de forma natural (solo la traducción, nada más): "${text}"`);
  await sock.sendMessage(getJid(msg), { text: resp || 'No pude traducirlo.' }, { quoted: msg });
});

register('dibuja', async (sock, msg, args) => {
  const desc = args.join(' ');
  if (!desc) return sock.sendMessage(getJid(msg), { text: 'Uso: !dibuja <descripción>\nEj: !dibuja un perro en la playa' }, { quoted: msg });
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
    const result = await model.generateContent(`Crea una imagen de: ${desc}. Estilo realista.`);
    const response = result.response;
    const imageData = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (imageData) {
      const { MessageMedia } = require('@whiskeysockets/baileys');
      const media = new MessageMedia(imageData.mimeType, imageData.data, 'imagen.png');
      await sock.sendMessage(getJid(msg), { image: Buffer.from(imageData.data, 'base64'), caption: `🎨 ${desc}` });
    } else {
      await sock.sendMessage(getJid(msg), { text: 'No pude generar esa imagen.' }, { quoted: msg });
    }
  } catch (err) {
    console.error('Error dibujando:', err.message);
    await sock.sendMessage(getJid(msg), { text: 'Error generando imagen.' }, { quoted: msg });
  }
});

register('recuerdame', async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !recuerdame <mensaje>\nEj: !recuerdame comprar pan' }, { quoted: msg });
  const { addReminder } = require('../services/database');
  const jid = getJid(msg);
  const cid = getContactId(msg);

  // Parse time: default 10 min
  let timeMatch = text.match(/(?:en\s+)?(\d+)\s*(min|minuto|minutos|h|hora|horas|seg|segundo|segundos)/i);
  let remindAt;
  if (timeMatch) {
    const num = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    const ms = unit.startsWith('h') ? num * 3600000 : unit.startsWith('s') ? num * 1000 : num * 60000;
    remindAt = new Date(Date.now() + ms).toISOString().replace('T', ' ').substring(0, 19);
  } else {
    remindAt = new Date(Date.now() + 600000).toISOString().replace('T', ' ').substring(0, 19);
  }

  addReminder(cid, jid, text, remindAt);
  await sock.sendMessage(jid, { text: `✅ Te recordaré: "${text}"` }, { quoted: msg });
});

register('recordatorios', async (sock, msg) => {
  const { getUserReminders } = require('../services/database');
  const reminders = getUserReminders(getContactId(msg));
  if (!reminders.length) return sock.sendMessage(getJid(msg), { text: 'Sin recordatorios pendientes.' }, { quoted: msg });
  let t = '⏰ *Recordatorios*\n\n';
  for (const r of reminders) t += `#${r.id} "${r.message}" — ${r.remind_at}\n`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
});

register('password', async (sock, msg, args) => {
  const len = parseInt(args[0]) || 12;
  await sock.sendMessage(getJid(msg), { text: `🔑 \`${generatePassword(len)}\`` }, { quoted: msg });
});

register('cuentaregresiva', async (sock, msg, args) => {
  const dateStr = args.join(' ');
  const match = dateStr.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (!match) return sock.sendMessage(getJid(msg), { text: 'Uso: !cuentaregresiva 2025/12/25' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: countdown(parseInt(match[1]), parseInt(match[2]), parseInt(match[3])) }, { quoted: msg });
});

register('convertir', async (sock, msg, args) => {
  const amount = parseFloat(args[0]);
  const from = args[1]?.toUpperCase();
  const to = args[2]?.toUpperCase();
  if (!amount || !from || !to) return sock.sendMessage(getJid(msg), { text: 'Uso: !convertir 100 USD COP' }, { quoted: msg });
  const result = await convertCurrency(amount, from, to);
  await sock.sendMessage(getJid(msg), { text: result || 'No pude convertir.' }, { quoted: msg });
});

register('noticias', async (sock, msg) => {
  const news = await getTopNews();
  const text = Array.isArray(news) ? news.join('\n') : news;
  await sock.sendMessage(getJid(msg), { text: text.substring(0, 1500) }, { quoted: msg });
});

register('gasto', async (sock, msg, args) => {
  const text = args.join(' ');
  const match = text.match(/(\d+[.]?\d*)\s*(.*)/);
  if (!match) return sock.sendMessage(getJid(msg), { text: 'Uso: !gasto 5000 uber' }, { quoted: msg });
  const amount = parseFloat(match[1]);
  const desc = match[2] || 'sin concepto';
  addExpense(getContactId(msg), amount, desc.split(' ')[0], desc);
  const total = getTodayTotal(getContactId(msg));
  await sock.sendMessage(getJid(msg), { text: `💸 Gastado: $${amount.toLocaleString()} en ${desc}\n💰 Hoy: $${total.toLocaleString()}` }, { quoted: msg });
});

register('gastos', async (sock, msg) => {
  const userId = getContactId(msg);
  const list = listExpenses(userId);
  const total = getTodayTotal(userId);
  const cats = getByCategory(userId);
  let t = `💸 *Gastos de hoy* — Total: $${total.toLocaleString()}\n\n`;
  for (const c of cats) t += `▸ ${c.category || 'sin categoría'}: $${c.total.toLocaleString()}\n`;
  t += '\n*Últimos:*\n';
  for (const e of list.slice(0, 5)) t += `• $${e.amount.toLocaleString()} - ${e.description}\n`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
});

register('todo', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const userId = getContactId(msg);
  if (sub === 'agregar' || sub === 'a' || sub === 'add') {
    const text = args.slice(1).join(' ');
    if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !todo agregar <tarea>' }, { quoted: msg });
    addTodo(userId, text);
    await sock.sendMessage(getJid(msg), { text: `✅ Tarea agregada: ${text}` }, { quoted: msg });
  } else if (sub === 'completar' || sub === 'c' || sub === 'done') {
    const id = parseInt(args[1]);
    if (!id || !toggleTodo(id, userId)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `✅ Tarea #${id} marcada como completada` }, { quoted: msg });
  } else if (sub === 'borrar' || sub === 'b' || sub === 'del' || sub === 'delete') {
    const id = parseInt(args[1]);
    if (!id || !removeTodo(id, userId)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `🗑️ Tarea #${id} eliminada` }, { quoted: msg });
  } else {
    const todos = listTodos(userId);
    if (!todos.length) return sock.sendMessage(getJid(msg), { text: 'Sin tareas pendientes.' }, { quoted: msg });
    let t = '📋 *Tareas*\n\n';
    for (const todo of todos) t += `${todo.done ? '✅' : '⬜'} #${todo.id} ${todo.text}\n`;
    await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
  }
});

register('cumpleaños', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const userId = getContactId(msg);
  if (sub === 'agregar' || (!sub?.match(/^\d/) && args.length >= 2)) {
    const offset = sub === 'agregar' ? 1 : 0;
    const name = args[offset];
    const dateMatch = args[offset + 1]?.match(/(\d{1,2})[\/-](\d{1,2})/);
    if (!name || !dateMatch) return sock.sendMessage(getJid(msg), { text: 'Uso: !cumpleaños Juan 15/06' }, { quoted: msg });
    addBirthday(userId, name, parseInt(dateMatch[1]), parseInt(dateMatch[2]));
    await sock.sendMessage(getJid(msg), { text: `✅ Cumpleaños de ${name}: ${dateMatch[1]}/${dateMatch[2]}` }, { quoted: msg });
  } else if (sub === 'borrar' || sub === 'delete' || sub === 'remove') {
    const id = parseInt(args[1]);
    if (!id || !removeBirthday(id, userId)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `🗑️ Cumpleaños #${id} eliminado` }, { quoted: msg });
  } else {
    const birthdays = listBirthdays(userId);
    if (!birthdays.length) return sock.sendMessage(getJid(msg), { text: 'Sin cumpleaños registrados.' }, { quoted: msg });
    let t = '🎂 *Cumpleaños*\n\n';
    for (const b of birthdays) t += `#${b.id} ${b.name}: ${b.day}/${String(b.month).padStart(2, '0')}\n`;
    await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
  }
});

register('cumples', async (sock, msg) => {
  const { getTodayBirthdays } = require('../services/birthdays');
  const today = getTodayBirthdays();
  if (!today.length) return;
  for (const b of today) {
    await sock.sendMessage(getJid(msg), { text: `🎂 ¡Hoy es el cumpleaños de ${b.name}! 🎉` });
  }
});

register('regla', async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const userId = getContactId(msg);
  if (sub === 'agregar' || sub === 'add') {
    const sep = args.indexOf('=>');
    if (sep === -1) return sock.sendMessage(getJid(msg), { text: 'Uso: !regla agregar <trigger> => <respuesta>' }, { quoted: msg });
    const trigger = args.slice(1, sep).join(' ');
    const response = args.slice(sep + 1).join(' ');
    if (!trigger || !response) return sock.sendMessage(getJid(msg), { text: 'Falta trigger o respuesta' }, { quoted: msg });
    addRule(userId, trigger, response);
    await sock.sendMessage(getJid(msg), { text: `✅ Regla: "${trigger}" → "${response}"` }, { quoted: msg });
  } else if (sub === 'borrar' || sub === 'delete') {
    const id = parseInt(args[1]);
    if (!id || !toggleRule(id, userId)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `🗑️ Regla #${id} eliminada` }, { quoted: msg });
  } else {
    const rules = getRules(userId);
    if (!rules.length) return sock.sendMessage(getJid(msg), { text: 'Sin reglas. Ej: !regla agregar hola => hola como estas' }, { quoted: msg });
    let t = '📜 *Reglas personalizadas*\n\n';
    for (const r of rules) t += `#${r.id} "${r.trigger}" → "${r.response}"\n`;
    await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
  }
});

register('encuesta', async (sock, msg, args) => {
  const text = args.join(' ');
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 3) return sock.sendMessage(getJid(msg), { text: 'Uso: !encuesta ¿pregunta? | op1 | op2 | op3' }, { quoted: msg });
  const question = parts[0];
  const options = parts.slice(1);
  const pollId = createPoll(getJid(msg), question, options, getContactId(msg));
  let r = `🗳️ *${question}*\n\n`;
  options.forEach((opt, i) => { r += `${i + 1}. ${opt}\n`; });
  r += `\nVota con: !votar ${pollId} <número>`;
  await sock.sendMessage(getJid(msg), { text: r }, { quoted: msg });
});

register('votar', async (sock, msg, args) => {
  const pollId = parseInt(args[0]);
  const option = parseInt(args[1]) - 1;
  if (!pollId || isNaN(option)) return sock.sendMessage(getJid(msg), { text: 'Uso: !votar <id> <número>' }, { quoted: msg });
  const result = votePoll(pollId, option, getContactId(msg));
  if (result === 'no-existe') return sock.sendMessage(getJid(msg), { text: 'Esa encuesta no existe.' }, { quoted: msg });
  if (result === 'ya-voto') return sock.sendMessage(getJid(msg), { text: 'Ya votaste en esta encuesta.' }, { quoted: msg });
  if (result === 'invalido') return sock.sendMessage(getJid(msg), { text: 'Opción inválida.' }, { quoted: msg });
  const poll = getPoll(pollId);
  await sock.sendMessage(getJid(msg), { text: getPollResults(poll) }, { quoted: msg });
});

register('resultados', async (sock, msg, args) => {
  const pollId = parseInt(args[0]);
  if (!pollId) return sock.sendMessage(getJid(msg), { text: 'Uso: !resultados <id_encuesta>' }, { quoted: msg });
  const poll = getPoll(pollId);
  if (!poll) return sock.sendMessage(getJid(msg), { text: 'Encuesta no encontrada.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: getPollResults(poll) }, { quoted: msg });
});

register('sticker', async (sock, msg) => {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted?.imageMessage) return sock.sendMessage(getJid(msg), { text: 'Responde a una imagen con !sticker' }, { quoted: msg });

  // Reconstruct quoted msg for downloadMediaMessage
  const { downloadMediaMessage } = require('@whiskeysockets/baileys');
  const quotedMsg = {
    key: { remoteJid: getJid(msg), fromMe: false, id: msg.message.extendedTextMessage.contextInfo.stanzaId },
    message: { imageMessage: quoted.imageMessage },
  };

  const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: undefined });
  if (!buffer) return sock.sendMessage(getJid(msg), { text: 'No pude descargar la imagen.' }, { quoted: msg });

  const sharp = require('sharp');
  const fs = require('fs');
  const path = require('path');
  const tmp = path.join(__dirname, '../../data/temp');
  fs.mkdirSync(tmp, { recursive: true });
  const inp = path.join(tmp, `si_${Date.now()}.webp`);
  const out = path.join(tmp, `so_${Date.now()}.webp`);
  fs.writeFileSync(inp, buffer);
  await sharp(inp).resize(512, 512, { fit: 'cover' }).webp({ quality: 80 }).toFile(out);
  const stickerBuf = fs.readFileSync(out);
  fs.unlinkSync(inp); fs.unlinkSync(out);
  await sock.sendMessage(getJid(msg), { sticker: stickerBuf }, { quoted: msg });
});

register('schedule', async (sock, msg, args) => {
  const jid = getJid(msg);
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const cronExpr = args[1];
    const message = args.slice(2).join(' ');
    if (!cronExpr || !message) return sock.sendMessage(jid, { text: 'Uso: !schedule add "<cron>" <msg>' }, { quoted: msg });
    const result = addScheduledMessage(jid, message, cronExpr);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Programado #${result.lastInsertRowid}` }, { quoted: msg });
  } else if (sub === 'list') {
    const msgs = getScheduledMessages().filter(m => m.chat_id === jid);
    if (!msgs.length) return sock.sendMessage(jid, { text: 'Sin programados.' }, { quoted: msg });
    let t = '📅 *Programados*\n\n';
    for (const m of msgs) t += `#${m.id} \`${m.cron_expression}\`\n${m.message}\n\n`;
    await sock.sendMessage(jid, { text: t }, { quoted: msg });
  } else if (sub === 'remove') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return sock.sendMessage(jid, { text: 'Uso: !schedule remove <id>' }, { quoted: msg });
    deleteScheduledMessage(id);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ Eliminado #${id}` }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: '⏰ !schedule add "<cron>" <msg>\n!schedule list\n!schedule remove <id>' }, { quoted: msg });
  }
});

async function processCommand(sock, msg, body) {
  const parts = body.slice(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (msg.key.remoteJid?.includes('@g.us')) {
    const handled = await handleGroupCommand(sock, msg, commandName, args);
    if (handled) return;
  }

  const handler = commands.get(commandName);
  if (handler) {
    try {
      await handler(sock, msg, args);
    } catch (err) {
      console.error(`Error !${commandName}:`, err);
      await sock.sendMessage(getJid(msg), { text: `Error en !${commandName}` }, { quoted: msg });
    }
  } else {
    await sock.sendMessage(getJid(msg), { text: `❌ !${commandName} no existe. Usa !help` }, { quoted: msg });
  }
}

module.exports = { processCommand, register };
