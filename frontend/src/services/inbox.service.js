/**
 * Inbox Service
 *
 * API calls for LinkedIn messaging inbox management.
 */

import api from './api';

const inboxService = {
  /**
   * Get all conversations
   * @param {object} params - Query parameters (page, per_page)
   * @returns {Promise<object>} Paginated conversations
   */
  async getConversations(params = {}) {
    const response = await api.get('/inbox', { params });
    return response.data;
  },

  /**
   * Get a single conversation with messages
   * @param {number} id - Conversation ID
   * @returns {Promise<object>} Conversation with messages
   */
  async getConversation(id) {
    const response = await api.get(`/inbox/${id}`);
    return response.data;
  },

  /**
   * Get inbox stats
   * @returns {Promise<object>} Stats object
   */
  async getStats() {
    const response = await api.get('/inbox/stats');
    return response.data;
  },

  /**
   * Sync conversations from extension
   * @param {Array} conversations - Conversations data from extension
   * @returns {Promise<object>} Sync result
   */
  async syncConversations(conversations) {
    const response = await api.post('/inbox/sync', { conversations });
    return response.data;
  },

  /**
   * Sync messages for a conversation
   * @param {number} conversationId - Conversation ID
   * @param {Array} messages - Messages data
   * @returns {Promise<object>} Sync result
   */
  async syncMessages(conversationId, messages) {
    const response = await api.post(`/inbox/${conversationId}/sync-messages`, { messages });
    return response.data;
  },

  /**
   * Send a message (queue for extension)
   * @param {number} conversationId - Conversation ID
   * @param {string} content - Message content
   * @returns {Promise<object>} Created message
   */
  async sendMessage(conversationId, content) {
    const response = await api.post(`/inbox/${conversationId}/send`, { content });
    return response.data;
  },

  /**
   * Mark conversation as read
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<object>} Result
   */
  async markAsRead(conversationId) {
    const response = await api.post(`/inbox/${conversationId}/read`);
    return response.data;
  },

  /**
   * Delete a conversation
   * @param {number} id - Conversation ID
   * @returns {Promise<object>} Result
   */
  async deleteConversation(id) {
    const response = await api.delete(`/inbox/${id}`);
    return response.data;
  },

  /**
   * Get pending messages to send
   * @returns {Promise<object>} Pending messages
   */
  async getPendingMessages() {
    const response = await api.get('/inbox/pending-messages');
    return response.data;
  },

  /**
   * Mark a message as sent
   * @param {number} messageId - Message ID
   * @param {boolean} success - Whether send was successful
   * @param {string} linkedinMessageId - LinkedIn message ID (optional)
   * @param {string} errorMessage - Error message if failed (optional)
   * @returns {Promise<object>} Result
   */
  async markMessageSent(messageId, success, linkedinMessageId = null, errorMessage = null) {
    const response = await api.post(`/inbox/messages/${messageId}/mark-sent`, {
      success,
      linkedin_message_id: linkedinMessageId,
      error_message: errorMessage,
    });
    return response.data;
  },
};

export default inboxService;
