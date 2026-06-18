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

const OWNER = '573507927769';
const commands = new Map();
const commandCategories = { owner: [], public: [], group: [] };

function isOwner(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  return sender.replace('@s.whatsapp.net', '') === OWNER;
}

function register(name, handler, category = 'public') {
  commands.set(name.toLowerCase(), handler);
  if (commandCategories[category]) commandCategories[category].push(name);
}

function getJid(msg) { return msg.key.remoteJid; }
function getContactId(msg) {
  const sender = msg.key.participant || msg.key.remoteJid;
  return sender.replace('@s.whatsapp.net', '');
}

// ==================== PUBLIC COMMANDS ====================

register('ping', async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: '🏓' }, { quoted: msg });
}, 'public');

register('say', async (sock, msg, args) => {
  if (!args.length) return sock.sendMessage(getJid(msg), { text: 'Uso: !say <texto>' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: args.join(' ') }, { quoted: msg });
}, 'public');

register('info', async (sock, msg) => {
  const jid = getJid(msg);
  const sender = msg.key.participant || jid;
  await sock.sendMessage(jid, {
    text: `👤 *ID:* ${sender.split('@')[0]}\n💬 *Chat:* ${jid.includes('@g.us') ? 'Grupo' : 'Privado'}`,
  }, { quoted: msg });
}, 'public');

register('sticker', async (sock, msg) => {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted?.imageMessage) return sock.sendMessage(getJid(msg), { text: 'Responde a una imagen con !sticker' }, { quoted: msg });
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
}, 'public');

register('encuesta', async (sock, msg, args) => {
  const text = args.join(' ');
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 3) return sock.sendMessage(getJid(msg), { text: 'Uso: !encuesta ¿pregunta? | op1 | op2' }, { quoted: msg });
  const pollId = createPoll(getJid(msg), parts[0], parts.slice(1), getContactId(msg));
  let r = `🗳️ *${parts[0]}*\n\n`;
  parts.slice(1).forEach((opt, i) => { r += `${i + 1}. ${opt}\n`; });
  r += `\nVota: !votar ${pollId} <n>`;
  await sock.sendMessage(getJid(msg), { text: r }, { quoted: msg });
}, 'public');

