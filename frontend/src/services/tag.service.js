/**
 * Tag Service
 *
 * Handles all tag-related API operations.
 */

import api from './api';

export const tagService = {
  /**
   * Get all tags for the authenticated user
   * @returns {Promise<array>} Array of tag objects
   */
  async getTags() {
    const response = await api.get('/tags');
    console.log('getTags response.data:', response.data);
    // Backend returns { data: [...] } for collections
    return response.data.data || response.data;
  },

  /**
   * Get single tag by ID
   * @param {number} id - Tag ID
   * @returns {Promise<object>} Tag object
   */
  async getTag(id) {
    const response = await api.get(`/tags/${id}`);
    return response.data.tag; // Extract tag from nested response
  },

  /**
   * Create new tag
   * @param {object} data - Tag data (name, color)
   * @returns {Promise<object>} Created tag
   */
  async createTag(data) {
    console.log('Sending tag create request:', data);
    const response = await api.post('/tags', data);
    console.log('Tag create response:', response);
    console.log('Tag create response.data:', response.data);
    console.log('Tag create response.data.tag:', response.data.tag);
    return response.data.tag; // Extract tag from nested response
  },

  /**
   * Update tag
   * @param {number} id - Tag ID
   * @param {object} data - Updated tag data
   * @returns {Promise<object>} Updated tag
   */
  async updateTag(id, data) {
    const response = await api.put(`/tags/${id}`, data);
    return response.data.tag; // Extract tag from nested response
  },

  /**
   * Delete tag
   * @param {number} id - Tag ID
   * @returns {Promise<object>} Success message
   */
  async deleteTag(id) {
    const response = await api.delete(`/tags/${id}`);
    return response.data;
  }
};
