/**
 * API Service
 *
 * Handles all communication with the Laravel backend API.
 * Uses Fetch API for HTTP requests with bearer token authentication.
 */

/**
 * Base API caller with authentication
 * @param {string} endpoint - API endpoint (e.g., '/login', '/prospects')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object|null} body - Request body for POST/PUT requests
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} If response is not ok or network error
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = await getAuthToken();
  const apiUrl = await getApiUrl();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Add bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  // Add body for POST/PUT requests
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, options);
    const data = await response.json();

    // Check if response is ok
    if (!response.ok) {
      // Create error object with status and message
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.errors = data.errors || {};
      throw error;
    }

    return data;
  } catch (error) {
    // Re-throw with additional context
    if (!error.status) {
      error.status = 0; // Network error
      error.message = 'Network error: Unable to reach the server';
    }
    throw error;
  }
}

/**
 * Login to backend
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} Response with user and token
 */
async function login(email, password) {
  return await apiCall('/login', 'POST', { email, password });
}

/**
 * Logout from backend (revoke token)
 * @returns {Promise<object>} Logout confirmation
 */
async function logout() {
  return await apiCall('/logout', 'POST');
}

/**
 * Get authenticated user info
 * @returns {Promise<object>} User object
 */
async function getUser() {
  return await apiCall('/user', 'GET');
}

/**
 * Bulk import prospects to backend
 * @param {Array<object>} prospects - Array of prospect objects
 * @returns {Promise<object>} Import result with created/skipped counts
 */
async function bulkImportProspects(prospects) {
  return await apiCall('/prospects/bulk', 'POST', { prospects });
}

/**
 * Get prospect statistics
 * @returns {Promise<object>} Stats object with counts
 */
async function getProspectStats() {
  return await apiCall('/prospects/stats', 'GET');
}

/**
 * Get all prospects with pagination
 * @param {number} page - Page number (default 1)
 * @param {number} perPage - Items per page (default 15)
 * @returns {Promise<object>} Paginated prospects
 */
async function getProspects(page = 1, perPage = 15) {
  return await apiCall(`/prospects?page=${page}&per_page=${perPage}`, 'GET');
}

/**
 * Get single prospect by ID
 * @param {number} id - Prospect ID
 * @returns {Promise<object>} Prospect object
 */
async function getProspect(id) {
  return await apiCall(`/prospects/${id}`, 'GET');
}

/**
 * Delete prospect by ID
 * @param {number} id - Prospect ID
 * @returns {Promise<object>} Delete confirmation
 */
async function deleteProspect(id) {
  return await apiCall(`/prospects/${id}`, 'DELETE');
}
