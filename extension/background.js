/**
 * Background Service Worker
 *
 * Handles message routing, campaign monitoring, and background tasks.
 * In Manifest V3, this runs as a service worker (event-driven, not persistent).
 */

console.log('[Background] LinkedIn Automation service worker loaded');

// Track queue status
let queueStatus = {
  isRunning: false,
  lastUpdate: null,
  stats: { completed: 0, failed: 0 }
};

/**
 * Listen for extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('[Background] First time install - opening options page');
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('[Background] Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, 'from:', sender.tab ? 'content script' : 'popup');

  // Handle different message types
  switch (message.type) {
    case 'EXTRACTION_PROGRESS':
      // Forward progress updates from content script to popup
      console.log('[Background] Progress update:', message.current, '/', message.limit);
      break;

    case 'BACKGROUND_PING':
      // Health check
      sendResponse({ success: true, message: 'Background service worker is running' });
      break;

    case 'QUEUE_STATUS':
      // Queue status update from content script
      console.log('[Background] Queue status:', message.status, '-', message.message);
      queueStatus = {
        isRunning: message.status === 'running' || message.status === 'executing',
        lastUpdate: new Date().toISOString(),
        status: message.status,
        message: message.message,
        stats: message.stats || queueStatus.stats
      };
      // Store in chrome.storage for persistence
      chrome.storage.local.set({ queue_status: queueStatus });
      break;

    case 'QUEUE_ERROR':
      // Queue error from content script
      console.error('[Background] Queue error:', message.message);
      queueStatus.lastError = message.message;
      chrome.storage.local.set({ queue_status: queueStatus });
      break;

    case 'CAMPAIGN_COMPLETED':
      // Campaign finished - show notification and update status
      console.log('[Background] Campaign completed!', message.stats, 'Type:', message.actionType);
      queueStatus = {
        isRunning: false,
        lastUpdate: new Date().toISOString(),
        status: 'completed',
        message: 'Campaign completed successfully',
        stats: message.stats || queueStatus.stats
      };
      chrome.storage.local.set({ queue_status: queueStatus });

      // Check if this was an email campaign
      if (message.actionType === 'email' && message.campaignId) {
        console.log('[Background] Email campaign completed, showing results modal');

        // Store the campaign ID so popup can show results when opened
        chrome.storage.local.set({ extraction_completed_campaign: message.campaignId });

        // Try to send message to popup (if open)
        try {
          chrome.runtime.sendMessage({
            type: 'EXTRACTION_COMPLETE',
            campaignId: message.campaignId
          }).catch(() => {
            // Popup might not be open, that's okay - we stored in local storage
            console.log('[Background] Popup not open, results will show when opened');
          });
        } catch (e) {
          console.log('[Background] Could not send to popup:', e.message);
        }

        // Show browser notification for email campaign
        try {
          chrome.notifications.create('email-campaign-completed', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Email Extraction Complete!',
            message: `Extracted emails from ${message.stats?.completed || 0} profiles. Click to see results.`,
            priority: 2
          });
        } catch (e) {
          console.log('[Background] Could not show notification:', e.message);
        }
      } else {
        // Show browser notification for regular campaigns
        try {
          chrome.notifications.create('campaign-completed', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Campaign Completed!',
            message: `Completed ${message.stats?.completed || 0} actions. ${message.stats?.failed || 0} failed.`,
            priority: 2
          });
        } catch (e) {
          console.log('[Background] Could not show notification:', e.message);
        }
      }
      break;

    case 'GET_QUEUE_STATUS':
      // Return current queue status
      sendResponse({ success: true, status: queueStatus });
      break;

    case 'START_CAMPAIGN_QUEUE':
      // Start the campaign queue - forward to LinkedIn tab
      startQueueOnLinkedIn()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'STOP_CAMPAIGN_QUEUE':
      // Stop the campaign queue - forward to LinkedIn tab
      stopQueueOnLinkedIn(message.reason)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'API_REQUEST':
      // Proxy API requests from content scripts to avoid CORS
      handleApiRequest(message.endpoint, message.method, message.body)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message, status: error.status || 0 }));
      return true; // Async response

    default:
      console.log('[Background] Unknown message type:', message.type);
  }

  return false; // Synchronous response
});

/**
 * Handle API request from content script (proxy to avoid CORS)
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @returns {Promise<object>}
 */
