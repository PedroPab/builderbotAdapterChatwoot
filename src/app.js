import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { sendMessage } from './chatwootClient.js';

const PORT = process.env.PORT ?? 3008


const generalFlow = addKeyword([])

    .addAction(async (ctx, { provider }) => {

        const { from, name } = ctx
        const number = '+' + from.replace('@s.whatsapp.net', '')

        let message = `${ctx.body}`
        const messageCtx = ctx.message

        const listDownloadableMessages = {
            // '_stickerMessage',
            '_audioMessage': { value: 'audioMessage', type: 'audio', urlPath: null },
            '_videoMessage': { value: 'videoMessage', type: 'video', urlPath: null },
            '_imageMessage': { value: 'imageMessage', type: 'image', urlPath: null },
            '_documentMessage': { value: 'documentMessage', type: 'document', urlPath: null },
        }

        let options = { value: 'text', type: 'text', urlPath: null }
        //miramos si el mensaje se puede descargar
        const isDownloadable = Object.keys(listDownloadableMessages).some((key) => {
            if (messageCtx[key] !== undefined) {
                options = listDownloadableMessages[key]
                return true
            }
            return false
        })


        if (isDownloadable) {
            options.urlPath = await provider.saveFile(ctx, { path: './public/temp' })
            message = ctx?.message[options.value]?.caption || ''
        }

        await sendMessage({ number, name, message, options });

    })


const main = async () => {
    const adapterFlow = createFlow([generalFlow])

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
