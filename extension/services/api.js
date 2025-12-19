/**
 * API Service (OAuth Version)
 *
 * Handles all communication with the Laravel backend API.
 * Uses Fetch API for HTTP requests with bearer token authentication.
 * Authentication is handled via LinkedIn OAuth (no login/register endpoints).
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

  console.log('[API] Making request:', {
    endpoint,
    method,
    hasToken: !!token,
    hasBody: !!body,
    bodyKeys: body ? Object.keys(body) : []
  });

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

  // Add body for POST/PUT/PATCH requests
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
    console.log('[API] Request body:', options.body.substring(0, 200) + '...');
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

// ==================== CAMPAIGN API METHODS ====================

/**
 * Get all campaigns with optional filters
 * @param {object} filters - Optional filters (status, search, per_page, page)
 * @returns {Promise<object>} Paginated campaigns
 */
async function getCampaigns(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return await apiCall(`/campaigns${params ? '?' + params : ''}`, 'GET');
}

/**
 * Get single campaign by ID
 * @param {number} id - Campaign ID
 * @returns {Promise<object>} Campaign object with steps and prospects
 */
async function getCampaign(id) {
  return await apiCall(`/campaigns/${id}`, 'GET');
}

/**
 * Create a new campaign
 * @param {object} campaignData - Campaign data (name, description, daily_limit, steps)
 * @returns {Promise<object>} Created campaign
 */
async function createCampaign(campaignData) {
  return await apiCall('/campaigns', 'POST', campaignData);
}

/**
 * Update an existing campaign
 * @param {number} id - Campaign ID
 * @param {object} campaignData - Updated campaign data
 * @returns {Promise<object>} Updated campaign
 */
async function updateCampaign(id, campaignData) {
  return await apiCall(`/campaigns/${id}`, 'PUT', campaignData);
}

/**
 * Delete a campaign
 * @param {number} id - Campaign ID
 * @returns {Promise<object>} Delete confirmation
 */
async function deleteCampaign(id) {
  return await apiCall(`/campaigns/${id}`, 'DELETE');
}

/**
 * Add prospects to a campaign
 * @param {number} id - Campaign ID
 * @param {Array<number>} prospectIds - Array of prospect IDs
 * @returns {Promise<object>} Result with count of added prospects
 */
async function addProspectsToCampaign(id, prospectIds) {
  return await apiCall(`/campaigns/${id}/prospects/add`, 'POST', { prospect_ids: prospectIds });
}

/**
 * Remove prospects from a campaign
 * @param {number} id - Campaign ID
 * @param {Array<number>} prospectIds - Array of prospect IDs
 * @returns {Promise<object>} Result with count of removed prospects
 */
async function removeProspectsFromCampaign(id, prospectIds) {
  return await apiCall(`/campaigns/${id}/prospects/remove`, 'POST', { prospect_ids: prospectIds });
}

/**
 * Start/activate a campaign
 * @param {number} id - Campaign ID
 * @returns {Promise<object>} Updated campaign
 */
async function startCampaign(id) {
  return await apiCall(`/campaigns/${id}/start`, 'POST');
}

/**
 * Pause a campaign
 * @param {number} id - Campaign ID
 * @returns {Promise<object>} Updated campaign
 */
async function pauseCampaign(id) {
  return await apiCall(`/campaigns/${id}/pause`, 'POST');
}

/**
 * Get campaign statistics
 * @returns {Promise<object>} Campaign stats (total, active, draft, etc.)
 */
async function getCampaignStats() {
  return await apiCall('/campaigns/stats', 'GET');
}

/**
 * Get available campaign action types
 * @returns {Promise<object>} Array of campaign actions (visit, invite, message, follow)
 */
async function getCampaignActions() {
  return await apiCall('/campaign-actions', 'GET');
}

/**
 * Get single campaign action by ID
 * @param {number} id - Campaign action ID
 * @returns {Promise<object>} Campaign action object
 */
async function getCampaignAction(id) {
  return await apiCall(`/campaign-actions/${id}`, 'GET');
}

// ==================== EXTENSION API METHODS ====================
// These methods route through the background script to avoid CORS issues
// when called from content scripts on linkedin.com

