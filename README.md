# WhatsApp Bot

Bot para WhatsApp con **Baileys**. Sin Meta API, sin navegador.

## Despliegue en Railway

1. Conecta el repo de GitHub a Railway
2. Railway despliega automáticamente
3. Abre la URL de Railway en tu navegador
4. Verás un código de 8 dígitos
5. En WhatsApp: Configuración > Dispositivos vinculados > Vincular dispositivo
6. Ingresa el código — **sin escanear QR**

## Uso local

```bash
npm install
npm start
# Abre http://localhost:3000
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