register('votar', async (sock, msg, args) => {
  const pollId = parseInt(args[0]);
  const option = parseInt(args[1]) - 1;
  if (!pollId || isNaN(option)) return sock.sendMessage(getJid(msg), { text: 'Uso: !votar <id> <n>' }, { quoted: msg });
  const result = votePoll(pollId, option, getContactId(msg));
  if (result === 'no-existe') return sock.sendMessage(getJid(msg), { text: 'Esa encuesta no existe.' }, { quoted: msg });
  if (result === 'ya-voto') return sock.sendMessage(getJid(msg), { text: 'Ya votaste.' }, { quoted: msg });
  if (result === 'invalido') return sock.sendMessage(getJid(msg), { text: 'Opción inválida.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: getPollResults(getPoll(pollId)) }, { quoted: msg });
}, 'public');

register('resultados', async (sock, msg, args) => {
  const pollId = parseInt(args[0]);
  if (!pollId) return sock.sendMessage(getJid(msg), { text: 'Uso: !resultados <id>' }, { quoted: msg });
  const poll = getPoll(pollId);
  if (!poll) return sock.sendMessage(getJid(msg), { text: 'No encontrada.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: getPollResults(poll) }, { quoted: msg });
}, 'public');

register('reset', async (sock, msg) => {
  const cid = getContactId(msg);
  clearMemory(cid);
  clearChat(cid);
  await sock.sendMessage(getJid(msg), { text: 'Listo, empecemos de nuevo 👋' }, { quoted: msg });
}, 'public');

// ==================== OWNER-ONLY COMMANDS ====================

function ownerOnly(handler) {
  return async (sock, msg, args) => {
    if (!isOwner(msg)) {
      await sock.sendMessage(getJid(msg), { text: '❌ Este comando solo está disponible para el dueño del bot.' }, { quoted: msg });
      return;
    }
    await handler(sock, msg, args);
  };
}

register('help', async (sock, msg) => {
  const isGroup = getJid(msg).includes('@g.us');

  if (isOwner(msg)) {
    let t = '🤖 *Panel de control*\n\n';

    t += '═══ *BÁSICOS* ═══\n';
    t += '▸ !ping | !say | !info | !reset\n';
    t += '▸ !sticker (responde a imagen)\n\n';

    t += '═══ *CONOCIMIENTO* ═══\n';
    t += '▸ !dato | !frase | !chiste | !consejo | !cumplido\n';
    t += '▸ !hora | !fecha | !clima <ciudad>\n';
    t += '▸ !traduce <texto> | !calc <expr>\n';
    t += '▸ !convertir 100 USD COP\n';
    t += '▸ !noticias | !password | !cuentaregresiva 2025/12/25\n\n';

    t += '═══ *JUEGOS* ═══\n';
    t += '▸ !8ball <preg> | !moneda | !dado | !trivia\n\n';

    t += '═══ *CONTACTOS* ═══\n';
    t += '▸ !tag novia/amigo/familia | !perfil | !nota\n';
    t += '▸ !contactos\n\n';

    t += '═══ *PERSONAL* ═══\n';
    t += '▸ !gasto 5000 uber | !gastos\n';
    t += '▸ !todo agregar/listar/completar/borrar\n';
    t += '▸ !recuerdame <msg> | !recordatorios\n';
    t += '▸ !cumpleaños Juan 15/06 | !cumples\n';
    t += '▸ !regla agregar <trigger> => <resp>\n';
    t += '▸ !dibuja <descripción>\n';
    t += '▸ !schedule add/list/remove\n\n';

    if (isGroup) {
      t += '═══ *GRUPO* ═══\n';
      t += '▸ !encuesta ¿preg? | op1 | op2\n';
      t += '▸ !votar <id> <n> | !resultados <id>\n';
      t += '▸ !welcome on/off | !antispam on/off\n';
      t += '▸ !admin add/remove\n';
      t += '🚫 Anti-delete automático\n';
    }

    t += '\n💬 *Cualquier mensaje* → IA responde automáticamente';
    await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
  } else {
    let t = '🤖 *Comandos públicos*\n\n';
    t += '▸ !ping | !info | !sticker\n';
    t += '▸ !encuesta | !votar | !resultados\n';
    t += '▸ !reset\n';
    if (isGroup) {
      t += '\nEl bot conversa naturalmente en este grupo 🤙';
    }
    await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
  }
}, 'public');

register('perfil', ownerOnly(async (sock, msg) => {
  const contact = getContact(getContactId(msg));
  if (!contact) return sock.sendMessage(getJid(msg), { text: 'Sin datos.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  await sock.sendMessage(getJid(msg), {
    text: `${emojis[contact.tag] || '👤'} *${contact.name || contact.id}*\n🏷️ ${contact.tag || 'sin tag'}\n📊 ${contact.message_count} msgs\n📝 ${contact.notes || 'sin nota'}`,
  }, { quoted: msg });
}));

register('tag', ownerOnly(async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const allowed = ['novia', 'amigo', 'familia', 'trabajo', 'extraño'];
  if (!sub || !allowed.includes(sub)) {
    return sock.sendMessage(getJid(msg), { text: `Uso: !tag <${allowed.join('|')}>` }, { quoted: msg });
  }
  const jid = getJid(msg);
  if (jid.includes('@g.us') && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    const m = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    const tid = m.replace('@s.whatsapp.net', '');
    tagContact(tid, sub, args.slice(1).join(' ') || tid);
    await sock.sendMessage(jid, { text: `✅ @${tid} → ${sub}`, mentions: [m] }, { quoted: msg });
  } else {
    tagContact(getContactId(msg), sub, args.slice(1).join(' ') || getContactId(msg));
    await sock.sendMessage(jid, { text: `✅ Tag → ${sub}` }, { quoted: msg });
  }
}));

register('nota', ownerOnly(async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !nota <texto>' }, { quoted: msg });
  updateContactNotes(getContactId(msg), text);
  await sock.sendMessage(getJid(msg), { text: '✅ Nota guardada.' }, { quoted: msg });
}));

register('contactos', ownerOnly(async (sock, msg, args) => {
  const tag = args[0]?.toLowerCase();
  const contacts = tag ? getContactsByTag(tag) : getAllContacts();
  if (!contacts.length) return sock.sendMessage(getJid(msg), { text: 'Sin contactos.' }, { quoted: msg });
  const emojis = { novia: '💕', amigo: '🤙', familia: '👨‍👩‍👧‍👦', trabajo: '💼', extraño: '❓' };
  let t = tag ? `📋 *${tag}s*\n\n` : '📋 *Contactos*\n\n';
  for (const c of contacts.slice(0, 30)) t += `${emojis[c.tag] || '👤'} ${c.name || c.id} (${c.message_count})\n`;
  if (contacts.length > 30) t += `\ny ${contacts.length - 30} más`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
}));

register('dato', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `🧠 ${getRandomFact()}` }, { quoted: msg });
}));
register('frase', ownerOnly(async (sock, msg) => {
  const q = getRandomQuote();
  await sock.sendMessage(getJid(msg), { text: `✨ "${q.text}"\n— ${q.author}` }, { quoted: msg });
}));
register('chiste', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomJoke() }, { quoted: msg });
}));
register('consejo', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `💡 ${getRandomAdvice()}` }, { quoted: msg });
}));
register('cumplido', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: getRandomCompliment() }, { quoted: msg });
}));
register('hora', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: `🕐 ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` }, { quoted: msg });
}));
register('fecha', ownerOnly(async (sock, msg) => {
  const d = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await sock.sendMessage(getJid(msg), { text: `📅 ${d}` }, { quoted: msg });
}));

