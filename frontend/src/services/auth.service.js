/**
 * @file auth.service.js - Authentication API calls (LinkedIn OAuth)
 *
 * Authentication flow: the user clicks "Sign in with LinkedIn" which redirects to
 * the backend's /api/auth/linkedin endpoint. The backend handles the OAuth dance with
 * LinkedIn and redirects back to /auth/callback#token=xxx. The LinkedInCallback page
 * then calls getUserWithToken() to fetch the user profile and store the session.
 *
 * Also provides verifyLinkedInAccount() used by the extension to verify that the
 * LinkedIn account the user is logged into matches the one linked to their webapp account.
 */

import api from './api';

export const authService = {
  /**
   * Get LinkedIn OAuth authorization URL
   * Returns the URL to redirect user to LinkedIn OAuth
   * @returns {Promise<object>} Response with OAuth URL
   */
  async getLinkedInAuthUrl() {
    const response = await api.get('/auth/linkedin/url');
    return response.data;
  },

  /**
   * Get authenticated user data with provided token
   * Used after OAuth callback to fetch user profile
   * @param {string} token - Sanctum access token
   * @returns {Promise<object>} User object
   */
  async getUserWithToken(token) {
    const response = await api.get('/user', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  },

  /**
   * Get authenticated user data (using token from store/localStorage)
   * @returns {Promise<object>} User object
   */
  async getUser() {
    const response = await api.get('/user');
    return response.data;
  },

  /**
   * Verify LinkedIn account linkage
   * Used by extension to verify user has linked their LinkedIn account
   * @param {string} linkedinId - LinkedIn user ID
   * @returns {Promise<object>} Verification response
   */
  async verifyLinkedInAccount(linkedinId) {
    const response = await api.post('/auth/linkedin/verify', {
      linkedin_id: linkedinId
    });
    return response.data;
  },

  /**
   * Logout user (revoke current Sanctum token)
   * @returns {Promise<object>} Response message
   */
  async logout() {
    const response = await api.post('/logout');
    return response.data;
  }
};
