// chatwootClient.js
import axios from 'axios';

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL;
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const INBOX_ID = process.env.CHATWOOT_INBOX_ID;

// Axios client for Chatwoot
export const chatwoot = axios.create({
    baseURL: `${CHATWOOT_API_URL}/api/v1`,
    headers: {
        'api_access_token': CHATWOOT_API_TOKEN,
        'Content-Type': 'application/json',
    },
});

// In-memory maps to track conversations and contacts by number
export const conversationIdMap = new Map();
export const contactIdMap = new Map();

/**
 * Create a new contact in Chatwoot.
 */
async function createContact(number, name) {
    const { data } = await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/contacts`,
        { name, phone_number: number }
    );
    return data.payload.contact || data.payload; // Handle both payload formats
}

/**
 * Find an existing contact by phone number via Chatwoot API.
 */
async function findContact(number) {
    const { data } = await chatwoot.get(
        `/accounts/${ACCOUNT_ID}/contacts/search`,
        { params: { q: number } }
    );
    const contacts = data.payload;
    return contacts.length ? contacts[0] : null;
}

/**
 * Create a new conversation for a contact in a specific inbox.
 */
async function createConversation(inboxId, contactId) {
    const { data } = await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/conversations`,
        {
            inbox_id: inboxId,
            contact_id: contactId,
        }
    );
    return data;
}

async function getConversationByContactId(conversationId) {
    const { data: data } = await chatwoot.get(
        `/accounts/${ACCOUNT_ID}/contacts/${conversationId}/conversations`
    );
    return data.payload.length > 0 ? data.payload[0] : null;
}

async function createMessage({ message, conversationId, options = {} }) {
    const payload = {
        content: message,
        message_type: options.message_type || 'incoming',
        private: options.private || false,
        content_type: options.content_type || 'text',
        content_attributes: options.content_attributes || {},
    };

    return await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
        payload
    );

}


async function extraContact(number, name) {
    let contact = contactIdMap.get(number) || await findContact(number);
    if (!contact) {
        contact = await createContact(number, name);
    }
    contactIdMap.set(number, contact.id);
    return contact;

}

async function extraConversation(contact) {
    const conversation = await getConversationByContactId(contact.id);

    if (!conversation) {
        return await createConversation(INBOX_ID, contact.id);
    }

    return conversation;
}

export async function sendMessageMaster({ number, name, message, options = {} }) {
    let conversationId = conversationIdCache({ name, number });
    const messageSend = await createMessage({ message, conversationId, options });
    return messageSend
}

async function conversationIdCache({ name, number }) {
    let conversationId = conversationIdMap.get(number);
    if (!conversationId) {

        const contact = await extraContact(number, name);

        const conversation = await extraConversation(contact);

        conversationIdMap.set(number, conversation.id);
        conversationId = conversation.id;
    }

    return conversationId;
}