register('8ball', ownerOnly(async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: magic8ball(args.join(' ')) }, { quoted: msg });
}));
register('moneda', ownerOnly(async (sock, msg) => {
  await sock.sendMessage(getJid(msg), { text: flipCoin() }, { quoted: msg });
}));
register('dado', ownerOnly(async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: rollDice(args[0]) }, { quoted: msg });
}));
register('trivia', ownerOnly(async (sock, msg) => {
  const g = startTrivia(getContactId(msg));
  if (!g) return sock.sendMessage(getJid(msg), { text: 'Ya tienes una trivia activa.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: g }, { quoted: msg });
}));

register('clima', ownerOnly(async (sock, msg, args) => {
  const location = args.join(' ') || 'Bogotá';
  const report = await getWeather(location);
  await sock.sendMessage(getJid(msg), { text: `🌤️ ${report || 'No encontrado.'}` }, { quoted: msg });
}));

register('calc', ownerOnly(async (sock, msg, args) => {
  try {
    await sock.sendMessage(getJid(msg), { text: `🧮 ${args.join(' ')} = ${eval(args.join(' '))}` }, { quoted: msg });
  } catch {
    await sock.sendMessage(getJid(msg), { text: '❌ Expresión inválida' }, { quoted: msg });
  }
}));

register('traduce', ownerOnly(async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !traduce <texto>' }, { quoted: msg });
  const { askGemini } = require('../services/ai');
  const resp = await askGemini('_translate', `Traduce al español natural (solo traducción): "${text}"`);
  await sock.sendMessage(getJid(msg), { text: resp || 'No pude.' }, { quoted: msg });
}));

register('dibuja', ownerOnly(async (sock, msg, args) => {
  const desc = args.join(' ');
  if (!desc) return sock.sendMessage(getJid(msg), { text: 'Uso: !dibuja <desc>' }, { quoted: msg });
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDIE6VHUg6AT1XPsq2Wfn7oqbqkG4ksPc8');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
    const result = await model.generateContent(`Crea: ${desc}`);
    const d = result.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (d) await sock.sendMessage(getJid(msg), { image: Buffer.from(d.data, 'base64'), caption: `🎨 ${desc}` });
    else await sock.sendMessage(getJid(msg), { text: 'No pude generar.' }, { quoted: msg });
  } catch (err) {
    await sock.sendMessage(getJid(msg), { text: 'Error generando imagen.' }, { quoted: msg });
  }
}));

register('recuerdame', ownerOnly(async (sock, msg, args) => {
  const text = args.join(' ');
  if (!text) return sock.sendMessage(getJid(msg), { text: 'Uso: !recuerdame <msg>' }, { quoted: msg });
  const { addReminder } = require('../services/database');
  const jid = getJid(msg);
  const cid = getContactId(msg);
  const tm = text.match(/(?:en\s+)?(\d+)\s*(min|h|seg)/i);
  const ms = tm ? (tm[2].startsWith('h') ? parseInt(tm[1]) * 3600000 : tm[2].startsWith('s') ? parseInt(tm[1]) * 1000 : parseInt(tm[1]) * 60000) : 600000;
  const at = new Date(Date.now() + ms).toISOString().replace('T', ' ').substring(0, 19);
  addReminder(cid, jid, text, at);
  await sock.sendMessage(jid, { text: `✅ Te recordaré: "${text}"` }, { quoted: msg });
}));

