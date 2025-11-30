/**
 * Options Page Script
 *
 * Handles login, logout, and settings management.
 */

// DOM elements
let loginSection;
let settingsSection;
let loginForm;
let emailInput;
let passwordInput;
let loginBtn;
let loginMessage;
let currentUserEl;
let logoutBtn;
let apiUrlInput;
let saveApiUrlBtn;
let apiUrlMessage;
let defaultLimitInput;
let saveLimitBtn;
let limitMessage;
let loadingOverlay;

/**
 * Initialize options page when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Options] Initializing...');

  // Get DOM elements
  loginSection = document.getElementById('login-section');
  settingsSection = document.getElementById('settings-section');
  loginForm = document.getElementById('login-form');
  emailInput = document.getElementById('email');
  passwordInput = document.getElementById('password');
  loginBtn = document.getElementById('login-btn');
  loginMessage = document.getElementById('login-message');
  currentUserEl = document.getElementById('current-user');
  logoutBtn = document.getElementById('logout-btn');
  apiUrlInput = document.getElementById('api-url');
  saveApiUrlBtn = document.getElementById('save-api-url');
  apiUrlMessage = document.getElementById('api-url-message');
  defaultLimitInput = document.getElementById('default-limit');
  saveLimitBtn = document.getElementById('save-limit');
  limitMessage = document.getElementById('limit-message');
  loadingOverlay = document.getElementById('loading-overlay');

  // Set up event listeners
  loginForm.addEventListener('submit', handleLoginSubmit);
  logoutBtn.addEventListener('click', handleLogoutClick);
  saveApiUrlBtn.addEventListener('click', handleSaveApiUrl);
  saveLimitBtn.addEventListener('click', handleSaveLimit);

  // Load saved values
  await loadSavedSettings();

  // Check authentication status
  const authenticated = await isAuthenticated();

  if (authenticated) {
    await showSettingsSection();
  } else {
    showLoginSection();
  }

  console.log('[Options] Initialization complete');
});

/**
 * Load saved settings from storage
 */
async function loadSavedSettings() {
  const apiUrl = await getApiUrl();
  const limit = await getExtractionLimit();

  apiUrlInput.value = apiUrl;
  defaultLimitInput.value = limit;
}

/**
 * Show login section
 */
function showLoginSection() {
  loginSection.classList.remove('hidden');
  settingsSection.classList.add('hidden');
}

/**
 * Show settings section
 */
async function showSettingsSection() {
  loginSection.classList.add('hidden');
  settingsSection.classList.remove('hidden');

  // Display user email
  const email = await getStoredUserEmail();
  if (email) {
    currentUserEl.textContent = email;
  }
}

/**
 * Handle login form submit
 */
async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage(loginMessage, 'Please enter email and password', 'error');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    showLoading(true);

    // Attempt login
    const user = await handleLogin(email, password);

    console.log('[Options] Login successful:', user);

    // Show success message
    showMessage(loginMessage, 'Login successful!', 'success');

    // Clear form
    passwordInput.value = '';

    // Switch to settings view after short delay
    setTimeout(() => {
      showSettingsSection();
    }, 1000);

  } catch (error) {
    console.error('[Options] Login error:', error);
    showMessage(loginMessage, 'Login failed: ' + error.message, 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
    showLoading(false);
  }
}

/**
 * Handle logout button click
 */
async function handleLogoutClick() {
  try {
    showLoading(true);

    await handleLogout();

    console.log('[Options] Logout successful');

    // Show login section
    showLoginSection();

    // Clear login form
    emailInput.value = '';
    passwordInput.value = '';

    showMessage(loginMessage, 'Logged out successfully', 'success');

  } catch (error) {
    console.error('[Options] Logout error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Handle save API URL button click
 */
async function handleSaveApiUrl() {
  const apiUrl = apiUrlInput.value.trim();

  if (!apiUrl) {
    showMessage(apiUrlMessage, 'Please enter a valid URL', 'error');
    return;
  }

  try {
    await setApiUrl(apiUrl);
    showMessage(apiUrlMessage, 'API URL saved successfully', 'success');

    // Hide message after 2 seconds
    setTimeout(() => {
      hideMessage(apiUrlMessage);
    }, 2000);

  } catch (error) {
    showMessage(apiUrlMessage, 'Failed to save API URL', 'error');
  }
}

/**
 * Handle save limit button click
 */
async function handleSaveLimit() {
  const limit = parseInt(defaultLimitInput.value);

  if (isNaN(limit) || limit < 1 || limit > 100) {
    showMessage(limitMessage, 'Please enter a number between 1 and 100', 'error');
    return;
  }

  try {
    await setExtractionLimit(limit);
    showMessage(limitMessage, 'Extraction limit saved successfully', 'success');

    // Hide message after 2 seconds
    setTimeout(() => {
      hideMessage(limitMessage);
    }, 2000);

  } catch (error) {
    showMessage(limitMessage, 'Failed to save extraction limit', 'error');
  }
}

/**
 * Show message
 * @param {HTMLElement} element - Message element
 * @param {string} text - Message text
 * @param {string} type - Message type (success, error, info)
 */
function showMessage(element, text, type) {
  element.textContent = text;
  element.className = 'message ' + type;
  element.classList.remove('hidden');
}

/**
 * Hide message
 * @param {HTMLElement} element - Message element
 */
function hideMessage(element) {
  element.classList.add('hidden');
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Show or hide
 */
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}
