/**
 * Campaign API Service
 *
 * Handles all HTTP requests related to campaigns.
 */

import api from './api';

const campaignService = {
  /**
   * Get paginated campaigns with filters
   * @param {Object} filters - Query filters (status, search, per_page, page)
   * @returns {Promise}
   */
  async getCampaigns(filters = {}) {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.per_page) params.append('per_page', filters.per_page);
    if (filters.page) params.append('page', filters.page);

    const response = await api.get(`/campaigns?${params.toString()}`);
    return response.data;
  },

  /**
   * Get a single campaign by ID
   * @param {number} id - Campaign ID
   * @returns {Promise}
   */
  async getCampaign(id) {
    const response = await api.get(`/campaigns/${id}`);
    return response.data;
  },

  /**
   * Create a new campaign
   * @param {Object} data - Campaign data (name, description, daily_limit, steps)
   * @returns {Promise}
   */
  async createCampaign(data) {
    const response = await api.post('/campaigns', data);
    return response.data;
  },

  /**
   * Update an existing campaign
   * @param {number} id - Campaign ID
   * @param {Object} data - Updated campaign data
   * @returns {Promise}
   */
  async updateCampaign(id, data) {
    const response = await api.put(`/campaigns/${id}`, data);
    return response.data;
  },

  /**
   * Delete a campaign
   * @param {number} id - Campaign ID
   * @returns {Promise}
   */
  async deleteCampaign(id) {
    const response = await api.delete(`/campaigns/${id}`);
    return response.data;
  },

  /**
   * Add prospects to a campaign
   * @param {number} id - Campaign ID
   * @param {Array} prospectIds - Array of prospect IDs
   * @returns {Promise}
   */
  async addProspects(id, prospectIds) {
    const response = await api.post(`/campaigns/${id}/prospects/add`, {
      prospect_ids: prospectIds,
    });
    return response.data;
  },

  /**
   * Remove prospects from a campaign
   * @param {number} id - Campaign ID
   * @param {Array} prospectIds - Array of prospect IDs
   * @returns {Promise}
   */
  async removeProspects(id, prospectIds) {
    const response = await api.post(`/campaigns/${id}/prospects/remove`, {
      prospect_ids: prospectIds,
    });
    return response.data;
  },

  /**
   * Start/activate a campaign
   * @param {number} id - Campaign ID
   * @returns {Promise}
   */
  async startCampaign(id) {
    const response = await api.post(`/campaigns/${id}/start`);
    return response.data;
  },

  /**
   * Pause a campaign
   * @param {number} id - Campaign ID
   * @returns {Promise}
   */
  async pauseCampaign(id) {
    const response = await api.post(`/campaigns/${id}/pause`);
    return response.data;
  },

  /**
   * Get campaign statistics
   * @returns {Promise}
   */
  async getStats() {
    const response = await api.get('/campaigns/stats');
    return response.data;
  },

  /**
   * Get available campaign action types
   * @returns {Promise}
   */
  async getCampaignActions() {
    const response = await api.get('/campaign-actions');
    return response.data;
  },
};

export default campaignService;
