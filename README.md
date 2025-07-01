# BuilderBot Adapter Chatwoot

Este proyecto es un **adaptador** para [BuilderBot](https://github.com/leifer-mendez/builderbot) que permite enviar y recibir mensajes de WhatsApp a través de [Chatwoot](https://www.chatwoot.com/).

## ¿Qué hace?

- Recibe mensajes de WhatsApp usando BuilderBot y los reenvía a Chatwoot.
- Permite responder desde Chatwoot y que el mensaje llegue al usuario de WhatsApp.
- Soporta mensajes de texto y archivos multimedia básicos.

## ¿Cómo funciona?

- Usa [@builderbot/bot](https://www.npmjs.com/package/@builderbot/bot) y [@builderbot/provider-baileys](https://www.npmjs.com/package/@builderbot/provider-baileys) para la integración con WhatsApp.
- Expone endpoints HTTP para recibir webhooks de Chatwoot y enviar mensajes.
- Gestiona contactos y conversaciones automáticamente en Chatwoot.

## Uso rápido

1. Configura las variables de entorno en `.env` (ver ejemplo incluido).
2. Instala dependencias:  

   ```sh
   npm install
   ```

3. Inicia el bot

   ```sh
   npm start
   ```

4. Configura los webhooks de Chatwoot para apuntar a `/v1/chatwoot` en tu servidor.

5. Escanea el codigo QR que esta en tu servidor en la url de: 'localhost:3008'
