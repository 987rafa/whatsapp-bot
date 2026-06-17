const MAX_MEMORY_PER_USER = 20;
const memory = new Map();

function getMemory(userId) {
  if (!memory.has(userId)) {
    memory.set(userId, []);
  }
  return memory.get(userId);
}

function addToMemory(userId, role, text) {
  const mem = getMemory(userId);
  mem.push({ role, text, time: Date.now() });
  if (mem.length > MAX_MEMORY_PER_USER) {
    mem.shift();
  }
}

function getContext(userId, limit = 5) {
  const mem = getMemory(userId);
  return mem.slice(-limit).map(m => `${m.role}: ${m.text}`).join('\n');
}

function clearMemory(userId) {
  memory.delete(userId);
}

function getAllUsers() {
  return Array.from(memory.keys());
}

module.exports = { addToMemory, getContext, clearMemory, getMemory, getAllUsers };
