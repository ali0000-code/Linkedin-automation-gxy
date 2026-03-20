/**
 * Template Service
 *
 * Handles all message template-related API operations.
 */

import api from './api';

export const templateService = {
  /**
   * Get all templates, optionally filtered by type
   * @param {string} type - Optional filter by type ('invitation' or 'message')
   * @returns {Promise<object>} Templates response
   */
  async getTemplates(type = null) {
    const params = type ? { type } : {};
    const response = await api.get('/templates', { params });
    return response.data;
  },

  /**
   * Get single template by ID
   * @param {number} id - Template ID
   * @returns {Promise<object>} Template object
   */
  async getTemplate(id) {
    const response = await api.get(`/templates/${id}`);
    return response.data;
  },

  /**
   * Create new template
   * @param {object} data - Template data (name, type, content)
   * @returns {Promise<object>} Created template
   */
  async createTemplate(data) {
    const response = await api.post('/templates', data);
    return response.data;
  },

  /**
   * Update template
   * @param {number} id - Template ID
   * @param {object} data - Updated template data
   * @returns {Promise<object>} Updated template
   */
  async updateTemplate(id, data) {
    const response = await api.put(`/templates/${id}`, data);
    return response.data;
  },

  /**
   * Delete template
   * @param {number} id - Template ID
   * @returns {Promise<object>} Success message
   */
  async deleteTemplate(id) {
    const response = await api.delete(`/templates/${id}`);
    return response.data;
  },

  /**
   * Bulk delete templates
   * @param {Array<number>} templateIds - Array of template IDs
   * @returns {Promise<object>} Success message with count
   */
  async bulkDeleteTemplates(templateIds) {
    const response = await api.post('/templates/bulk-delete', {
      template_ids: templateIds,
    });
    return response.data;
  },
};
