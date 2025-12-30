/**
 * Background Service Worker
 *
 * Handles message routing, campaign monitoring, and background tasks.
 * In Manifest V3, this runs as a service worker (event-driven, not persistent).
 */

// Import LinkedIn API service
importScripts('services/linkedinApi.js');

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
          chrome.storage.local.set({ active_conversations: Array.from(activeConversations) });

          // Auto-start polling when user sends a message
          if (!messagePollingInterval) {
            console.log('[Background] Auto-starting message polling after send');
            startMessagePolling(15000); // Poll every 15 seconds for active conversations
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

    // Always fetch recent messages for each conversation (to catch missed messages)
    if (conversations.length > 0) {
      console.log('[Background] Fetching recent messages for each conversation...');

      // Ask content script to fetch messages for all conversations
      try {
        const messagesResponse = await chrome.tabs.sendMessage(linkedInTab.id, {
          type: 'FETCH_MESSAGES_FOR_CONVERSATIONS',
          conversationIds: conversations.map(c => c.linkedin_conversation_id).slice(0, 10) // Limit to first 10
        });

        if (messagesResponse?.success && messagesResponse.conversationMessages) {
          // Attach messages to conversations
          for (const conv of conversations) {
            const msgs = messagesResponse.conversationMessages[conv.linkedin_conversation_id];
            if (msgs && msgs.length > 0) {
              conv.messages = msgs;
              console.log(`[Background] Got ${msgs.length} messages for ${conv.linkedin_conversation_id}`);
            }
          }
        }
      } catch (msgError) {
        console.log('[Background] Could not fetch messages:', msgError.message);
      }
    }

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

  // Mark this message as sent so it won't be detected as incoming
  if (content) {
    markMessageAsSent(content);
  }

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
      // Mark as sent in backend
      if (messageId) {
        try {
          await backgroundApiCall(`/inbox/messages/${messageId}/mark-sent`, 'POST', {
            success: true,
            linkedin_message_id: response.messageId
          });
        } catch (apiError) {
          console.error('[Background] Failed to mark message as sent:', apiError);
        }
      }
      return { success: true, message: 'Message sent via API' };
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

// ==================== MESSAGE POLLING ====================

let messagePollingInterval = null;
let conversationState = {}; // { conversationId: lastActivityTimestamp }
let sentMessageHashes = new Set(); // Track messages we sent to avoid duplicates
let activeConversations = new Set(); // Track conversations we've messaged (to poll for replies)

/**
 * Start polling for new messages
 * @param {number} intervalMs - Polling interval in milliseconds (default 30 seconds)
 */
async function startMessagePolling(intervalMs = 30000) {
  if (messagePollingInterval) {
    console.log('[Background] ⚠️ Message polling already running');
    return { success: true, message: 'Already running' };
  }

  console.log('[Background] ✅ Starting message polling every', intervalMs / 1000, 'seconds');

  // Load saved state
  const savedState = await chrome.storage.local.get(['conversation_state', 'sent_message_hashes', 'active_conversations']);
  conversationState = savedState.conversation_state || {};
  sentMessageHashes = new Set(savedState.sent_message_hashes || []);
  activeConversations = new Set(savedState.active_conversations || []);
  console.log('[Background] Loaded', activeConversations.size, 'active conversations to poll');

  // Initial check
  await checkForNewMessages();

  // Set up interval
  messagePollingInterval = setInterval(async () => {
    await checkForNewMessages();
  }, intervalMs);

  // Store polling state
  await chrome.storage.local.set({ message_polling_active: true });

  return { success: true, message: 'Polling started' };
}

/**
 * Stop polling for new messages
 */
async function stopMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
    console.log('[Background] Message polling stopped');

    // Save state
    await chrome.storage.local.set({
      message_polling_active: false,
      conversation_state: conversationState,
      sent_message_hashes: Array.from(sentMessageHashes)
    });
  }
  return { success: true, message: 'Polling stopped' };
}

/**
 * Mark a message as sent (to avoid detecting it as incoming)
 * @param {string} content - Message content
 */
function markMessageAsSent(content) {
  const hash = simpleHash(content);
  sentMessageHashes.add(hash);

  // Keep set size manageable (last 100 messages)
  if (sentMessageHashes.size > 100) {
    const arr = Array.from(sentMessageHashes);
    sentMessageHashes = new Set(arr.slice(-100));
  }

  // Save to storage
  chrome.storage.local.set({ sent_message_hashes: Array.from(sentMessageHashes) });
}

/**
 * Simple hash function for message content
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Check for new messages across all conversations
 */
