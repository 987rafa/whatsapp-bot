const http = require('http');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { handleMessage, handleGroupNotification } = require('./services/messages');
const { startScheduler } = require('./services/scheduler');
const { startReminderChecker } = require('./services/reminders');
const { startBackupScheduler } = require('./services/backup');
const pino = require('pino');

let pairingCode = null;
let qrCode = null;
let statusMessage = 'Iniciando...';

const html = (body) => `<!DOCTYPE html>
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
.qr-img { max-width:100%; border-radius:10px; }
</style></head>
<body>
<div class="card">${body}</div>
</body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/reset') {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../auth_info');
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html(`<h2>✅ Auth reiniciado</h2><p>Recarga la página para obtener un nuevo código.</p>`));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  if (req.url === '/' && pairingCode && qrCode) {
    res.end(html(`
      <h2>📱 Escanea el QR</h2>
      <img class="qr-img" src="${qrCode}" alt="QR"/>
      <p>Abre WhatsApp > Configuración > Dispositivos vinculados</p>
      <hr style="border-color:#333;margin:30px 0">
      <h2>O ingresa el código</h2>
      <div class="code">${pairingCode}</div>
      <p>Toca "Vincular con número de teléfono" e ingresa: <b>${pairingCode}</b></p>
    `));
  } else if (req.url === '/' && qrCode) {
    res.end(html(`
      <h2>📱 Escanea el QR</h2>
      <img class="qr-img" src="${qrCode}" alt="QR"/>
      <p>Abre WhatsApp > Configuración > Dispositivos vinculados</p>
    `));
  } else if (req.url === '/') {
    res.end(html(`
      <h2>⏳ ${statusMessage}</h2>
      <p>Espera mientras el bot se conecta...</p>
    `));
  } else {
    res.end(statusMessage);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Servidor web en puerto ${PORT}`);
  console.log('🤖 Gemini IA: ACTIVADA');
});

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  let version = (await fetchLatestBaileysVersion()).version;
  console.log(`📦 Baileys versión ${version}`);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['WhatsAppBot', 'Chrome', '124.0.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    version,
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      statusMessage = 'Escanea el QR o espera el código...';
      // Show QR as fallback
      try {
        const QRCode = require('qrcode');
        qrCode = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
      } catch {}
    }

    if (qr && !pairingCode && !state.creds.registered) {
      setTimeout(async () => {
        try {
          console.log('🔑 Solicitando código de vinculación...');
          statusMessage = 'Generando código...';
          let code = await sock.requestPairingCode('573507927769');
          if (code && typeof code === 'string') {
            code = code.match(/.{1,4}/g)?.join('-') || code;
            pairingCode = code;
            statusMessage = `Código: ${code}`;
            console.log(`🔐 Código: ${code}`);
            console.log(`📱 WhatsApp > Config > Dispositivos vinculados`);
            console.log(`🔢 Ingresa: ${code}`);
          }
        } catch (err) {
          console.error('❌ Error pairing code:', err.message);
          statusMessage = `Usa el QR. Error: ${err.message}`;
        }
      }, 3000);
    }

    if (connection === 'open') {
      pairingCode = null;
      qrCode = null;
      const user = sock.user?.name || sock.user?.id || 'desconocido';
      statusMessage = `Conectado como ${user}`;
      console.log(`✅ Bot conectado como ${user}`);
      startScheduler(sock);
      startReminderChecker(sock);
      startBackupScheduler();
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
