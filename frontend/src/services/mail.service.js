/**
 * Mail Service
 *
 * Handles all sent email-related API operations.
 */

import api from './api';

export const mailService = {
  /**
   * Get sent emails with pagination and filtering
   * @param {object} params - Query parameters (status, search, page, per_page)
   * @returns {Promise<object>} Paginated emails response
   */
  async getEmails(params = {}) {
    const response = await api.get('/mail', { params });
    return response.data;
  },

  /**
   * Get email statistics
   * @returns {Promise<object>} Email stats
   */
  async getStats() {
    const response = await api.get('/mail/stats');
    return response.data;
  },

  /**
   * Get single email by ID
   * @param {number} id - Email ID
   * @returns {Promise<object>} Email details
   */
  async getEmail(id) {
    const response = await api.get(`/mail/${id}`);
    return response.data;
  },

  /**
   * Get pending email extractions (completed email campaigns)
   * @returns {Promise<object>} Campaigns with extraction results
   */
  async getPendingExtractions() {
    const response = await api.get('/mail/pending-extractions');
    return response.data;
  },

  /**
   * Queue emails from a campaign extraction
   * @param {number} campaignId - Campaign ID
   * @param {number} templateId - Email template ID to use
   * @param {boolean} sendNow - Whether to send immediately
   * @returns {Promise<object>} Queue result
   */
  async queueFromCampaign(campaignId, templateId, sendNow = false) {
    const response = await api.post('/mail/queue-from-campaign', {
      campaign_id: campaignId,
      template_id: templateId,
      send_now: sendNow,
    });
    return response.data;
  },

  /**
   * Discard extraction results for a campaign
   * @param {number} campaignId - Campaign ID
   * @returns {Promise<object>} Discard result
   */
  async discardExtraction(campaignId) {
    const response = await api.delete(`/mail/discard-extraction/${campaignId}`);
    return response.data;
  },

  /**
   * Send a single email
   * @param {number} emailId - Email ID
   * @returns {Promise<object>} Send result
   */
  async sendEmail(emailId) {
    const response = await api.post(`/mail/${emailId}/send`);
    return response.data;
  },

  /**
   * Send multiple emails in bulk
   * @param {number[]} emailIds - Array of email IDs
   * @returns {Promise<object>} Send result
   */
  async sendBulk(emailIds) {
    const response = await api.post('/mail/send-bulk', { email_ids: emailIds });
    return response.data;
  },

  /**
   * Delete a single email
   * @param {number} emailId - Email ID
   * @returns {Promise<object>} Delete result
   */
  async deleteEmail(emailId) {
    const response = await api.delete(`/mail/${emailId}`);
    return response.data;
  },

  /**
   * Delete multiple emails in bulk
   * @param {number[]} emailIds - Array of email IDs
   * @returns {Promise<object>} Delete result
   */
  async deleteBulk(emailIds) {
    const response = await api.delete('/mail/bulk-delete', { data: { email_ids: emailIds } });
    return response.data;
  },

  /**
   * Update an email (subject/body)
   * @param {number} emailId - Email ID
   * @param {object} data - { subject, body }
   * @returns {Promise<object>} Updated email
   */
  async updateEmail(emailId, data) {
    const response = await api.put(`/mail/${emailId}`, data);
    return response.data;
  },

  /**
   * Create a custom email (not from campaign)
   * @param {object} data - { to_email, to_name, subject, body }
   * @returns {Promise<object>} Created email
   */
  async createEmail(data) {
    const response = await api.post('/mail', data);
    return response.data;
  },
};
