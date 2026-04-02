/**
 * @file api.js - Configured Axios instance with auth interceptors
 *
 * Central HTTP client for all backend API calls. Every service file imports this instance.
 *
 * Request interceptor: reads the auth token from localStorage (key: 'auth_token')
 * and attaches it as a Bearer token on every outgoing request. This is read from
 * localStorage directly (not Zustand) to keep the interceptor decoupled from React state.
 *
 * Response interceptor: catches 401 Unauthorized responses (expired/invalid token),
 * clears local auth data, and hard-redirects to /login. This ensures the user is
 * always sent to login when their session expires, regardless of which page they're on.
 *
 * Timeout: 30 seconds -- long enough for slow backend operations (bulk imports, email sending)
 * but short enough to fail fast on network issues.
 */

import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor
 * Attaches the authentication token to every request
 */
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles common error responses (401 unauthorized)
 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');

      // Redirect to login page
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
