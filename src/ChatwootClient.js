import axios from 'axios';

// Desestructurar variables de entorno
const {
    CHATWOOT_API_URL,
    CHATWOOT_API_TOKEN,
    CHATWOOT_ACCOUNT_ID,
    CHATWOOT_INBOX_ID,
} = process.env;

// Configuración base para las peticiones HTTP a la API de Chatwoot
const API_BASE_PATH = '/api/v1';
const httpClient = axios.create({
    baseURL: `${CHATWOOT_API_URL}${API_BASE_PATH}`,
    headers: {
        'Content-Type': 'application/json',
        api_access_token: CHATWOOT_API_TOKEN,
    },
});

// Cachés en memoria para evitar peticiones redundantes
const contactCache = new Map();
const conversationCache = new Map();

/**
 * Cliente para interactuar con la API de Chatwoot.
 */
export class ChatwootClient {
    constructor({ accountId = CHATWOOT_ACCOUNT_ID, inboxId = CHATWOOT_INBOX_ID } = {}) {
        this.accountId = accountId;
        this.inboxId = inboxId;
        this.http = httpClient;
    }

    /**
     * Busca un contacto por su número de teléfono.
     * @param {string} phone
     * @returns {Promise<Object|null>}
     */
    async findContactByPhone(phone) {
        const { data } = await this.http.get(
            `/accounts/${this.accountId}/contacts/search`,
            { params: { q: phone } }
        );
        return data.payload.length ? data.payload[0] : null;
    }

    /**
     * Crea un nuevo contacto en Chatwoot.
     * @param {string} phone
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async createContact(phone, name) {
        const { data } = await this.http.post(
            `/accounts/${this.accountId}/contacts`,
            { name, phone_number: phone }
        );
        return data.payload.contact || data.payload;
    }

    /**
     * Obtiene o crea un contacto y lo almacena en caché.
     * @param {string} phone
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async getOrCreateContact(phone, name) {
        if (contactCache.has(phone)) {
            return contactCache.get(phone);
        }

        let contact = await this.findContactByPhone(phone);
        if (!contact) {
            contact = await this.createContact(phone, name);
        }
        contactCache.set(phone, contact);
        return contact;
    }

    /**
     * Recupera la conversación más reciente de un contacto.
     * @param {string|number} contactId
     * @returns {Promise<Object|null>}
     */
    async getLatestConversation(contactId) {
        const { data } = await this.http.get(
            `/accounts/${this.accountId}/contacts/${contactId}/conversations`
        );
        return data.payload.length ? data.payload[0] : null;
    }

    /**
     * Crea una conversación en el inbox por defecto.
     * @param {string|number} contactId
     * @returns {Promise<Object>}
     */
    async createConversation(contactId) {
        const { data } = await this.http.post(
            `/accounts/${this.accountId}/conversations`,
            { inbox_id: this.inboxId, contact_id: contactId }
        );
        return data;
    }

    /**
     * Obtiene o crea una conversación y la almacena en caché.
     * @param {Object} contact
     * @returns {Promise<Object>}
     */
    async getOrCreateConversation(contact) {
        const phone = contact.source_id || contact.id;
        if (conversationCache.has(phone)) {
            return conversationCache.get(phone);
        }

        let conversation = await this.getLatestConversation(contact.id);
        if (!conversation) {
            conversation = await this.createConversation(contact.id);
        }
        conversationCache.set(phone, conversation);
        return conversation;
    }

    /**
     * Envía un mensaje a un número de teléfono, creando contacto y conversación si es necesario.
     * @param {Object} params
     * @param {string} params.phone
     * @param {string} params.name
     * @param {string} params.message
     * @param {Object} [params.options]
     */
    async sendMessage({ phone, name, message, options = {} }) {
        const contact = await this.getOrCreateContact(phone, name);
        const conversation = await this.getOrCreateConversation(contact);

        const payload = {
            content: message,
            message_type: options.message_type || 'incoming',
            private: options.private || false,
            content_type: options.content_type || 'text',
            content_attributes: options.content_attributes || {},
        };

        return this.http.post(
            `/accounts/${this.accountId}/conversations/${conversation.id}/messages`,
            payload
        );
    }
}

// Exportar instancia por defecto para uso rápido
export default new ChatwootClient();
