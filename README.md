# WhatsApp Bot

Bot para WhatsApp con **Baileys** (protocolo nativo, sin Meta API, sin navegador).

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

Escanea el código QR con tu WhatsApp.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `!ping` | pong |
| `!help` | ayuda |
| `!say <texto>` | repetir mensaje |
| `!info` | info del chat |
| `!userinfo` | estadísticas del usuario |
| `!welcome on/off/set` | bienvenidas (grupo) |
| `!antispam on/off` | anti-spam (grupo) |
| `!admin add/remove` | admins del bot (grupo) |
| `!schedule add/list/remove` | mensajes programados |

## Despliegue

Servicios gratuitos recomendados: **Railway**, **Render**, **Fly.io**, **Replit**.

Solo necesitas Node.js 18+ - **no requiere Chromium ni GPU**.
