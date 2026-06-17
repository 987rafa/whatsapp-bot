const http = require('http');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { handleMessage, handleGroupNotification } = require('./services/messages');
const { startScheduler } = require('./services/scheduler');
const pino = require('pino');

let pairingCode = null;
let statusMessage = 'Iniciando...';

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>WhatsApp Bot</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#1a1a2e; font-family:sans-serif; }
.card { background:#16213e; padding:40px; border-radius:20px; text-align:center; box-shadow:0 0 40px rgba(0,0,0,0.5); max-width:500px; }
h2 { color:#e94560; margin-top:0; }
.code { font-size:2.5em; font-weight:bold; letter-spacing:8px; background:#0f3460; padding:20px; border-radius:10px; color:#fff; margin:20px 0; font-family:monospace; }
p { color:#ccc; line-height:1.5; }
.step { text-align:left; color:#aaa; margin:10px 0; padding:10px; background:#1a1a3e; border-radius:8px; }
.step b { color:#e94560; }
.footer { color:#666; font-size:12px; margin-top:20px; }
.connected { color:#4ecca3; font-size:1.2em; }
</style></head>
<body>
<div class="card">
${pairingCode ? `
  <h2>📱 Código de vinculación</h2>
  <div class="code">${pairingCode}</div>
  <div class="step"><b>1.</b> Abre WhatsApp en tu iPhone</div>
  <div class="step"><b>2.</b> Ve a Configuración > Dispositivos vinculados</div>
  <div class="step"><b>3.</b> Toca "Vincular un dispositivo"</div>
  <div class="step"><b>4.</b> Ingresa este código: <b>${pairingCode}</b></div>
` : statusMessage.includes('conectado') ? `
  <h2 class="connected">✅ Conectado</h2>
  <p>${statusMessage}</p>
` : `
  <h2>⏳ ${statusMessage}</h2>
  <p>Espera mientras el bot se conecta...</p>
`}
<div class="footer">WhatsApp Bot</div>
</div>
</body></html>`);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(statusMessage);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Servidor web en puerto ${PORT}`);
});

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const { version } = await fetchLatestBaileysVersion();
  console.log(`📦 Baileys versión ${version}`);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Chrome (Linux)', '', ''],
    syncFullHistory: false,
    version,
  });

  if (!state.creds.registered) {
    const phone = '573507927769';
      statusMessage = 'Solicitando código...';
      setTimeout(async () => {
        try {
          let code = await sock.requestPairingCode(phone);
          code = code?.match(/.{1,4}/g)?.join('-') || code;
          pairingCode = code;
          statusMessage = `Código: ${code}`;
          console.log(`🔐 Código de vinculación: ${code}`);
          console.log(`📱 Abre WhatsApp > Configuración > Dispositivos vinculados`);
          console.log(`🔢 Ingresa el código: ${code}`);
        } catch (err) {
          statusMessage = `Error: ${err.message}`;
          console.error('Error al solicitar pairing code:', err);
        }
      }, 2000);
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      pairingCode = null;
      const user = sock.user?.name || sock.user?.id || 'desconocido';
      statusMessage = `Conectado como ${user}`;
      console.log(`✅ Bot conectado como ${user}`);
      startScheduler(sock);
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        statusMessage = 'Sesión cerrada. Reinicia el bot.';
        console.log('❌ Sesión cerrada.');
      } else {
        statusMessage = 'Reconectando...';
        console.log('🔄 Reconectando...');
        start();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;
      await handleMessage(sock, msg);
    }
  });

  sock.ev.on('group-participants.update', async (notification) => {
    await handleGroupNotification(sock, notification);
  });
}

start().catch(console.error);