async function handleApiRequest(endpoint, method = 'GET', body = null) {
  console.log('[Background] Proxying API request:', method, endpoint);

  const token = await getAuthToken();
  const apiUrl = await getApiUrl();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[Background] API request failed:', error);
    throw error;
  }
}

/**
 * Listen for messages from webapp (external messages)
 * Handles OAuth callback, logout, and campaign control from webapp
 */
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received external message:', message.type, 'from:', sender.url);

  // Handle PING - used to check if extension is installed
  if (message.type === 'PING') {
    sendResponse({ success: true, message: 'Extension is active', extensionId: chrome.runtime.id });
    return false;
  }

  // Handle START_CAMPAIGN_QUEUE from webapp
  if (message.type === 'START_CAMPAIGN_QUEUE') {
    console.log('[Background] Starting campaign queue from webapp');
    startQueueOnLinkedIn()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle STOP_CAMPAIGN_QUEUE from webapp
  if (message.type === 'STOP_CAMPAIGN_QUEUE') {
    console.log('[Background] Stopping campaign queue from webapp');
    stopQueueOnLinkedIn(message.reason || 'Stopped from webapp')
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle GET_QUEUE_STATUS from webapp
  if (message.type === 'GET_QUEUE_STATUS') {
    sendResponse({ success: true, status: queueStatus });
    return false;
  }

  if (message.type === 'AUTH_SUCCESS' && message.token) {
    handleAuthSuccess(message.token)
      .then(() => {
        sendResponse({ success: true });
        // Broadcast auth state change to all extension pages
        chrome.runtime.sendMessage({
          type: 'AUTH_STATE_CHANGED',
          authenticated: true
        }).catch(() => {
          // Ignore errors if no listeners (extension pages not open)
          console.log('[Background] No listeners for AUTH_STATE_CHANGED');
        });
      })
      .catch((error) => {
        console.error('[Background] Auth success handler failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Async response
  }

  if (message.type === 'LOGOUT') {
    handleLogout()
      .then(() => {
        sendResponse({ success: true });
        // Broadcast auth state change to all extension pages
        chrome.runtime.sendMessage({
          type: 'AUTH_STATE_CHANGED',
          authenticated: false
        }).catch(() => {
          console.log('[Background] No listeners for AUTH_STATE_CHANGED');
        });
      })
      .catch((error) => {
        console.error('[Background] Logout handler failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Async response
  }

  return false;
});

/**
 * Handle successful authentication
 * Stores token and fetches user data
 * @param {string} token - Sanctum access token
 */
async function handleAuthSuccess(token) {
  console.log('[Background] Handling auth success...');

  try {
    // Store token in Chrome storage
    await chrome.storage.local.set({ auth_token: token });
    console.log('[Background] Token stored');

    // Fetch user data from API
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    const userData = await response.json();
    console.log('[Background] User data fetched:', userData);

    // Store user data
    await chrome.storage.local.set({
      user: userData.data,
      user_email: userData.data.email
    });

    console.log('[Background] Auth success complete');
  } catch (error) {
    console.error('[Background] Auth success error:', error);
    throw error;
  }
}

/**
 * Handle logout
 * Clears all auth data from storage
 */
async function handleLogout() {
  console.log('[Background] Handling logout...');

  try {
    // Clear auth data from Chrome storage
    await chrome.storage.local.remove(['auth_token', 'user', 'user_email']);
    console.log('[Background] Auth data cleared');
  } catch (error) {
    console.error('[Background] Logout error:', error);
    throw error;
  }
}

/**
 * Get API URL from storage
 * @returns {Promise<string>} API URL
 */
async function getApiUrl() {
  const result = await chrome.storage.local.get('api_url');
  return result.api_url || 'http://localhost:8000/api';
}

/**
 * Handle extension icon click
 * Note: This is not needed when using default_popup in manifest
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Extension icon clicked on tab:', tab.id);
  // Popup will open automatically due to default_popup in manifest
});

/**
 * Find or create a LinkedIn tab and start the queue
 * @returns {Promise<object>}
 */
async function startQueueOnLinkedIn() {
  console.log('[Background] Starting queue on LinkedIn...');

  try {
    // Find existing LinkedIn tab
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

    let linkedInTab;
    let needToWait = false;

    if (tabs.length > 0) {
      // Use existing tab
      linkedInTab = tabs[0];
      console.log('[Background] Found existing LinkedIn tab:', linkedInTab.id);

      // Focus the tab
      await chrome.tabs.update(linkedInTab.id, { active: true });
      await chrome.windows.update(linkedInTab.windowId, { focused: true });
    } else {
      // Create new LinkedIn tab
      console.log('[Background] Creating new LinkedIn tab');
      linkedInTab = await chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
      needToWait = true;
    }

    // Wait for page to fully load if we created a new tab
    if (needToWait) {
      await waitForTabLoad(linkedInTab.id);
    }

    // Try to send message to content script with retries
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        response = await chrome.tabs.sendMessage(linkedInTab.id, { type: 'START_QUEUE' });
        if (response) break;
      } catch (e) {
        lastError = e;
        console.log('[Background] Content script not ready, attempt', attempt + 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response && lastError) {
      throw new Error('Content script not responding. Please refresh the LinkedIn page.');
    }

    return response || { success: true, message: 'Queue started' };

  } catch (error) {
    console.error('[Background] Failed to start queue:', error);
    throw error;
  }
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId - Tab ID to wait for
 * @param {number} timeout - Maximum wait time in ms (default 10000)
 * @returns {Promise<void>}
 */
function waitForTabLoad(tabId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);

        if (tab.status === 'complete') {
          // Additional wait for content script to initialize
          await new Promise(r => setTimeout(r, 2000));
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve(); // Resolve anyway after timeout
          return;
        }

        // Check again in 500ms
        setTimeout(checkTab, 500);
      } catch (e) {
        reject(e);
      }
    };

    checkTab();
  });
}

/**
 * Stop the queue on LinkedIn tab
 * @param {string} reason - Reason for stopping
 * @returns {Promise<object>}
 */
async function stopQueueOnLinkedIn(reason = 'User stopped') {
  console.log('[Background] Stopping queue on LinkedIn...');

  try {
    // Find LinkedIn tabs
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

    if (tabs.length === 0) {
      return { success: true, message: 'No LinkedIn tab found' };
    }

    // Send stop message to all LinkedIn tabs
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_QUEUE', reason });
      } catch (e) {
        console.log('[Background] Could not send stop to tab:', tab.id);
      }
    }

    // Update local status
    queueStatus.isRunning = false;
    queueStatus.status = 'stopped';
    queueStatus.message = reason;
    await chrome.storage.local.set({ queue_status: queueStatus });

    return { success: true, message: 'Queue stopped' };

  } catch (error) {
    console.error('[Background] Failed to stop queue:', error);
    throw error;
  }
}

