import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import FormData from 'form-data';
import https from 'https';
// Configuración de variables de entorno
const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL;
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const INBOX_ID = process.env.CHATWOOT_INBOX_ID;

// Cliente Axios configurado para Chatwoot
export const chatwootClient = axios.create({
    baseURL: `${CHATWOOT_API_URL}/api/v1`,
    headers: {
        'api_access_token': CHATWOOT_API_TOKEN,
    }, timeout: 15000,                                        // 15 s es razonable
    httpsAgent: new https.Agent({
        keepAlive: true,
        family: 4               // IPv4 first
    })
});
// Mapas en memoria para cachear contactos y conversaciones
const conversationIdCache = new Map();
const contactIdCache = new Map();

/**
 * Crea un nuevo contacto en Chatwoot.
 */
async function createContact(phoneNumber, name) {
    const { data } = await chatwootClient.post(
        `/accounts/${ACCOUNT_ID}/contacts`,
        { name, phone_number: phoneNumber }
    );
    return data.payload.contact || data.payload;
}

/**
 * Busca un contacto existente por número de teléfono.
 */
async function searchContact(phoneNumber) {
    const { data } = await chatwootClient.get(
        `/accounts/${ACCOUNT_ID}/contacts/search`,
        { params: { q: phoneNumber } }
    );
    const contacts = data.payload;
    return contacts.length ? contacts[0] : null;
}

/**
 * Crea una nueva conversación para un contacto en un inbox específico.
 */
async function createConversation(inboxId, contactId) {
    const { data } = await chatwootClient.post(
        `/accounts/${ACCOUNT_ID}/conversations`,
        { inbox_id: inboxId, contact_id: contactId }
    );
    return data;
}

/**
 * Obtiene la primera conversación activa de un contacto.
 */
async function getFirstConversationByContactId(contactId) {
    const { data } = await chatwootClient.get(
        `/accounts/${ACCOUNT_ID}/contacts/${contactId}/conversations`
    );
    return data.payload.length > 0 ? data.payload[0] : null;
}

/**
 * Envía un mensaje a una conversación.
 */
async function sendMessageToConversation({ message, conversationId, options = {} }) {
    const { urlPath } = options;

    // 1. Construye el FormData
    const form = new FormData();

    // Si hay texto, lo añadimos
    if (message) {
        form.append('content', message);
    }

    // Si viene una ruta de archivo, lo añadimos como attachment
    if (urlPath) {
        const fileName = path.basename(urlPath);
        const contentType = mime.getType(urlPath) || 'application/octet-stream';
        form.append('attachments[]', fs.createReadStream(urlPath), {
            filename: fileName,
            contentType,              // p. ej. 'image/jpeg'
        });
    }

    form.append('message_type', 'incoming');
    form.append('private', 'false'); // o 'true' si es un mensaje privado

    const headers = {
        ...form.getHeaders(),      // Content-Type: multipart/form-data; boundary=---
        api_access_token: process.env.CHATWOOT_API_TOKEN
    };

    await chatwootClient.post(
        `/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
        form,
        {
            headers,
            transformRequest: [(data) => data],  // <— evita la conversión a JSON
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        }
    );
}

/**
 * Obtiene o crea un contacto y lo cachea.
 */
async function getOrCreateContact(phoneNumber, name) {
    let contactId = contactIdCache.get(phoneNumber);
    let contact;

    if (contactId) {
        contact = { id: contactId };
    } else {
        contact = await searchContact(phoneNumber);
        if (!contact) {
            contact = await createContact(phoneNumber, name);
        }
        contactIdCache.set(phoneNumber, contact.id);
    }
    return contact;
}

/**
 * Obtiene o crea una conversación y la cachea.
 */
async function getOrCreateConversation(phoneNumber, name) {
    let conversationId = conversationIdCache.get(phoneNumber);

    if (!conversationId) {
        const contact = await getOrCreateContact(phoneNumber, name);
        let conversation = await getFirstConversationByContactId(contact.id);

        if (!conversation) {
            conversation = await createConversation(INBOX_ID, contact.id);
        }
        conversationId = conversation.id;
        conversationIdCache.set(phoneNumber, conversationId);
    }

    return conversationId;
}

/**
 * Envía un mensaje a un número y nombre dados, gestionando contacto y conversación.
 */
export async function sendMessage({ number, name, message, options = {} }) {
    console.log("🚀 ~ sendMessage ~ number:", number)

    try {
        const conversationId = await getOrCreateConversation(number, name);
        return await sendMessageToConversation({ message, conversationId, options });
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message');
    }
}

