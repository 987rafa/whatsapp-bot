const http = require('http');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleMessage, handleGroupNotification } = require('./services/messages');
const { startScheduler } = require('./services/scheduler');
const pino = require('pino');
const QRCode = require('qrcode');

let currentQR = null;

const server = http.createServer(async (req, res) => {
  if (req.url === '/qr' && currentQR) {
    const qrImage = await QRCode.toDataURL(currentQR, { width: 400, margin: 2 });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>WhatsApp Bot - QR</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#1a1a2e; font-family:sans-serif; }
.card { background:#16213e; padding:40px; border-radius:20px; text-align:center; box-shadow:0 0 40px rgba(0,0,0,0.5); }
h2 { color:#e94560; margin-top:0; }
img { max-width:100%; border-radius:10px; }
p { color:#ccc; }
.footer { color:#666; font-size:12px; margin-top:20px; }
</style></head>
<body>
<div class="card">
<h2>📱 Escanea el QR</h2>
<img src="${qrImage}" alt="QR Code"/>
<p>Abre WhatsApp > Configuración > Dispositivos vinculados</p>
<div class="footer">WhatsApp Bot</div>
</div>
</body></html>`);
  } else if (req.url === '/qr') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Esperando QR...');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot funcionando ✅');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Servidor web en puerto ${PORT}`);
  console.log(`📱 Abre http://localhost:${PORT}/qr para ver el QR`);
});

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Chrome (Linux)', '', ''],
    syncFullHistory: false,
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = qr;
      console.log('🔐 Nuevo QR generado. Abre /qr en tu navegador.');
    }
    if (connection === 'open') {
      currentQR = null;
      console.log(`✅ Bot conectado como ${sock.user?.name || sock.user?.id}`);
      startScheduler(sock);
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Vuelve a escanear.');
      } else {
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