/**
 * Check if we're running in a content script context (needs background routing)
 * @returns {boolean}
 */
function isContentScriptContext() {
  return typeof window !== 'undefined' &&
         window.location &&
         window.location.href.includes('linkedin.com');
}

/**
 * Make API call through background script (for content scripts)
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @returns {Promise<object>}
 */
async function backgroundApiCall(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      reject(new Error('Extension context invalidated. Please refresh the page.'));
      return;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint,
        method,
        body
      }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Extension context invalidated') ||
              errorMsg.includes('message port closed')) {
            reject(new Error('Extension was reloaded. Please refresh this page.'));
          } else {
            reject(new Error(errorMsg));
          }
          return;
        }
        if (response && response.error) {
          const error = new Error(response.error);
          error.status = response.status || 0;
          reject(error);
          return;
        }
        resolve(response);
      });
    } catch (e) {
      if (e.message.includes('Extension context invalidated')) {
        reject(new Error('Extension was reloaded. Please refresh this page.'));
      } else {
        reject(e);
      }
    }
  });
}

/**
 * Verify LinkedIn account matches backend user
 * @param {string} linkedinProfileUrl - Current LinkedIn profile URL
 * @param {string} linkedinName - Current LinkedIn user's name
 * @returns {Promise<object>} Verification result
 */
async function verifyLinkedInAccount(linkedinProfileUrl, linkedinName = null) {
  const body = {
    linkedin_profile_url: linkedinProfileUrl,
    linkedin_name: linkedinName
  };

  if (isContentScriptContext()) {
    return await backgroundApiCall('/extension/verify-account', 'POST', body);
  }
  return await apiCall('/extension/verify-account', 'POST', body);
}

/**
 * Get the next pending action to execute
 * @returns {Promise<object>} Next action or null if none
 */
async function getNextAction() {
  if (isContentScriptContext()) {
    return await backgroundApiCall('/extension/actions/next', 'GET');
  }
  return await apiCall('/extension/actions/next', 'GET');
}

/**
 * Report action completion (success or failure)
 * @param {number} actionId - Action ID
 * @param {string} status - 'completed' or 'failed'
 * @param {string|null} result - Result message
 * @param {string|null} error - Error message (for failures)
 * @param {boolean} retry - Whether to retry on failure
 * @returns {Promise<object>} Completion result
 */
async function completeAction(actionId, status, result = null, error = null, retry = false) {
  const body = { status, result, error, retry };

  if (isContentScriptContext()) {
    return await backgroundApiCall(`/extension/actions/${actionId}/complete`, 'POST', body);
  }
  return await apiCall(`/extension/actions/${actionId}/complete`, 'POST', body);
}

/**
 * Get action queue statistics
 * @returns {Promise<object>} Action queue stats
 */
async function getActionStats() {
  if (isContentScriptContext()) {
    return await backgroundApiCall('/extension/actions/stats', 'GET');
  }
  return await apiCall('/extension/actions/stats', 'GET');
}

/**
 * Get active campaigns with pending actions
 * @returns {Promise<object>} Active campaigns
 */
async function getActiveCampaigns() {
  if (isContentScriptContext()) {
    return await backgroundApiCall('/extension/campaigns/active', 'GET');
  }
  return await apiCall('/extension/campaigns/active', 'GET');
}

/**
 * Update prospect email by LinkedIn ID
 * @param {string} linkedinId - LinkedIn ID (e.g., "john-doe-123456")
 * @param {string} email - Email address to save
 * @returns {Promise<object>} Update result
 */
async function updateProspectEmail(linkedinId, email) {
  const body = { email };

  if (isContentScriptContext()) {
    return await backgroundApiCall(`/extension/prospects/${linkedinId}/email`, 'PATCH', body);
  }
  return await apiCall(`/extension/prospects/${linkedinId}/email`, 'PATCH', body);
}

/**
 * Get email extraction results for a campaign
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<object>} Extraction results with counts and prospect lists
 */
async function getExtractionResults(campaignId) {
  if (isContentScriptContext()) {
    return await backgroundApiCall(`/extension/campaigns/${campaignId}/extraction-results`, 'GET');
  }
  return await apiCall(`/extension/campaigns/${campaignId}/extraction-results`, 'GET');
}