register('recordatorios', ownerOnly(async (sock, msg) => {
  const { getUserReminders } = require('../services/database');
  const r = getUserReminders(getContactId(msg));
  if (!r.length) return sock.sendMessage(getJid(msg), { text: 'Sin recordatorios.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: '⏰ *Recordatorios*\n\n' + r.map(x => `#${x.id} "${x.message}"`).join('\n') }, { quoted: msg });
}));

register('password', ownerOnly(async (sock, msg, args) => {
  await sock.sendMessage(getJid(msg), { text: `🔑 \`${generatePassword(parseInt(args[0]) || 12)}\`` }, { quoted: msg });
}));

register('cuentaregresiva', ownerOnly(async (sock, msg, args) => {
  const m = args.join(' ').match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (!m) return sock.sendMessage(getJid(msg), { text: 'Uso: !cuentaregresiva 2025/12/25' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: countdown(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])) }, { quoted: msg });
}));

register('convertir', ownerOnly(async (sock, msg, args) => {
  const amt = parseFloat(args[0]);
  if (!amt || !args[1] || !args[2]) return sock.sendMessage(getJid(msg), { text: 'Uso: !convertir 100 USD COP' }, { quoted: msg });
  const r = await convertCurrency(amt, args[1], args[2]);
  await sock.sendMessage(getJid(msg), { text: r || 'No pude.' }, { quoted: msg });
}));

register('noticias', ownerOnly(async (sock, msg) => {
  const n = await getTopNews();
  await sock.sendMessage(getJid(msg), { text: (Array.isArray(n) ? n.join('\n') : n).substring(0, 1500) }, { quoted: msg });
}));

register('gasto', ownerOnly(async (sock, msg, args) => {
  const m = args.join(' ').match(/(\d+[.]?\d*)\s*(.*)/);
  if (!m) return sock.sendMessage(getJid(msg), { text: 'Uso: !gasto 5000 uber' }, { quoted: msg });
  addExpense(getContactId(msg), parseFloat(m[1]), m[2].split(' ')[0], m[2]);
  await sock.sendMessage(getJid(msg), { text: `💸 $${parseFloat(m[1]).toLocaleString()} en ${m[2]}\n💰 Hoy: $${getTodayTotal(getContactId(msg)).toLocaleString()}` }, { quoted: msg });
}));

register('gastos', ownerOnly(async (sock, msg) => {
  const uid = getContactId(msg);
  const cats = getByCategory(uid);
  const items = listExpenses(uid);
  let t = `💸 *Gastos de hoy* — Total: $${getTodayTotal(uid).toLocaleString()}\n\n`;
  for (const c of cats) t += `▸ ${c.category || '? '}: $${c.total.toLocaleString()}\n`;
  t += '\n*Últimos:*\n';
  for (const e of items.slice(0, 5)) t += `• $${e.amount.toLocaleString()} - ${e.description}\n`;
  await sock.sendMessage(getJid(msg), { text: t }, { quoted: msg });
}));

register('todo', ownerOnly(async (sock, msg, args) => {
  const sub = args[0]?.toLowerCase();
  const uid = getContactId(msg);
  if (sub === 'agregar' || sub === 'a') {
    const t = args.slice(1).join(' ');
    if (!t) return sock.sendMessage(getJid(msg), { text: 'Uso: !todo agregar <tarea>' }, { quoted: msg });
    addTodo(uid, t);
    await sock.sendMessage(getJid(msg), { text: `✅ ${t}` }, { quoted: msg });
  } else if (sub === 'completar' || sub === 'c') {
    const id = parseInt(args[1]);
    if (!id || !toggleTodo(id, uid)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `✅ Tarea #${id} completada` }, { quoted: msg });
  } else if (sub === 'borrar' || sub === 'b') {
    const id = parseInt(args[1]);
    if (!id || !removeTodo(id, uid)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `🗑️ #${id} eliminada` }, { quoted: msg });
  } else {
    const todos = listTodos(uid);
    if (!todos.length) return sock.sendMessage(getJid(msg), { text: 'Sin tareas.' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: '📋 *Tareas*\n\n' + todos.map(x => `${x.done ? '✅' : '⬜'} #${x.id} ${x.text}`).join('\n') }, { quoted: msg });
  }
}));

