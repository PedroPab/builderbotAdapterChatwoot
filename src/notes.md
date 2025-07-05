En tu wrapper ya tienes un helper que envía presencia:

```js
sendPresenceUpdate: async (remoteJid, WAPresence) => {
  await this.vendor.sendPresenceUpdate(WAPresence, remoteJid);
},
```

Eso significa que para mostrar el “📝 escribiendo” al usuario solo necesitas llamar a esa función con el número (en formato JID) y el tipo de presencia **`'composing'`**:

```js
// número del contacto en formato JID -ej.: 573001112222@s.whatsapp.net
const jid = baileyCleanNumber('573001112222', true) + '@s.whatsapp.net';

// 1️⃣ (Optativo) avisa primero que vas a mandar presencia
await provider.presenceSubscribe(jid);

// 2️⃣ Enciende el indicador “escribiendo…”
await provider.sendPresenceUpdate(jid, 'composing');

// 3️⃣ Haz tu lógica (por ejemplo: procesar IA, armar la respuesta, etc.)
await bot.utils.delay(2000);           // ⏳ simula tiempo de escritura
await provider.sendMessage(jid, '¡Hola! Esta es mi respuesta.');

// 4️⃣ Apaga el indicador
await provider.sendPresenceUpdate(jid, 'paused');   // o 'available'
```

## Tipos de presencia admitidos por Baileys

| Tipo            | Efecto en el cliente del usuario |
| --------------- | -------------------------------- |
| `'composing'`   | “escribiendo…”                   |
| `'recording'`   | “grabando audio…”                |
| `'paused'`      | deja de mostrar que escribe      |
| `'available'`   | vuelve a estado normal en línea  |
| `'unavailable'` | se muestra desconectado          |

## Tips rápidos

1. **No abuses**: WhatsApp retira el indicador automáticamente tras \~8 s; si tardas más, vuelve a enviarlo o ajusta tu lógica.
2. **Grupos**: funciona igual; solo pasa el JID del grupo y, opcionalmente, `participant` si quieres simular typing de un user concreto.
3. **Errores comunes**: asegurarte de llamar a `provider.sendPresenceUpdate` en el orden correcto `(jid, tipo)`; tu wrapper invierte los parámetros respecto al método nativo de Baileys.

¡Listo! Con eso tu bot mostrará el aviso de “escribiendo” antes de mandar cualquier respuesta.

2. provider.emitter._events (eventos “disparadores”)
Evento ¿Cuándo se dispara? Uso típico
require_action Cuando hace falta acción manual (escaneo de QR o emparejamiento). Mostrar QR en consola / UI.
notice Mensajes informativos (por ejemplo, rutas del servidor HTTP). Logging “bonito”.
ready Conexión establecida y usuario autenticado. Arrancar lógica de negocio.
auth_failure Error de credenciales o vínculo. Reintentar auth / alertar admin.
message Cada mensaje recibido y normalizado (ver busEvents). Enrutamiento de tu bot.
host Se emite con los datos del dispositivo una vez conectado. Guardar info del host (ID, teléfono) para telemetría.