async function checkForNewMessages() {
  console.log('[Background] 🔍 Polling: Checking for new messages...');

  try {
    // Check if logged in
    const isLoggedIn = await LinkedInAPI.isLoggedIn();
    if (!isLoggedIn) {
      console.log('[Background] ❌ Polling failed: Not logged in to LinkedIn');
      return;
    }
    console.log('[Background] ✅ Polling: Logged in');

    // Find a LinkedIn tab
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    if (tabs.length === 0) {
      console.log('[Background] ❌ Polling failed: No LinkedIn tab open');
      return;
    }
    console.log('[Background] ✅ Polling: Found LinkedIn tab:', tabs[0].url);

    const linkedInTab = tabs[0];

    // Wait for content script
    const isReady = await waitForContentScript(linkedInTab.id, 3);
    if (!isReady) {
      console.log('[Background] ❌ Polling failed: Content script not ready');
      return;
    }
    console.log('[Background] ✅ Polling: Content script ready');

    // Request new messages via content script with state
    console.log('[Background] 📤 Polling: Sending CHECK_NEW_MESSAGES to content script...');
    console.log('[Background] 📤 Active conversations to check:', Array.from(activeConversations));
    const response = await chrome.tabs.sendMessage(linkedInTab.id, {
      type: 'CHECK_NEW_MESSAGES',
      lastKnownState: conversationState,
      activeConversations: Array.from(activeConversations) // Include conversations we've messaged
    });

    console.log('[Background] 📥 Polling: Response from content script:', response?.success ? 'success' : 'failed',
      '| Messages found:', response?.newMessages?.length || 0);

    if (response?.success) {
      // Update our conversation state
      if (response.updatedState) {
        conversationState = { ...conversationState, ...response.updatedState };
        await chrome.storage.local.set({ conversation_state: conversationState });
      }

      if (response.newMessages?.length > 0) {
        console.log('[Background] 🎉 Found', response.newMessages.length, 'new messages!');

        // Filter out messages we sent
        const incomingMessages = response.newMessages.filter(msg => {
          const hash = simpleHash(msg.message.content);
          if (sentMessageHashes.has(hash)) {
            console.log('[Background] Filtering out sent message:', msg.message.content.substring(0, 50));
            return false;
          }
          return true;
        });

        console.log('[Background] After filtering:', incomingMessages.length, 'incoming messages');

        // Send to backend
        for (const msg of incomingMessages) {
          try {
            console.log('[Background] 📤 Sending to backend:', {
              endpoint: '/inbox/incoming-message',
              linkedin_conversation_id: msg.conversationId,
              participant_name: msg.participantName,
              content: msg.message.content.substring(0, 50)
            });

            const response = await backgroundApiCall('/inbox/incoming-message', 'POST', {
              linkedin_conversation_id: msg.conversationId,
              participant_name: msg.participantName,
              message: msg.message
            });

            console.log('[Background] ✅ Backend response:', response);
          } catch (error) {
            console.error('[Background] ❌ Failed to send message to backend:', error.message || error);
          }
        }

        // Notify webapp via broadcast
        if (incomingMessages.length > 0) {
          try {
            chrome.runtime.sendMessage({
              type: 'NEW_MESSAGES_RECEIVED',
              count: incomingMessages.length,
              messages: incomingMessages
            }).catch(() => {});
          } catch (e) {}

          // Also notify external (webapp)
          try {
            // Store for webapp to pick up
            await chrome.storage.local.set({
              new_messages_available: true,
              new_messages_count: incomingMessages.length,
              new_messages_timestamp: Date.now()
            });
          } catch (e) {}
        }
      } else {
        console.log('[Background] 📭 Polling: No new messages found');
      }
    } else {
      console.log('[Background] ❌ Polling: Content script returned error:', response?.error);
    }

  } catch (error) {
    console.error('[Background] ❌ Polling error:', error);
  }
}

// Handle message polling commands from webapp (add to existing onMessageExternal)
const originalExternalListener = chrome.runtime.onMessageExternal._listeners?.[0];

// Additional external message handlers for polling
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_MESSAGE_POLLING') {
    const interval = message.interval || 30000;
    startMessagePolling(interval)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'STOP_MESSAGE_POLLING') {
    stopMessagePolling()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CHECK_MESSAGES_NOW') {
    checkForNewMessages()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_MESSAGE_POLLING_STATUS') {
    sendResponse({
      success: true,
      isPolling: !!messagePollingInterval,
      conversationCount: Object.keys(conversationState).length
    });
    return false;
  }

  if (message.type === 'MARK_MESSAGE_SENT') {
    if (message.content) {
      markMessageAsSent(message.content);
    }
    sendResponse({ success: true });
    return false;
  }
});

// Auto-start polling when extension loads (if was active before)
chrome.storage.local.get('message_polling_active', (result) => {
  if (result.message_polling_active) {
    console.log('[Background] Resuming message polling...');
    startMessagePolling();
  }
});
