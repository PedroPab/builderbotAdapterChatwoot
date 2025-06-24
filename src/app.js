import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { getOrCreateConversation, sendToChatwoot, convMap } from './chatwootClient.js';

const PORT = process.env.PORT ?? 3008


const welcomeFlow = addKeyword([])
    .addAction(async (ctx) => {
        console.log('convMap:', convMap)
        const { from, name } = ctx
        const number = '+' + from.replace('@s.whatsapp.net', '')
        const message = `${ctx.body}`
        // aqui redireccionamso  el mensaje a chatwoot para que quede registrado
        try {
            const convId = await getOrCreateConversation({ number, name }, message);
            await sendToChatwoot(convId || 15, message);
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

            const type = body.type
            if (type !== 'incoming_message') {
                return res.code(400).end('Type not supported')
            }

            if (event !== 'message_created') {
                return res.code(400).end('Event not supported')
            }

            const { content, content_type } = body

            if (content_type !== 'text') {
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
