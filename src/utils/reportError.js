export const reportError = async (error, ctx, provider) => {
    try {
        const numberWhatsAppAdmin = process.env.WHATSAPP_ADMIN_NUMBER || '57305444444'
        const message = `Error: ${error.message}\nStack: ${error.stack}\nContext: ${JSON.stringify(ctx)}`
        await provider.sendMessage(
            numberWhatsAppAdmin,
            message,
            {}
        )
        console.error('Error reported to admin:', error)
    } catch (reportError) {
        console.error('Failed to report error:', reportError)
    }
    return
}