/**
 * Check for active campaigns and pending actions periodically
 * This runs every 5 minutes when the extension is active
 */
async function checkForPendingActions() {
  console.log('[Background] Checking for pending actions...');

  try {
    const token = await getAuthToken();
    if (!token) {
      console.log('[Background] Not authenticated, skipping check');
      return;
    }

    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/extension/campaigns/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Background] Failed to check campaigns');
      return;
    }

    const data = await response.json();

    if (data.total_active > 0) {
      console.log('[Background] Found', data.total_active, 'active campaigns');

      // Store for popup display
      await chrome.storage.local.set({
        active_campaigns: data.campaigns,
        last_campaign_check: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[Background] Error checking campaigns:', error);
  }
}

/**
 * Get auth token from storage
 */
async function getAuthToken() {
  const result = await chrome.storage.local.get('auth_token');
  return result.auth_token;
}

/**
 * Handle tab updates to detect LinkedIn pages
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act when page is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a LinkedIn page
    if (tab.url.includes('linkedin.com')) {
      console.log('[Background] LinkedIn page loaded:', tab.url);

      // Enable extension icon for this tab
      chrome.action.enable(tabId);
    }
  }
});

/**
 * Handle errors
 */
self.addEventListener('error', (event) => {
  console.error('[Background] Service worker error:', event.error);
});

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Background] Unhandled promise rejection:', event.reason);
});

console.log('[Background] Service worker initialization complete');
