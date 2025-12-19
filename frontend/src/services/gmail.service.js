/**
 * Gmail Service
 *
 * Handles all Gmail settings-related API operations.
 */

import api from './api';

export const gmailService = {
  /**
   * Get current Gmail settings
   * @returns {Promise<object>} Gmail settings
   */
  async getSettings() {
    const response = await api.get('/settings/gmail');
    return response.data;
  },

  /**
   * Save Gmail settings
   * @param {object} data - Gmail credentials (email, app_password)
   * @returns {Promise<object>} Success response
   */
  async saveSettings(data) {
    const response = await api.post('/settings/gmail', data);
    return response.data;
  },

  /**
   * Verify Gmail connection
   * @returns {Promise<object>} Verification result
   */
  async verifyConnection() {
    const response = await api.post('/settings/gmail/verify');
    return response.data;
  },

  /**
   * Disconnect Gmail
   * @returns {Promise<object>} Success response
   */
  async disconnect() {
    const response = await api.delete('/settings/gmail');
    return response.data;
  },
};
