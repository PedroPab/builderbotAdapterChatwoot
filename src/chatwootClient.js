// chatwootClient.js
import axios from 'axios';

const CHATWOOT_API_URL = process.env.CHATWOOT_API_URL
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const INBOX_ID = process.env.CHATWOOT_INBOX_ID;

console.log('CHATWOOT_API_URL:', CHATWOOT_API_URL);
console.log('CHATWOOT_API_TOKEN:', CHATWOOT_API_TOKEN);
console.log('ACCOUNT_ID:', ACCOUNT_ID);
console.log('INBOX_ID:', INBOX_ID);


export const chatwoot = axios.create({
    baseURL: `${CHATWOOT_API_URL}/api/v1`,
    headers: {
        'api_access_token': `${CHATWOOT_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

export const convMap = new Map();

export async function sendToChatwoot(conversationId, content) {
    return chatwoot.post(
        `/accounts/${ACCOUNT_ID}/conversations/${conversationId}/messages`,
        { content, message_type: 'incoming', private: false }
    );
}

export async function getOrCreateConversation(contact, initialMessage) {
    const { number, name } = contact;
    if (convMap.has(number)) return convMap.get(number);

    const body = {
        inbox_id: 1,
        source_id: number,
        contact: { name },
        message: { content: initialMessage },
    }

    const { data } = await chatwoot.post(`/accounts/${ACCOUNT_ID}/conversations`, body);
    console.log('Conversation created:', data);
    const convId = data.payload.id;
    convMap.set(number, convId);
    return convId;
}