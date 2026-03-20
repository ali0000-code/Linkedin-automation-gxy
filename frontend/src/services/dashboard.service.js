/**
 * @file dashboard.service.js - API call for dashboard statistics
 *
 * Single endpoint that returns aggregated stats: prospect totals, campaign counts,
 * today's completed/pending actions by type, active campaign progress, and next scheduled action.
 */

import api from './api';

const dashboardService = {
  /**
   * Get dashboard statistics
   * @returns {Promise}
   */
  async getStats() {
    const response = await api.get('/dashboard');
    return response.data;
  },
};

export default dashboardService;
