# WhatsApp Bot

Bot inteligente para WhatsApp con **Baileys** + **Gemini IA** (opcional).

## Despliegue en Railway

1. Conecta el repo de GitHub
2. Railway despliega automáticamente
3. **Opcional:** agrega `GEMINI_API_KEY` en Variables para IA
4. Abre la URL de Railway
5. Ingresa el código en WhatsApp > Dispositivos vinculados

## Comandos

| Comando | Descripción |
|---------|-------------|
| `!ping` | pong |
| `!perfil` | datos del contacto |
| `!tag <etiqueta>` | clasificar (novia/amigo/familia/extraño) |
| `!nota <texto>` | guardar nota |
| `!contactos` | lista de contactos |
| `!dato` | dato curioso |
| `!frase` | frase inspiradora |
| `!chiste` | chiste |
| `!consejo` | consejo |
| `!cumplido` | cumplido |
| `!hora` / `!fecha` | hora y fecha |
| `!8ball <preg>` | bola mágica |
| `!moneda` | cara o sello |
| `!dado <caras>` | lanzar dado |
| `!trivia` | juego de trivia |
| `!clima <ciudad>` | clima actual |
| `!calc <expr>` | calculadora |
| `!olvidar` | borra la memoria |
| `!help` | ayuda completa |

**Con IA (GEMINI_API_KEY):**
| `!char <texto>` | chatea con Gemini |
| *cualquier mensaje* | IA responde automáticamente |

**Grupo:** `!welcome` `!antispam` `!admin`
**Programados:** `!schedule add/list/remove`
