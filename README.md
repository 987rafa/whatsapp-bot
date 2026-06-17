# WhatsApp Bot

Bot para WhatsApp con **Baileys**. Sin Meta API, sin navegador.

## Despliegue en Railway

1. Conecta tu repo de GitHub a Railway
2. Agrega la variable de entorno `PHONE_NUMBER` con tu número (ej: `521234567890`)
3. Railway inicia el bot automáticamente
4. Abre la URL de Railway en tu navegador
5. Verás un código de 8 dígitos
6. En WhatsApp: Configuración > Dispositivos vinculados > Vincular dispositivo
7. Ingresa el código — **sin escanear QR**

## Uso local

```bash
PHONE_NUMBER=521234567890 npm start
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
