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
export const convMap = new Map();
export const contactMap = new Map();

/**
 * Create a new contact in Chatwoot.
 */
async function createContact(number, name) {
    const { data } = await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/contacts`,
        { name, phone_number: number }
    );
    return data.payload;
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
async function createConversation(inboxId, contactId, message) {
    const { data } = await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/conversations`,
        {
            inbox_id: inboxId,
            contact_id: contactId,
            message: { content: message },
        }
    );
    return data;
}

/**
 * Master function to send a message:
 * - Ensures contact exists.
 * - Creates conversation if needed.
 * - Sends message.
 */
export async function sendMessageMaster({ number, name, message, options = {} }) {
    // 1) Lookup or create conversation
    let convId = convMap.get(number);
    if (!convId) {
        // a) Lookup or create contact
        let contact = contactMap.get(number) || await findContact(number);
        if (!contact) {
            contact = await createContact(number, name);
        }
        contactMap.set(number, contact.id);

        // b) Create conversation
        const conv = await createConversation(INBOX_ID, contact.id, message);

        convId = conv.id;
        convMap.set(number, convId);
    }

    // 2) Send the message
    const payload = {
        content: message,
        message_type: options.message_type || 'incoming',
        private: options.private || false,
        content_type: options.content_type || 'text',
        content_attributes: options.content_attributes || {},
    };
    const rta = await chatwoot.post(
        `/accounts/${ACCOUNT_ID}/conversations/${convId}/messages`,
        payload
    );
    console.log('Message sent:', rta);
    return rta
}
