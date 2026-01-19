/**
 * Dashboard API Service
 *
 * Handles HTTP requests for dashboard statistics.
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
