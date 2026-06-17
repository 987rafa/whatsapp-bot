# WhatsApp Bot

Bot para WhatsApp con **Baileys**. Sin Meta API, sin navegador.

## Despliegue en Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Conecta tu repo de GitHub
2. Railway asigna un puerto automáticamente
3. Abre la URL que te da Railway en tu navegador
4. Escanea el QR con WhatsApp (Configuración > Dispositivos vinculados)

## Uso local

```bash
npm install
npm start
# Abre http://localhost:3000/qr
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `!ping` | pong |
| `!help` | ayuda |
| `!say <texto>` | repetir |
| `!info` | info del chat |
| `!userinfo` | estadísticas |
| `!welcome on/off/set` | bienvenidas (grupo) |
| `!antispam on/off` | anti-spam (grupo) |
| `!admin add/remove` | admins (grupo) |
| `!schedule add/list/remove` | mensajes programados |
