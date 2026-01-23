/**
 * Background Service Worker
 *
 * Handles message routing, campaign monitoring, and background tasks.
 * In Manifest V3, this runs as a service worker (event-driven, not persistent).
 */

// Import LinkedIn API service
importScripts('services/linkedinApi.js');

console.log('[Background] LinkedIn Automation service worker loaded');

// ==================== UNIFIED POLLING MANAGER ====================
// Single manager to prevent multiple intervals running simultaneously

const PollingManager = {
  intervals: {},
  isRunning: false,

  /**
   * Register and start a polling task
   * @param {string} name - Unique task name
   * @param {Function} task - Async function to run
   * @param {number} intervalMs - Interval in milliseconds
   */
  start(name, task, intervalMs) {
    // Clear existing interval if any
    if (this.intervals[name]) {
      clearInterval(this.intervals[name].id);
      console.log(`[PollingManager] Cleared existing interval: ${name}`);
    }

    // Create wrapper for error handling
    const wrappedTask = async () => {
      try {
        await task();
      } catch (error) {
        console.error(`[PollingManager] Error in ${name}:`, error.message);
      }
    };

    // Run immediately
    wrappedTask();

    // Set interval
    const id = setInterval(wrappedTask, intervalMs);
    this.intervals[name] = { id, intervalMs, task };
    this.isRunning = true;

    console.log(`[PollingManager] Started ${name} every ${intervalMs / 1000}s`);
  },

  /**
   * Stop a specific polling task
   * @param {string} name - Task name to stop
   */
  stop(name) {
    if (this.intervals[name]) {
      clearInterval(this.intervals[name].id);
      delete this.intervals[name];
      console.log(`[PollingManager] Stopped ${name}`);
    }
    this.isRunning = Object.keys(this.intervals).length > 0;
  },

  /**
   * Stop all polling tasks
   */
  stopAll() {
    for (const name of Object.keys(this.intervals)) {
      clearInterval(this.intervals[name].id);
    }
    this.intervals = {};
    this.isRunning = false;
    console.log('[PollingManager] Stopped all polling tasks');
  },

  /**
   * Get status of all polling tasks
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      tasks: Object.keys(this.intervals).map(name => ({
        name,
        intervalMs: this.intervals[name].intervalMs
      }))
    };
  }
};

// ==================== LINKEDIN TAB MANAGEMENT ====================

// Mutex to prevent concurrent tab creation
let tabCreationInProgress = false;
let tabCreationPromise = null;

/**
 * Find an existing LinkedIn tab
 * @returns {Promise<chrome.tabs.Tab|null>} LinkedIn tab or null
 */
async function findLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  return tabs.length > 0 ? tabs[0] : null;
}

/**
 * Ensure a LinkedIn tab exists, create one if not
 * Uses mutex to prevent multiple tabs being created simultaneously
 * @param {boolean} pinTab - Whether to pin the tab
 * @returns {Promise<chrome.tabs.Tab>} LinkedIn tab
 */
async function ensureLinkedInTab(pinTab = true) {
  // If tab creation is already in progress, wait for it
  if (tabCreationInProgress && tabCreationPromise) {
    console.log('[Background] Tab creation already in progress, waiting...');
    return tabCreationPromise;
  }

  let tab = await findLinkedInTab();

  if (!tab) {
    // Set mutex
    tabCreationInProgress = true;

    tabCreationPromise = (async () => {
      // Double-check after acquiring mutex
      tab = await findLinkedInTab();
      if (tab) {
        tabCreationInProgress = false;
        tabCreationPromise = null;
        return tab;
      }

      console.log('[Background] No LinkedIn tab found, creating one...');
      tab = await chrome.tabs.create({
        url: 'https://www.linkedin.com/messaging/',
        active: false, // Don't focus the tab
        pinned: pinTab
      });

      // Wait for tab to load
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // Timeout after 15 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 15000);
      });

      console.log('[Background] LinkedIn tab created and loaded');

      // Release mutex
      tabCreationInProgress = false;
      tabCreationPromise = null;

      return tab;
    })();

    return tabCreationPromise;
  }

  return tab;
}

/**
 * Check if LinkedIn tab exists
 * @returns {Promise<boolean>}
 */
async function hasLinkedInTab() {
  const tab = await findLinkedInTab();
  return !!tab;
}

