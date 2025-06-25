import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { sendMessageMaster } from './chatwootClient.js';

const PORT = process.env.PORT ?? 3008


const welcomeFlow = addKeyword([])
    .addAction(async (ctx) => {
        const { from, name } = ctx
        const number = '+' + from.replace('@s.whatsapp.net', '')
        const message = `${ctx.body}`
        // aqui redireccionamso  el mensaje a chatwoot para que quede registrado
        try {
            await sendMessageMaster({ number, name, message });

        } catch (error) {
            console.error('Error sending message to Chatwoot:', error);
        }

    })



const main = async () => {
    const adapterFlow = createFlow([welcomeFlow])

    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    //chatwoot
    adapterProvider.server.post(
        '/v1/chatwoot',
        handleCtx(async (bot, req, res) => {


            const body = req.body
            const event = body.event


            if (event !== 'message_created') {
                console.error('Event not supported:', event)
                return res.code(400).end('Event not supported')
            }

            const message_type = body.message_type
            if (message_type !== 'outgoing') {
                console.error('Type not supported:', message_type)
                console.error('Body:', body)
                return res.code(400).end('Type not supported')
            }


            const { content, content_type } = body

            if (content_type !== 'text') {
                console.error('Content type not supported:', content_type)
                return res.code(400).end('Content type not supported')
            }

            // const urlMedia = body.conversation.messages[0]?.processed_message_content?.media_url

            const number = body.conversation.meta.sender.phone_number
            const message = content || body.conversation.messages[0].processed_message_content


            await bot.sendMessage(number, message, {})
            return res.code(201).end('Message received and sent to the user')
        })
    )

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
