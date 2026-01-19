/**
 * Prospect Service
 *
 * Handles all prospect-related API operations.
 */

import api from './api';

export const prospectService = {
  /**
   * Get paginated prospects list with optional filters
   * @param {object} params - Query parameters (per_page, connection_status, tag_id, search, page)
   * @returns {Promise<object>} Paginated prospects response
   */
  async getProspects(params = {}) {
    // Remove empty string values from params
    const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const response = await api.get('/prospects', { params: cleanParams });
    return response.data;
  },

  /**
   * Get single prospect by ID
   * @param {number} id - Prospect ID
   * @returns {Promise<object>} Prospect object
   */
  async getProspect(id) {
    const response = await api.get(`/prospects/${id}`);
    return response.data;
  },

  /**
   * Create new prospect
   * @param {object} data - Prospect data
   * @returns {Promise<object>} Created prospect
   */
  async createProspect(data) {
    const response = await api.post('/prospects', data);
    return response.data;
  },

  /**
   * Update prospect
   * @param {number} id - Prospect ID
   * @param {object} data - Updated prospect data
   * @returns {Promise<object>} Updated prospect
   */
  async updateProspect(id, data) {
    const response = await api.put(`/prospects/${id}`, data);
    return response.data;
  },

  /**
   * Delete prospect
   * @param {number} id - Prospect ID
   * @returns {Promise<object>} Success message
   */
  async deleteProspect(id) {
    const response = await api.delete(`/prospects/${id}`);
    return response.data;
  },

  /**
   * Get prospect statistics
   * @returns {Promise<object>} Stats object with totals by connection status
   */
  async getStats() {
    const response = await api.get('/prospects/stats');
    return response.data;
  },

  /**
   * Attach tags to prospect
   * @param {number} prospectId - Prospect ID
   * @param {array} tagIds - Array of tag IDs
   * @returns {Promise<object>} Updated prospect with tags
   */
  async attachTags(prospectId, tagIds) {
    const response = await api.post(`/prospects/${prospectId}/tags`, { tag_ids: tagIds });
    return response.data;
  },

  /**
   * Detach tag from prospect
   * @param {number} prospectId - Prospect ID
   * @param {number} tagId - Tag ID to remove
   * @returns {Promise<object>} Updated prospect without the tag
   */
  async detachTag(prospectId, tagId) {
    const response = await api.delete(`/prospects/${prospectId}/tags/${tagId}`);
    return response.data;
  },

  /**
   * Bulk import prospects
   * @param {array} prospects - Array of prospect objects
   * @returns {Promise<object>} Import result with created/skipped counts
   */
  async bulkImport(prospects) {
    const response = await api.post('/prospects/bulk', { prospects });
    return response.data;
  },

  /**
   * Bulk delete prospects
   * @param {array} prospectIds - Array of prospect IDs to delete
   * @returns {Promise<object>} Result with deleted count
   */
  async bulkDelete(prospectIds) {
    const response = await api.post('/prospects/bulk-delete', { prospect_ids: prospectIds });
    return response.data;
  },

  /**
   * Bulk attach tags to prospects
   * @param {array} prospectIds - Array of prospect IDs
   * @param {array} tagIds - Array of tag IDs to attach
   * @returns {Promise<object>} Result with updated count
   */
  async bulkAttachTags(prospectIds, tagIds) {
    const response = await api.post('/prospects/bulk-attach-tags', {
      prospect_ids: prospectIds,
      tag_ids: tagIds
    });
    return response.data;
  },

  /**
   * Get prospects with email addresses
   * @returns {Promise<array>} Array of prospects with email
   */
  async getProspectsWithEmail() {
    const response = await api.get('/prospects', {
      params: {
        per_page: 100,
        has_email: true
      }
    });
    // Filter to only return prospects with email
    const prospects = response.data?.data || response.data?.prospects || [];
    return prospects.filter(p => p.email && p.email.trim() !== '');
  }
};