// Track queue status
let queueStatus = {
  isRunning: false,
  lastUpdate: null,
  status: 'idle',
  message: '',
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

  // Handle SYNC_INBOX from webapp
  if (message.type === 'SYNC_INBOX') {
    console.log('[Background] Syncing inbox from webapp');
    syncInboxOnLinkedIn(message.limit, message.includeMessages)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle OPEN_CONVERSATION from webapp (pre-load conversation for faster sending)
  if (message.type === 'OPEN_CONVERSATION') {
    console.log('[Background] Opening conversation from webapp:', message.conversationId);
    openConversationOnLinkedIn(message.conversationId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle SEND_LINKEDIN_MESSAGE from webapp
  if (message.type === 'SEND_LINKEDIN_MESSAGE') {
    console.log('[Background] Sending LinkedIn message from webapp');
    const conversationId = message.linkedinConversationId;

    sendMessageOnLinkedIn(conversationId, message.content, message.messageId)
      .then(result => {
        if (result.success) {
          // Track this conversation for polling (so we check it for replies)
          activeConversations.add(conversationId);
          console.log('[Background] 📝 Added conversation to active polling:', conversationId);

          // Save to storage for persistence
          chrome.storage.local.set({ active_conversations: activeConversations.toArray() });

          // Ensure unified polling is running (uses PollingManager, won't duplicate)
          if (!PollingManager.intervals['newMessages']) {
            console.log('[Background] Auto-starting message polling after send');
            startAllPolling();
          }
        }
        sendResponse(result);
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle SYNC_CONVERSATION_MESSAGES from webapp
  if (message.type === 'SYNC_CONVERSATION_MESSAGES') {
    console.log('[Background] Syncing conversation messages from webapp');
    syncConversationMessages(message.conversationId, message.backendConversationId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Handle CHECK_LINKEDIN_LOGIN from webapp
  if (message.type === 'CHECK_LINKEDIN_LOGIN') {
    LinkedInAPI.isLoggedIn()
      .then(isLoggedIn => sendResponse({ success: true, isLoggedIn }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
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

  // Handle START_MESSAGE_POLLING from webapp
  if (message.type === 'START_MESSAGE_POLLING') {
    const interval = message.interval || 30000;
    startMessagePolling(interval)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle STOP_MESSAGE_POLLING from webapp
  if (message.type === 'STOP_MESSAGE_POLLING') {
    stopMessagePolling()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle CHECK_MESSAGES_NOW from webapp
  if (message.type === 'CHECK_MESSAGES_NOW') {
    checkForNewMessages()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle GET_MESSAGE_POLLING_STATUS from webapp
  if (message.type === 'GET_MESSAGE_POLLING_STATUS') {
    sendResponse({
      success: true,
      isPolling: !!messagePollingInterval,
      conversationCount: Object.keys(conversationState).length
    });
    return false;
  }

  // Check for new messages status (webapp can poll this)
  if (message.type === 'GET_NEW_MESSAGES_STATUS') {
    chrome.storage.local.get(['new_messages_available', 'new_messages_count', 'new_messages_timestamp'], (result) => {
      sendResponse({
        success: true,
        hasNewMessages: result.new_messages_available || false,
        count: result.new_messages_count || 0,
        timestamp: result.new_messages_timestamp || 0
      });
      // Clear the flag after reading
      if (result.new_messages_available) {
        chrome.storage.local.set({ new_messages_available: false, new_messages_count: 0 });
      }
    });
    return true; // Async response
  }

  // Quick sync - triggered when user opens inbox page
  if (message.type === 'QUICK_SYNC_INBOX') {
    console.log('[Background] Quick sync requested');
    performAutoSync()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  // Get sync status
  if (message.type === 'GET_SYNC_STATUS') {
    chrome.storage.local.get(['last_auto_sync', 'auto_sync_active'], (result) => {
      sendResponse({
        success: true,
        lastSync: result.last_auto_sync || 0,
        isAutoSyncActive: result.auto_sync_active || false,
        timeSinceSync: result.last_auto_sync ? Date.now() - result.last_auto_sync : null
      });
    });
    return true;
  }

  // Handle MARK_MESSAGE_SENT from webapp
  if (message.type === 'MARK_MESSAGE_SENT') {
    // Pass message ID (if available) and content for deduplication
    markMessageAsSent(message.messageId || null, message.content);
    sendResponse({ success: true });
    return false;
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
 * Make API call to backend from background script
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object|null} body - Request body
 * @returns {Promise<object>}
 */
async function backgroundApiCall(endpoint, method = 'GET', body = null) {
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

  const response = await fetch(`${apiUrl}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    throw error;
  }

  return data;
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

  // IMMEDIATELY mark as running to block polling (before any async operations)
  queueStatus.isRunning = true;
  queueStatus.status = 'starting';
  queueStatus.lastUpdate = new Date().toISOString();
  await chrome.storage.local.set({ queue_status: queueStatus });
  console.log('[Background] Queue status set to running (blocking polling)');

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
    // Reset status on failure so polling can resume
    queueStatus.isRunning = false;
    queueStatus.status = 'failed';
    queueStatus.message = error.message;
    await chrome.storage.local.set({ queue_status: queueStatus });
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

    // Send stop message to all LinkedIn tabs (if any)
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_QUEUE', reason });
      } catch (e) {
        console.log('[Background] Could not send stop to tab:', tab.id);
      }
    }

    // ALWAYS update local status, even if no LinkedIn tab found
    queueStatus.isRunning = false;
    queueStatus.status = 'stopped';
    queueStatus.message = reason;
    await chrome.storage.local.set({ queue_status: queueStatus });

    console.log('[Background] Queue status reset to stopped');
    return { success: true, message: 'Queue stopped' };

  } catch (error) {
    console.error('[Background] Failed to stop queue:', error);
    // Still try to reset status on error
    queueStatus.isRunning = false;
    queueStatus.status = 'error';
    await chrome.storage.local.set({ queue_status: queueStatus });
    throw error;
  }
}

/**
 * Open a specific conversation on LinkedIn
 * With API approach, this is just a no-op (we don't need to pre-load tabs)
 * @param {string} conversationId - LinkedIn conversation/thread ID
 * @returns {Promise<object>}
 */
async function openConversationOnLinkedIn(conversationId) {
  console.log('[Background] Open conversation requested:', conversationId);
  // With API approach, we don't need to pre-load tabs
  // The API works directly without needing the tab open
  return { success: true, message: 'Ready (API mode)' };
}

/**
 * Fetch messages for a specific conversation via API
 * @param {string} conversationId - LinkedIn conversation ID
 * @param {number} backendConversationId - Backend conversation ID
 * @returns {Promise<object>}
 */
async function syncConversationMessages(conversationId, backendConversationId) {
  console.log('[Background] Syncing messages for conversation:', conversationId);

  try {
    const isLoggedIn = await LinkedInAPI.isLoggedIn();
    if (!isLoggedIn) {
      throw new Error('Not logged in to LinkedIn. Please log in first.');
    }

    // Fetch messages via API
    const messages = await LinkedInAPI.getMessages(conversationId, 50);
    console.log(`[Background] Fetched ${messages.length} messages via API`);

    // Send to backend
    if (backendConversationId) {
      try {
        const response = await backgroundApiCall(
          `/inbox/${backendConversationId}/sync-messages`,
          'POST',
          { messages: messages }
        );
        return {
          success: true,
          messages: messages.length,
          message: response.message
        };
      } catch (apiError) {
        return {
          success: true,
          messages: messages.length,
          apiError: apiError.message
        };
      }
    }

    return { success: true, messages: messages.length };

  } catch (error) {
    console.error('[Background] Failed to sync messages:', error);
    throw error;
  }
}

/**
 * Sync inbox using LinkedIn API via content script (for correct origin headers)
 * @param {number} limit - Maximum conversations to sync
 * @param {boolean} includeMessages - Whether to include messages
 * @returns {Promise<object>}
 */
async function syncInboxOnLinkedIn(limit = 50, includeMessages = false) {
  console.log('[Background] Syncing inbox via LinkedIn API (through content script)...');

  try {
    // Check if logged in
    const isLoggedIn = await LinkedInAPI.isLoggedIn();
    if (!isLoggedIn) {
      throw new Error('Not logged in to LinkedIn. Please log in first.');
    }

    // Find a LinkedIn tab to make the request from (for correct origin/referer headers)
    let tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

    if (tabs.length === 0) {
      // Create a LinkedIn tab if none exists
      console.log('[Background] No LinkedIn tab found, creating one...');
      const newTab = await chrome.tabs.create({
        url: 'https://www.linkedin.com/messaging/',
        active: false
      });
      await waitForTabLoad(newTab.id);
      await new Promise(resolve => setTimeout(resolve, 2000));
      tabs = [newTab];
    }

    const linkedInTab = tabs[0];
    console.log('[Background] Using LinkedIn tab:', linkedInTab.id);

    // Wait for content script to be ready
    const isReady = await waitForContentScript(linkedInTab.id, 10);
    if (!isReady) {
      throw new Error('Content script not ready. Please refresh the LinkedIn page.');
    }

    // Fetch conversations via content script (which has correct origin)
    console.log('[Background] Fetching conversations via content script...');
    const response = await chrome.tabs.sendMessage(linkedInTab.id, {
      type: 'SYNC_CONVERSATIONS_VIA_API',
      count: limit
    });

    console.log('[Background] Content script response:', response);

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to fetch conversations');
    }

    const conversations = response.conversations || [];
    console.log(`[Background] Fetched ${conversations.length} conversations via API`);

    // Store synced conversations for polling (so we can check them for new messages later)
    if (conversations.length > 0) {
      const syncedConversations = conversations.map(c => ({
        conversationId: c.linkedin_conversation_id,
        participantName: c.participant_name || 'Unknown'
      }));
      await chrome.storage.local.set({ synced_conversations: syncedConversations });
      console.log(`[Background] Stored ${syncedConversations.length} conversations for polling`);
    }

    // NOTE: Messages are NOT fetched during initial sync.
    // Messages are fetched on-demand when user opens a conversation.
    // This avoids is_from_me detection issues and speeds up initial sync.

    // Send to backend API
    try {
      const apiResponse = await backgroundApiCall('/inbox/sync', 'POST', {
        conversations: conversations
      });

      return {
        success: true,
        conversations: conversations.length,
        message: apiResponse.message || `Synced ${conversations.length} conversations`
      };
    } catch (apiError) {
      // Return conversations even if backend sync fails
      return {
        success: true,
        conversations: conversations.length,
        apiError: apiError.message
      };
    }

  } catch (error) {
    console.error('[Background] Failed to sync inbox:', error);
    throw error;
  }
}

/**
 * Wait for content script to be ready by pinging it
 * @param {number} tabId - Tab ID
 * @param {number} maxAttempts - Maximum ping attempts
 * @returns {Promise<boolean>}
 */
async function waitForContentScript(tabId, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (response?.success) {
        console.log('[Background] Content script is ready');
        return true;
      }
    } catch (e) {
      console.log('[Background] Waiting for content script, attempt', attempt + 1);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * Send a message on LinkedIn using the API
 * Makes the request from content script to have correct origin/referer headers
 * @param {string} conversationId - LinkedIn conversation ID
 * @param {string} content - Message content
 * @param {number} messageId - Backend message ID
 * @returns {Promise<object>}
 */
async function sendMessageOnLinkedIn(conversationId, content, messageId) {
  console.log('[Background] Sending message via LinkedIn API...');
  console.log('[Background] Conversation:', conversationId);
  console.log('[Background] Content length:', content?.length);

  // Check if logged in
  const isLoggedIn = await LinkedInAPI.isLoggedIn();
  console.log('[Background] Is logged in:', isLoggedIn);

  if (!isLoggedIn) {
    throw new Error('Not logged in to LinkedIn. Please log in first.');
  }

  // Find a LinkedIn tab to make the request from (for correct origin/referer headers)
  let tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

  if (tabs.length === 0) {
    // Create a LinkedIn tab if none exists
    console.log('[Background] No LinkedIn tab found, creating one...');
    const newTab = await chrome.tabs.create({
      url: 'https://www.linkedin.com/messaging/',
      active: false
    });
    await waitForTabLoad(newTab.id);
    await new Promise(resolve => setTimeout(resolve, 2000));
    tabs = [newTab];
  }

  const linkedInTab = tabs[0];
  console.log('[Background] Using LinkedIn tab:', linkedInTab.id);

  // Wait for content script to be ready
  const isReady = await waitForContentScript(linkedInTab.id, 10);
  if (!isReady) {
    throw new Error('Content script not ready. Please refresh the LinkedIn page.');
  }

  // Send message via content script (which has correct origin)
  try {
    console.log('[Background] Sending via content script...');
    const response = await chrome.tabs.sendMessage(linkedInTab.id, {
      type: 'SEND_MESSAGE_VIA_API',
      conversationId: conversationId,
      content: content,
      messageId: messageId
    });

    console.log('[Background] Content script response:', response);

    if (response?.success) {
      // Mark this message as sent for deduplication (using LinkedIn message ID)
      const linkedinMsgId = response.messageId || response.linkedin_message_id;
      markMessageAsSent(linkedinMsgId, content);
      console.log('[Background] Marked message as sent:', linkedinMsgId || 'hash only');

      // Mark as sent in backend
      if (messageId) {
        try {
          await backgroundApiCall(`/inbox/messages/${messageId}/mark-sent`, 'POST', {
            success: true,
            linkedin_message_id: linkedinMsgId
          });
        } catch (apiError) {
          console.error('[Background] Failed to mark message as sent:', apiError);
        }
      }
      return { success: true, message: 'Message sent via API', linkedin_message_id: linkedinMsgId };
    } else {
      throw new Error(response?.error || 'Failed to send message');
    }
  } catch (error) {
    console.error('[Background] Content script error:', error);

    // Mark as failed in backend
    if (messageId) {
      try {
        await backgroundApiCall(`/inbox/messages/${messageId}/mark-sent`, 'POST', {
          success: false,
          error_message: error.message
        });
      } catch (apiError) {
        console.error('[Background] Failed to mark message as failed:', apiError);
      }
    }

    throw error;
  }
}

/**
 * Send message using DOM manipulation (fallback method)
 * @param {string} conversationId - LinkedIn conversation ID
 * @param {string} content - Message content
 * @param {number} messageId - Backend message ID
 * @returns {Promise<object>}
 */
async function sendMessageViaDom(conversationId, content, messageId) {
  console.log('[Background] Sending message via DOM method...');

  const targetUrl = `https://www.linkedin.com/messaging/thread/${conversationId}/`;

  // Find existing LinkedIn messaging tab or any LinkedIn tab
  let tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  let linkedInTab = null;
  let needsNavigation = true;

  // First, look for a tab already on this conversation
  for (const tab of tabs) {
    if (tab.url?.includes(conversationId)) {
      linkedInTab = tab;
      needsNavigation = false;
      console.log('[Background] Found tab already on conversation:', tab.id);
      break;
    }
  }

  // If not found, use any LinkedIn tab
  if (!linkedInTab && tabs.length > 0) {
    linkedInTab = tabs[0];
    console.log('[Background] Using existing LinkedIn tab:', linkedInTab.id);
  }

  // If no LinkedIn tab exists, create one
  if (!linkedInTab) {
    console.log('[Background] Creating new LinkedIn tab...');
    linkedInTab = await chrome.tabs.create({
      url: targetUrl,
      active: true // Make it active so user can see what's happening
    });
    needsNavigation = false;

    // Wait for tab to fully load
    await waitForTabLoad(linkedInTab.id);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Navigate to conversation if needed
  if (needsNavigation) {
    console.log('[Background] Navigating to conversation...');
    await chrome.tabs.update(linkedInTab.id, { url: targetUrl, active: true });
    await waitForTabLoad(linkedInTab.id);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Focus the tab
  try {
    await chrome.tabs.update(linkedInTab.id, { active: true });
    await chrome.windows.update(linkedInTab.windowId, { focused: true });
  } catch (e) {
    console.log('[Background] Could not focus tab:', e.message);
  }

  // Wait for content script with more retries
  console.log('[Background] Waiting for content script...');
  const isReady = await waitForContentScript(linkedInTab.id, 20);
  if (!isReady) {
    throw new Error('Content script not responding. Please refresh the LinkedIn tab and try again.');
  }

  // Send via content script
  console.log('[Background] Sending message via content script...');
  try {
    const response = await chrome.tabs.sendMessage(linkedInTab.id, {
      type: 'SEND_LINKEDIN_MESSAGE',
      linkedinConversationId: conversationId,
      content: content,
      messageId: messageId
    });

    console.log('[Background] Content script response:', response);

    if (response?.success) {
      // Mark as sent
      if (messageId) {
        try {
          await backgroundApiCall(`/inbox/messages/${messageId}/mark-sent`, 'POST', {
            success: true
          });
        } catch (e) {
          console.error('[Background] Failed to mark as sent:', e);
        }
      }
      return { success: true, message: 'Message sent via DOM' };
    } else {
      throw new Error(response?.error || 'Failed to send message via DOM');
    }
  } catch (error) {
    console.error('[Background] Content script error:', error);
    throw new Error(`DOM method failed: ${error.message}`);
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

// ==================== LRU CACHE ====================

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts oldest items when capacity is reached
 */
class LRUCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  add(key) {
    // If exists, delete to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Add to end (most recent)
    this.cache.set(key, Date.now());
    // Evict oldest if over capacity
    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log('[LRU Cache] Evicted:', oldestKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }

  toArray() {
    return Array.from(this.cache.keys());
  }

  // Convert to Set for compatibility
  toSet() {
    return new Set(this.cache.keys());
  }

  // Load from array
  fromArray(arr) {
    this.cache.clear();
    for (const item of arr.slice(-this.maxSize)) {
      this.cache.set(item, Date.now());
    }
  }
}

// ==================== MESSAGE POLLING ====================

// Note: Message polling now managed by PollingManager (see top of file)

/**
 * LRU Map with TTL - for conversation state tracking
 * Automatically evicts old entries and limits size
 */
class LRUMapWithTTL {
  constructor(maxSize = 200, ttlMs = 24 * 60 * 60 * 1000) { // Default: 200 items, 24 hour TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { value, timestamp }
  }

  set(key, value) {
    // Clean expired entries first
    this.cleanup();

    // Remove if exists (to update order)
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    // Evict oldest if at capacity
    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }

    this.map.set(key, { value, timestamp: Date.now() });
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now - entry.timestamp > this.ttlMs) {
        this.map.delete(key);
      }
    }
  }

  toObject() {
    this.cleanup();
    const obj = {};
    for (const [key, entry] of this.map) {
      obj[key] = entry.value;
    }
    return obj;
  }

  fromObject(obj) {
    this.map.clear();
    const now = Date.now();
    for (const [key, value] of Object.entries(obj)) {
      // Only import if value looks like a recent timestamp (within TTL)
      if (typeof value === 'number' && now - value < this.ttlMs) {
        this.map.set(key, { value, timestamp: now });
      }
    }
  }

  get size() {
    return this.map.size;
  }
}

// Conversation state with max 200 entries, 24 hour TTL
let conversationState = new LRUMapWithTTL(200, 24 * 60 * 60 * 1000);
let sentMessageIds = new LRUCache(200); // Track message IDs we sent (max 200)
let sentMessageHashes = new LRUCache(100); // Track content hashes (max 100)
let processedIncomingIds = new LRUCache(500); // Track incoming message IDs already processed (max 500)
let activeConversations = new LRUCache(50); // Track conversations we've messaged (max 50)
let messagePollingInterval = null; // Legacy interval handle (managed by PollingManager now)

/**
 * Start polling for new messages
 * Now uses PollingManager to prevent duplicate intervals
 * @param {number} intervalMs - Polling interval in milliseconds (default 30 seconds)
 */
async function startMessagePolling(intervalMs = 30000) {
  // Check if already running via PollingManager
  if (PollingManager.intervals['newMessages']) {
    console.log('[Background] ⚠️ Message polling already running via PollingManager');
    return { success: true, message: 'Already running' };
  }

  console.log('[Background] ✅ Starting message polling every', intervalMs / 1000, 'seconds');
  console.log('[Background] Current state:', activeConversations.size, 'active conversations,', sentMessageIds.size, 'sent message IDs');

  // Use PollingManager instead of separate interval
  PollingManager.start('newMessages', checkForNewMessages, intervalMs);

  // Store polling state
  await chrome.storage.local.set({ message_polling_active: true });

  return { success: true, message: 'Polling started' };
}

/**
 * Stop polling for new messages
 */
async function stopMessagePolling() {
  // Stop via PollingManager
  PollingManager.stop('newMessages');
  console.log('[Background] Message polling stopped');

  // Save state
  await chrome.storage.local.set({
    message_polling_active: false,
    conversation_state: conversationState.toObject(),
    sent_message_ids: sentMessageIds.toArray(),
    sent_message_hashes: sentMessageHashes.toArray(),
    processed_incoming_ids: processedIncomingIds.toArray(),
    active_conversations: activeConversations.toArray()
  });

  return { success: true, message: 'Polling stopped' };
}

/**
 * Mark a message as sent (to avoid detecting it as incoming)
 * @param {string} messageId - LinkedIn message ID (preferred)
 * @param {string} content - Message content (fallback for hash)
 */
function markMessageAsSent(messageId, content) {
  // Primary: use message ID if available (LRU cache auto-evicts old entries)
  if (messageId) {
    sentMessageIds.add(messageId);
  }

  // Fallback: also store content hash for messages without IDs
  if (content) {
    const hash = simpleHash(content);
    sentMessageHashes.add(hash);
  }

  // Save to storage
  chrome.storage.local.set({
    sent_message_ids: sentMessageIds.toArray(),
    sent_message_hashes: sentMessageHashes.toArray()
  });
}

/**
 * Simple hash function for message content
 * @param {string} str - String to hash
 * @returns {string} Hash string, or empty string if input is invalid
 */
function simpleHash(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Check for new messages (manual trigger from webapp)
 * Wrapper that uses the internal implementation with proper setup
 */
async function checkForNewMessages() {
  console.log('[Background] Manual check for new messages triggered');

  const linkedInTab = await findLinkedInTab();
  if (!linkedInTab) {
    throw new Error('No LinkedIn tab found. Please open LinkedIn.');
  }

  const isReady = await waitForContentScript(linkedInTab.id, 5);
  if (!isReady) {
    throw new Error('Content script not ready. Please refresh the LinkedIn page.');
  }

  const isLoggedIn = await LinkedInAPI.isLoggedIn();
  if (!isLoggedIn) {
    throw new Error('Not logged in to LinkedIn.');
  }

  await checkForNewMessagesInternal(linkedInTab);
}

// Note: Message polling commands are handled in the main onMessageExternal listener above

// ==================== STATE PERSISTENCE ====================

// Debounce timer for state saves
let saveStateDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 2000; // Wait 2 seconds after last change before saving

/**
 * Save all state to storage (called periodically and after critical changes)
 */
async function saveState() {
  try {
    await chrome.storage.local.set({
      conversation_state: conversationState.toObject(),
      sent_message_ids: sentMessageIds.toArray(),
      sent_message_hashes: sentMessageHashes.toArray(),
      processed_incoming_ids: processedIncomingIds.toArray(),
      active_conversations: activeConversations.toArray(),
      queue_status: queueStatus,
      last_state_save: Date.now()
    });
    console.log('[Background] State saved');
  } catch (e) {
    console.error('[Background] Failed to save state:', e);
  }
}

/**
 * Debounced save - call this after state changes to avoid excessive writes
 * Will save 2 seconds after the last call
 */
function saveStateDebounced() {
  if (saveStateDebounceTimer) {
    clearTimeout(saveStateDebounceTimer);
  }
  saveStateDebounceTimer = setTimeout(() => {
    saveState();
    saveStateDebounceTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Immediate save - for critical state changes
 */
function saveStateImmediate() {
  if (saveStateDebounceTimer) {
    clearTimeout(saveStateDebounceTimer);
    saveStateDebounceTimer = null;
  }
  saveState();
}

/**
 * Load state from storage (called on startup)
 */
async function loadState() {
  try {
    const saved = await chrome.storage.local.get([
      'conversation_state',
      'sent_message_ids',
      'sent_message_hashes',
      'processed_incoming_ids',
      'active_conversations',
      'queue_status'
    ]);

    conversationState.fromObject(saved.conversation_state || {});
    sentMessageIds.fromArray(saved.sent_message_ids || []);
    sentMessageHashes.fromArray(saved.sent_message_hashes || []);
    processedIncomingIds.fromArray(saved.processed_incoming_ids || []);
    activeConversations.fromArray(saved.active_conversations || []);

    // Restore queue status
    if (saved.queue_status) {
      queueStatus = { ...queueStatus, ...saved.queue_status };
    }

    console.log('[Background] State loaded:', {
      conversations: conversationState.size,
      sentMessageIds: sentMessageIds.size,
      sentMessageHashes: sentMessageHashes.size,
      processedIncomingIds: processedIncomingIds.size,
      activeConversations: activeConversations.size,
      queueRunning: queueStatus.isRunning
    });
  } catch (e) {
    console.error('[Background] Failed to load state:', e);
  }
}

// Load state immediately on startup
loadState();

// Save state periodically (every 1 minute instead of 5)
setInterval(saveState, 60 * 1000);

// Chrome MV3 service worker suspend handler (more reliable than beforeunload)
chrome.runtime.onSuspend?.addListener(() => {
  console.log('[Background] Service worker suspending, saving state...');
  saveStateImmediate();
});

// Also keep beforeunload as fallback
self.addEventListener('beforeunload', () => {
  saveStateImmediate();
});

// Handle auth errors from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LINKEDIN_AUTH_ERROR') {
    console.error('[Background] LinkedIn auth error:', message.status, message.message);

    // Store auth error for webapp to detect
    chrome.storage.local.set({
      linkedin_auth_error: {
        status: message.status,
        message: message.message,
        timestamp: Date.now()
      }
    });

    // Notify any open popup/webapp
    chrome.runtime.sendMessage({
      type: 'AUTH_ERROR',
      ...message
    }).catch(() => {});

    sendResponse({ received: true });
    return false;
  }
});

// NOTE: Legacy auto-start removed - now handled by unified startAllPolling()
// which is called when auth_token exists (see bottom of file)

// ==================== PENDING MESSAGE POLLING ====================

// Note: Pending message polling now managed by PollingManager (see UNIFIED STARTUP section)

// Track messages currently being sent to prevent duplicates
// This Set is persisted to storage to survive service worker restarts
let messagesBeingSent = new Set();

// Mutex for atomic message claiming (prevents race conditions)
let messageClaimMutex = Promise.resolve();

/**
 * Load messagesBeingSent from storage on startup
 * Cleans up stale entries older than 5 minutes
 */
async function loadMessagesBeingSent() {
  try {
    const result = await chrome.storage.local.get('messages_being_sent');
    const stored = result.messages_being_sent || {};
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    // Only restore entries that aren't stale (prevents permanent blocking)
    messagesBeingSent = new Set();
    for (const [msgId, timestamp] of Object.entries(stored)) {
      if (now - timestamp < STALE_THRESHOLD) {
        messagesBeingSent.add(msgId);
      }
    }

    console.log('[Background] Loaded messagesBeingSent:', messagesBeingSent.size, 'active entries');
  } catch (e) {
    console.error('[Background] Failed to load messagesBeingSent:', e);
  }
}

/**
 * Atomically try to claim a message for sending (mutex-protected)
 * Returns true if claimed, false if already being sent
 * @param {number|string} msgId - Message ID
 * @returns {Promise<boolean>} - True if claimed successfully
 */
async function tryClaimMessage(msgId) {
  // Chain onto mutex to ensure atomic check+add
  return new Promise((resolve) => {
    messageClaimMutex = messageClaimMutex.then(async () => {
      // Check if already claimed
      if (messagesBeingSent.has(msgId)) {
        resolve(false);
        return;
      }

      // Claim it
      messagesBeingSent.add(msgId);

      // Persist to storage with timestamp
      const stored = {};
      for (const id of messagesBeingSent) {
        stored[id] = Date.now();
      }
      await chrome.storage.local.set({ messages_being_sent: stored });

      resolve(true);
    }).catch(() => {
      resolve(false);
    });
  });
}

/**
 * Add a message ID to the being-sent tracker (non-atomic, use tryClaimMessage for atomic)
 * @param {number|string} msgId - Message ID
 */
async function addMessageBeingSent(msgId) {
  messagesBeingSent.add(msgId);
  // Store with timestamp for staleness detection
  const stored = {};
  for (const id of messagesBeingSent) {
    stored[id] = Date.now();
  }
  await chrome.storage.local.set({ messages_being_sent: stored });
}

/**
 * Remove a message ID from the being-sent tracker
 * @param {number|string} msgId - Message ID
 */
async function removeMessageBeingSent(msgId) {
  messagesBeingSent.delete(msgId);
  const stored = {};
  for (const id of messagesBeingSent) {
    stored[id] = Date.now();
  }
  await chrome.storage.local.set({ messages_being_sent: stored });
}

// Load on startup
loadMessagesBeingSent();

// ==================== UNIFIED STARTUP ====================

// Track polling cycle count for less frequent tasks
let pollingCycleCount = 0;
const AUTO_SYNC_EVERY_N_CYCLES = 10; // Auto sync every 10 cycles (5 minutes at 30s interval)

// Track consecutive failures for backoff
let consecutiveNoTabFailures = 0;
const MAX_NO_TAB_FAILURES = 5; // After 5 failures, increase interval

/**
 * Unified polling cycle - consolidates all polling tasks into one
 * This reduces overhead by sharing LinkedIn tab lookup and content script ping
 */
async function performUnifiedPollingCycle() {
  pollingCycleCount++;
  console.log(`[Background] === Polling cycle #${pollingCycleCount} ===`);

  // Step 1: Check for LinkedIn tab (shared across all tasks)
  const linkedInTab = await findLinkedInTab();
  if (!linkedInTab) {
    consecutiveNoTabFailures++;
    console.log(`[Background] No LinkedIn tab found (failure #${consecutiveNoTabFailures})`);

    // After too many failures, slow down polling
    if (consecutiveNoTabFailures >= MAX_NO_TAB_FAILURES) {
      console.log('[Background] Too many consecutive failures, pausing polling for 2 minutes');
      PollingManager.stop('unified');
      setTimeout(() => {
        consecutiveNoTabFailures = 0; // Reset counter
        startAllPolling();
      }, 2 * 60 * 1000); // Resume after 2 minutes
    }
    return;
  }

  // Reset failure counter on success
  consecutiveNoTabFailures = 0;

  // Step 2: Check if content script is ready (shared)
  const isReady = await waitForContentScript(linkedInTab.id, 3);
  if (!isReady) {
    console.log('[Background] Content script not ready, skipping cycle');
    return;
  }

  // Step 3: Check LinkedIn login (shared)
  const isLoggedIn = await LinkedInAPI.isLoggedIn();
  if (!isLoggedIn) {
    console.log('[Background] Not logged in to LinkedIn, skipping cycle');
    return;
  }

  // Step 4: Check auth token (shared)
  const token = await getAuthToken();
  if (!token) {
    console.log('[Background] No auth token, skipping cycle');
    return;
  }

  console.log('[Background] All checks passed, executing tasks...');

  // Task A: Check for new messages (every cycle)
  try {
    await checkForNewMessagesInternal(linkedInTab);
  } catch (e) {
    console.error('[Background] New messages check failed:', e.message);
  }

  // Task B: Check for pending messages to send (every cycle)
  try {
    await performPendingMessageCheckInternal();
  } catch (e) {
    console.error('[Background] Pending messages check failed:', e.message);
  }

  // Task C: Auto sync (every N cycles - less frequent)
  if (pollingCycleCount % AUTO_SYNC_EVERY_N_CYCLES === 0) {
    try {
      await performAutoSyncInternal(linkedInTab);
    } catch (e) {
      console.error('[Background] Auto sync failed:', e.message);
    }
  }

  console.log(`[Background] === Cycle #${pollingCycleCount} complete ===`);
}

/**
 * Internal: Check for new messages (uses pre-validated tab)
 */
async function checkForNewMessagesInternal(linkedInTab) {
  console.log('[Background] Checking for new messages...');

  const response = await chrome.tabs.sendMessage(linkedInTab.id, {
    type: 'CHECK_NEW_MESSAGES',
    lastKnownState: conversationState.toObject(),
    activeConversations: activeConversations.toArray()
  });

  if (!response?.success) {
    console.log('[Background] New messages check returned error:', response?.error);
    return;
  }

  // Update conversation state
  if (response.updatedState) {
    for (const [key, value] of Object.entries(response.updatedState)) {
      conversationState.set(key, value);
    }
  }

  if (!response.newMessages?.length) {
    console.log('[Background] No new messages');
    return;
  }

  console.log('[Background] Found', response.newMessages.length, 'new messages');

  // Filter out sent messages and already processed
  const incomingMessages = response.newMessages.filter(msg => {
    const messageId = msg.linkedin_message_id || msg.message?.linkedin_message_id;

    if (messageId && processedIncomingIds.has(messageId)) return false;
    if (messageId && sentMessageIds.has(messageId)) return false;

    const hash = simpleHash(msg.message?.content);
    if (hash && sentMessageHashes.has(hash)) return false;

    return true;
  });

  console.log('[Background] After filtering:', incomingMessages.length, 'incoming messages');

  // Send to backend
  for (const msg of incomingMessages) {
    try {
      try {
        await backgroundApiCall('/inbox/incoming-message', 'POST', {
          linkedin_conversation_id: msg.conversationId,
          participant_name: msg.participantName,
          message: msg.message
        });
      } catch (error) {
        if (error.status === 404) {
          // Create conversation first
          await backgroundApiCall('/inbox/conversations', 'POST', {
            linkedin_conversation_id: msg.conversationId,
            participant_name: msg.participantName || 'Unknown'
          });
          await backgroundApiCall('/inbox/incoming-message', 'POST', {
            linkedin_conversation_id: msg.conversationId,
            participant_name: msg.participantName,
            message: msg.message
          });
        } else {
          throw error;
        }
      }

      // Mark as processed
      const processedId = msg.linkedin_message_id || msg.message?.linkedin_message_id;
      if (processedId) {
        processedIncomingIds.add(processedId);
      }
    } catch (error) {
      console.error('[Background] Failed to send message to backend:', error.message);
    }
  }

  // Notify webapp
  if (incomingMessages.length > 0) {
    await chrome.storage.local.set({
      new_messages_available: true,
      new_messages_count: incomingMessages.length,
      new_messages_timestamp: Date.now()
    });
  }
}

/**
 * Internal: Check and send pending messages
 */
async function performPendingMessageCheckInternal() {
  console.log('[Background] Checking for pending messages...');

  const data = await backgroundApiCall('/inbox/pending-messages', 'GET');
  const pendingMessages = data.messages || [];

  if (pendingMessages.length === 0) {
    console.log('[Background] No pending messages');
    return;
  }

  console.log('[Background] Found', pendingMessages.length, 'pending message(s)');

  for (const msg of pendingMessages) {
    const claimed = await tryClaimMessage(msg.id);
    if (!claimed) {
      console.log('[Background] Skipping message', msg.id, '- already claimed');
      continue;
    }

    const conversationId = msg.conversation?.linkedin_conversation_id;
    if (!conversationId) {
      await backgroundApiCall(`/inbox/messages/${msg.id}/mark-sent`, 'POST', {
        success: false,
        error_message: 'No LinkedIn conversation ID'
      });
      await removeMessageBeingSent(msg.id);
      continue;
    }

    try {
      const result = await sendMessageOnLinkedIn(conversationId, msg.content, msg.id);
      if (result.success) {
        console.log('[Background] Sent pending message:', msg.id);
      }
    } finally {
      await removeMessageBeingSent(msg.id);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Internal: Perform auto sync (uses pre-validated tab)
 */
async function performAutoSyncInternal(linkedInTab) {
  console.log('[Background] Performing auto sync...');

  const response = await chrome.tabs.sendMessage(linkedInTab.id, {
    type: 'SYNC_CONVERSATIONS_VIA_API',
    count: 20
  });

  if (!response?.success) {
    console.log('[Background] Auto sync failed:', response?.error);
    return;
  }

  const conversations = response.conversations || [];
  if (conversations.length === 0) {
    console.log('[Background] No conversations to sync');
    return;
  }

  // Send to backend
  try {
    await backgroundApiCall('/inbox/sync', 'POST', { conversations });
    console.log('[Background] Auto sync complete:', conversations.length, 'conversations');
    await chrome.storage.local.set({ last_auto_sync: Date.now() });
  } catch (e) {
    console.error('[Background] Backend sync failed:', e.message);
  }
}

/**
 * Start unified polling (single task instead of three)
 */
function startAllPolling() {
  console.log('[Background] Starting unified polling...');

  // Single unified polling cycle - every 30 seconds
  PollingManager.start('unified', performUnifiedPollingCycle, 30000);

  chrome.storage.local.set({ polling_active: true });
}

/**
 * Stop all polling tasks
 */
function stopAllPolling() {
  PollingManager.stopAll();
  pollingCycleCount = 0;
  consecutiveNoTabFailures = 0;
  chrome.storage.local.set({ polling_active: false });
}

// Auto-start polling when extension loads (if authenticated)
chrome.storage.local.get(['auth_token'], async (result) => {
  if (result.auth_token) {
    // Delay start to allow LinkedIn tab to load
    setTimeout(() => {
      startAllPolling();
    }, 5000);
  }
});

// Start polling when auth succeeds
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUTH_STATE_CHANGED' && message.authenticated) {
    console.log('[Background] Auth state changed, starting polling');
    startAllPolling();
  }
});
