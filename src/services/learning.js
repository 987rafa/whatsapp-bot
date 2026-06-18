const { db } = require('./database');

db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    tone TEXT DEFAULT 'neutral',
    interests TEXT DEFAULT '',
    common_phrases TEXT DEFAULT '[]',
    history TEXT DEFAULT '',
    conversation_count INTEGER DEFAULT 0,
    last_topic TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const stmts = {
  getProfile: db.prepare('SELECT * FROM user_profiles WHERE id = ?'),
  upsertProfile: db.prepare(`
    INSERT INTO user_profiles (id, name, tag, tone, interests, common_phrases, history, conversation_count, last_topic, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(NULLIF(?, ''), name),
      tag = COALESCE(NULLIF(?, ''), tag),
      tone = COALESCE(NULLIF(?, ''), tone),
      interests = COALESCE(NULLIF(?, ''), interests),
      common_phrases = CASE WHEN ? IS NOT NULL AND ? != '[]' THEN ? ELSE common_phrases END,
      history = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE history END,
      conversation_count = conversation_count + 1,
      last_topic = COALESCE(NULLIF(?, ''), last_topic),
      updated_at = datetime('now')
  `),
  getAllProfiles: db.prepare('SELECT id, name, tag, tone, conversation_count, updated_at FROM user_profiles ORDER BY updated_at DESC'),
};

function getProfile(userId) {
  return stmts.getProfile.get(userId);
}

function updateProfile(userId, data) {
  const current = getProfile(userId) || { name: '', tag: '', tone: 'neutral', interests: '', common_phrases: '[]', history: '', last_topic: '' };

  const newName = data.name ?? current.name;
  const newTag = data.tag ?? current.tag;
  const newTone = data.tone ?? current.tone;
  const newInterests = data.interests ?? current.interests;
  const newHistory = data.history ? `${current.history ? current.history + '\n' : ''}${data.history}` : current.history;
  const newTopic = data.last_topic ?? current.last_topic;

  stmts.upsertProfile.run(
    userId, newName, newTag, newTone, newInterests,
    current.common_phrases, newHistory, newTopic,
    newName || null, newTag || null, newTone || null, newInterests || null,
    data.common_phrases || null, data.common_phrases || null, data.common_phrases || null,
    data.history || null, data.history || null, data.history || null,
    newTopic || null
  );
}

function analyzeMessage(userId, text, currentProfile) {
  const lower = text.toLowerCase();
  const updates = {};

  // Detect name if presented
  const soyMatch = lower.match(/soy\s+(\w+)|me\s+llamo\s+(\w+)|llámame\s+(\w+)|mi\s+nombre\s+es\s+(\w+)/i);
  if (soyMatch) {
    updates.name = soyMatch[1] || soyMatch[2] || soyMatch[3] || soyMatch[4];
  }

  // Detect tone
  const positiveWords = ['jaja', 'jajaja', 'lol', 'xddd', 'feliz', 'alegre', 'bueno', 'genial', 'excelente', 'me encanta', 'me gusta', 'qué chévere', 'qué cool'];
  const negativeWords = ['triste', 'malo', 'fatal', 'horrible', 'cansado', 'aburrido', 'estresado', 'molesto', 'enojado'];

  const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

  if (positiveCount > negativeCount + 1) updates.tone = 'alegre';
  else if (negativeCount > positiveCount + 1) updates.tone = 'serio';
  else if (!currentProfile?.tone || currentProfile.tone === 'neutral') updates.tone = 'neutral';

  // Detect interests
  const interestKeywords = {
    música: ['música', 'cancion', 'cantante', 'banda', 'concierto', 'spotify'],
    deportes: ['fútbol', 'futbol', 'baloncesto', 'deporte', 'gym', 'ejercicio', 'correr'],
    tecnología: ['programación', 'código', 'código', 'app', 'celular', 'computador', 'laptop', 'teléfono'],
    videojuegos: ['videojuego', 'juego', 'play station', 'xbox', 'nintendo', 'gamer'],
    series_pelis: ['serie', 'película', 'netflix', 'prime video', 'disney', 'ver'],
    comida: ['comida', 'cocinar', 'receta', 'restaurante', 'comer', 'plato'],
    viajes: ['viajar', 'viaje', 'vuelo', 'destino', 'vacaciones', 'turismo'],
    mascotas: ['perro', 'gato', 'mascota', 'animal', 'cachorro'],
    lectura: ['libro', 'leer', 'lectura', 'novela', 'escritor', 'autor'],
  };

  const detectedInterests = [];
  for (const [category, keywords] of Object.entries(interestKeywords)) {
    if (keywords.some(k => lower.includes(k)) && !(currentProfile?.interests || '').includes(category)) {
      detectedInterests.push(category);
    }
  }

  if (detectedInterests.length > 0) {
    const existing = currentProfile?.interests || '';
    const all = existing ? existing.split(', ') : [];
    detectedInterests.forEach(i => { if (!all.includes(i)) all.push(i); });
    updates.interests = all.join(', ');
  }

  // Save last topic
  const topicWords = text.split(/\s+/).slice(0, 5).join(' ');
  updates.last_topic = topicWords.length > 50 ? topicWords.substring(0, 50) : topicWords;

  // Save context to history (occasionally)
  if (text.length > 30 && Math.random() < 0.1) {
    updates.history = text.substring(0, 100);
  }

  if (Object.keys(updates).length > 0) {
    updateProfile(userId, updates);
  }
}

function getAllUserProfiles() {
  return stmts.getAllProfiles.all();
}

module.exports = { getProfile, updateProfile, analyzeMessage, getAllUserProfiles };
