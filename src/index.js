const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleMessage, handleGroupNotification } = require('./services/messages');
const { startScheduler } = require('./services/scheduler');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Chrome (Linux)', '', ''],
    syncFullHistory: false,
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('\nEscanea el QR con tu WhatsApp');
    }
    if (connection === 'open') {
      console.log(`✅ Bot conectado como ${sock.user?.name || sock.user?.id}`);
      startScheduler(sock);
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Vuelve a escanear el QR.');
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