register('cumpleaños', ownerOnly(async (sock, msg, args) => {
  const uid = getContactId(msg);
  const m = args.join(' ').match(/(\w+)\s+(\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    addBirthday(uid, m[1], parseInt(m[2]), parseInt(m[3]));
    await sock.sendMessage(getJid(msg), { text: `✅ ${m[1]}: ${m[2]}/${m[3]}` }, { quoted: msg });
  } else {
    const b = listBirthdays(uid);
    if (!b.length) return sock.sendMessage(getJid(msg), { text: 'Uso: !cumpleaños Juan 15/06' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: '🎂 *Cumpleaños*\n\n' + b.map(x => `#${x.id} ${x.name}: ${x.day}/${String(x.month).padStart(2, '0')}`).join('\n') }, { quoted: msg });
  }
}));

register('cumples', ownerOnly(async (sock, msg) => {
  const b = listBirthdays(getContactId(msg));
  if (!b.length) return sock.sendMessage(getJid(msg), { text: 'Sin cumpleaños.' }, { quoted: msg });
  await sock.sendMessage(getJid(msg), { text: '🎂 *Cumpleaños*\n\n' + b.map(x => `#${x.id} ${x.name}: ${x.day}/${String(x.month).padStart(2, '0')}`).join('\n') }, { quoted: msg });
}));

register('regla', ownerOnly(async (sock, msg, args) => {
  const uid = getContactId(msg);
  const sub = args[0]?.toLowerCase();
  if (sub === 'agregar') {
    const sep = args.indexOf('=>');
    if (sep === -1) return sock.sendMessage(getJid(msg), { text: 'Uso: !regla agregar hola => hola como vas' }, { quoted: msg });
    const trigger = args.slice(1, sep).join(' ');
    const response = args.slice(sep + 1).join(' ');
    if (!trigger || !response) return sock.sendMessage(getJid(msg), { text: 'Falta trigger o respuesta' }, { quoted: msg });
    addRule(uid, trigger, response);
    await sock.sendMessage(getJid(msg), { text: `✅ "${trigger}" → "${response}"` }, { quoted: msg });
  } else if (sub === 'borrar') {
    const id = parseInt(args[1]);
    if (!id || !removeRule(id, uid)) return sock.sendMessage(getJid(msg), { text: 'ID inválido' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: `🗑️ Regla #${id}` }, { quoted: msg });
  } else {
    const r = getRules(uid);
    if (!r.length) return sock.sendMessage(getJid(msg), { text: 'Sin reglas. Ej: !regla agregar hola => hola como estas' }, { quoted: msg });
    await sock.sendMessage(getJid(msg), { text: '📜 *Reglas*\n\n' + r.map(x => `#${x.id} "${x.trigger}" → "${x.response}"`).join('\n') }, { quoted: msg });
  }
}));

register('schedule', ownerOnly(async (sock, msg, args) => {
  const jid = getJid(msg);
  const sub = args[0]?.toLowerCase();
  if (sub === 'add') {
    const c = args[1];
    const m = args.slice(2).join(' ');
    if (!c || !m) return sock.sendMessage(jid, { text: 'Uso: !schedule add "<cron>" <msg>' }, { quoted: msg });
    const r = addScheduledMessage(jid, m, c);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ #${r.lastInsertRowid}` }, { quoted: msg });
  } else if (sub === 'list') {
    const msgs = getScheduledMessages().filter(x => x.chat_id === jid);
    if (!msgs.length) return sock.sendMessage(jid, { text: 'Sin programados.' }, { quoted: msg });
    await sock.sendMessage(jid, { text: '📅 *Programados*\n\n' + msgs.map(x => `#${x.id} \`${x.cron_expression}\`\n${x.message}`).join('\n\n') }, { quoted: msg });
  } else if (sub === 'remove') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return sock.sendMessage(jid, { text: 'Uso: !schedule remove <id>' }, { quoted: msg });
    deleteScheduledMessage(id);
    reloadScheduler(sock);
    await sock.sendMessage(jid, { text: `✅ #${id} eliminado` }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: '⏰ !schedule add "<cron>" <msg>\n!schedule list\n!schedule remove <id>' }, { quoted: msg });
  }
}));

// ==================== PROCESSOR ====================

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
      if (isOwner(msg) || msg.key.remoteJid?.includes('@g.us')) {
        await sock.sendMessage(getJid(msg), { text: `❌ Error en !${commandName}` }, { quoted: msg });
      }
    }
  } else {
    /* silent ignore for unknown commands from non-owners */
    if (isOwner(msg)) {
      await sock.sendMessage(getJid(msg), { text: `❌ !${commandName} no existe. Usa !help` }, { quoted: msg });
    }
  }
}

module.exports = { processCommand, register };
