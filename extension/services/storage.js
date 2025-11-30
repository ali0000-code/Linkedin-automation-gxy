/**
 * Chrome Storage Service
 *
 * Wrapper for Chrome Storage API to manage extension data.
 * All functions return promises for async/await compatibility.
 */

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_EMAIL: 'user_email',
  API_URL: 'api_url',
  EXTRACTION_LIMIT: 'extraction_limit'
};

// Default values
const DEFAULTS = {
  API_URL: 'http://localhost:8000/api',
  EXTRACTION_LIMIT: 100
};

/**
 * Get authentication token
 * @returns {Promise<string|null>} Bearer token or null if not found
 */
async function getAuthToken() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
  return result[STORAGE_KEYS.AUTH_TOKEN] || null;
}

/**
 * Set authentication token
 * @param {string} token - Bearer token from login
 * @returns {Promise<void>}
 */
async function setAuthToken(token) {
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: token });
}

/**
 * Get user email
 * @returns {Promise<string|null>} User email or null if not found
 */
async function getUserEmail() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_EMAIL);
  return result[STORAGE_KEYS.USER_EMAIL] || null;
}

/**
 * Set user email
 * @param {string} email - User's email address
 * @returns {Promise<void>}
 */
async function setUserEmail(email) {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_EMAIL]: email });
}

/**
 * Get API base URL
 * @returns {Promise<string>} API URL (defaults to localhost:8000)
 */
async function getApiUrl() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.API_URL);
  return result[STORAGE_KEYS.API_URL] || DEFAULTS.API_URL;
}

/**
 * Set API base URL
 * @param {string} url - API base URL
 * @returns {Promise<void>}
 */
async function setApiUrl(url) {
  await chrome.storage.local.set({ [STORAGE_KEYS.API_URL]: url });
}

/**
 * Get extraction limit
 * @returns {Promise<number>} Extraction limit (defaults to 100)
 */
async function getExtractionLimit() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.EXTRACTION_LIMIT);
  return result[STORAGE_KEYS.EXTRACTION_LIMIT] || DEFAULTS.EXTRACTION_LIMIT;
}

/**
 * Set extraction limit
 * @param {number} limit - Max prospects per extraction
 * @returns {Promise<void>}
 */
async function setExtractionLimit(limit) {
  await chrome.storage.local.set({ [STORAGE_KEYS.EXTRACTION_LIMIT]: limit });
}

/**
 * Clear all authentication data (logout)
 * @returns {Promise<void>}
 */
async function clearAuth() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_EMAIL
  ]);
}

/**
 * Clear all storage data (reset)
 * @returns {Promise<void>}
 */
async function clearAll() {
  await chrome.storage.local.clear();
}
