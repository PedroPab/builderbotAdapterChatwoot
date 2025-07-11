// ⚠️  Se ejecuta antes de todo lo demás
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Unhandled Rejection: esto hay que tenerlo en cuenta');
    console.error('💥  Unhandled Rejection:', reason);
    // Aquí decides: ¿solo log? ¿o terminar el proceso?
    // process.exit(1);
});

import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { sendMessage } from './chatwootClient.js';
import { parseWaNumber } from './utils/parseWaNumber.js';
import { reportError } from './utils/reportError.js';

const PORT = process.env.PORT ?? 3008


const generalFlow = addKeyword([])

    .addAction(async (ctx, { provider }) => {
        try {
            const { from, name } = ctx
            const number = parseWaNumber(from)

            // 🔹 1. Salir si no hay mensaje (p. ej. llamada)
            if (!ctx.message) {
                console.log('ctx.message vacío: evento no-mensaje; se ignora')
                return
            }

            const messageCtx = ctx.message        // siempre hay algo en este punto
            let message = ctx.body || ''
            let options = { value: 'text', type: 'text', urlPath: null }

            const listDownloadableMessages = {
                _audioMessage: { value: 'audioMessage', type: 'audio', urlPath: null },
                _videoMessage: { value: 'videoMessage', type: 'video', urlPath: null },
                _imageMessage: { value: 'imageMessage', type: 'image', urlPath: null },
                _documentMessage: { value: 'documentMessage', type: 'document', urlPath: null },
            }

            const isDownloadable = Object.keys(listDownloadableMessages).some(key => {
                if (messageCtx[key] !== undefined) {
                    options = listDownloadableMessages[key]
                    return true
                }
                return false
            })

            if (isDownloadable) {
                options.urlPath = await provider.saveFile(ctx, { path: './public/temp' })
                message = messageCtx[options.value]?.caption || ''
            }

            await sendMessage({ number, name, message, options })
        } catch (error) {
            console.error('Error in generalFlow:', error);
            await reportError(error, ctx, provider);
        }
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

    const okResponse = (res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ status: 'ok' }))
    }

    //chatwoot
    adapterProvider.server.post(
        '/v1/chatwoot',
        handleCtx(async (bot, req, res) => {
            try {

                const body = req.body
                const { event, conversation, message_type, content, content_type } = req.body
                var waNumberOn = '+' + conversation?.meta?.sender?.phone_number?.replace('+', '')

                switch (event) {

                    case 'conversation_typing_on':
                        console.log('no hay soporte para typing_on')
                        return okResponse(res)
                    case 'conversation_typing_off':
                        console.log('no hay soporte para typing_off')
                        return okResponse(res)

                    case 'conversation_created':
                        console.log('Conversation created:', waNumberOn)
                        break
                    case 'conversation_updated':
                        console.log('Conversation updated:', waNumberOn)
                        break
                    case 'message_created':
                        console.log('Message created:', waNumberOn)
                        break
                    case 'message_updated':
                        console.log('Message updated:', waNumberOn)
                        break

                    case 'incoming':
                        console.log('Incoming message:', waNumberOn)
                        break
                    default:
                        console.log('Event not supported:', event)
                        return okResponse(res)
                }



                if (message_type !== 'outgoing') {
                    console.error('Type not supported:', message_type)
                    return okResponse(res)
                }

                //miramos el mensaje sea publico (no privado)
                if (body.private) {
                    console.error('Private message not supported:', waNumberOn)
                    return okResponse(res)
                }

                if (content_type !== 'text') {
                    console.error('Content type not supported:', content_type)
                    return okResponse(res)
                }

                // const urlMedia = body.conversation.messages[0]?.processed_message_content?.media_url

                const number = body.conversation.meta.sender.phone_number
                const message = content || body?.conversation?.messages[0]?.processed_message_content || ''

                let media = null
                const attachments = body?.conversation?.messages?.attachments || body?.attachments
                if (attachments && attachments.length > 0) {
                    const mediaUrl = attachments[0]?.data_url || null
                    const mediaType = attachments[0]?.file_type || null
                    media = { url: mediaUrl, type: mediaType }
                }

                if (media) {
                    const cleanNumber = number.replace('+', '') + '@s.whatsapp.net'
                    await bot.provider.sendMedia(cleanNumber, media.url, message)
                } else {
                    const cleanNumber = number.replace('+', '')
                    await bot.sendMessage(cleanNumber, message, {})
                }
                return okResponse(res)

            } catch (error) {
                if (error.message.includes("ENOENT: no such file or directory, rename")) {
                    console.error('File not found error:', error.message)
                    return okResponse(res)
                }
                console.error('Error processing chatwoot message:', error)
                return res.code(500).end('Internal Server Error')
            }
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
