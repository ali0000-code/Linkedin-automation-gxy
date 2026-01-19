/**
 * Content Script
 *
 * Injected into LinkedIn pages to handle:
 * 1. Extraction requests from popup
 * 2. Campaign action execution (visit, invite, message, follow)
 *
 * NOTE: This script runs in the context of the LinkedIn page.
 * It has access to the page's DOM but not the extension's background context.
 */

console.log('[Content Script] LinkedIn Automation extension loaded on:', window.location.href);
console.log('[Content Script] Ready to receive messages from background script');

/**
 * Initialize queue processor when page loads
 * This handles resuming the queue after page navigation
 */
async function initQueueProcessor() {
  // Wait a bit for all scripts to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if queue processor is available
  if (typeof window.QueueProcessor !== 'undefined') {
    console.log('[Content Script] Initializing queue processor');
    await window.QueueProcessor.init();
  } else {
    console.warn('[Content Script] Queue processor not loaded');
  }
}

// Initialize queue processor
initQueueProcessor();

/**
 * Get CSRF token from cookies (used for LinkedIn API calls)
 * @returns {string|null} The CSRF token or null if not found
 */
function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'JSESSIONID') {
      return value.replace(/"/g, '');
    }
  }
  return null;
}

// Profile URN cache (1 hour expiry)
let cachedProfileUrn = null;
let profileUrnCacheTime = 0;
const PROFILE_URN_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get my LinkedIn profile URN (cached)
 * @returns {Promise<string|null>} The profile URN or null
 */
async function getMyProfileUrn() {
  // Return cached if valid
  if (cachedProfileUrn && (Date.now() - profileUrnCacheTime) < PROFILE_URN_CACHE_DURATION) {
    console.log('[Content Script] Using cached profile URN:', cachedProfileUrn);
    return cachedProfileUrn;
  }

  const csrfToken = getCsrfToken();
  if (!csrfToken) return null;

  try {
    // Try the identity endpoint first (returns fsd_profile URN)
    const response = await fetch('https://www.linkedin.com/voyager/api/voyagerIdentityDashProfiles?q=memberIdentity&memberIdentity=me', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      // Find the fsd_profile URN in included array
      for (const entity of (data.included || [])) {
        if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
          cachedProfileUrn = entity.entityUrn;
          profileUrnCacheTime = Date.now();
          console.log('[Content Script] Cached profile URN:', cachedProfileUrn);
          return cachedProfileUrn;
        }
      }
    }

    // Fallback: try /me endpoint
    const meResponse = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });

    if (meResponse.ok) {
      const meData = await meResponse.json();
      // Check various locations for profile URN
      cachedProfileUrn = meData.miniProfile?.entityUrn ||
                         meData.entityUrn ||
                         meData.included?.find(e => e.entityUrn?.includes('fsd_profile'))?.entityUrn;
      if (cachedProfileUrn) {
        profileUrnCacheTime = Date.now();
        console.log('[Content Script] Cached profile URN (from /me):', cachedProfileUrn);
        return cachedProfileUrn;
      }
    }
  } catch (e) {
    console.log('[Content Script] Failed to get profile URN:', e.message);
  }

  return null;
}

// ==================== RATE LIMITER ====================

/**
 * Rate limiter for LinkedIn API calls
 * Uses a fixed-size circular buffer to limit memory usage
 * Limits to 60 requests per minute (1 per second average)
 */
const rateLimiter = {
  // Fixed-size circular buffer for request timestamps
  requests: new Array(60).fill(0), // Pre-allocated array
  head: 0, // Next position to write
  count: 0, // Number of valid entries
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute

  // Clean expired entries and return count of valid ones
  _cleanup() {
    const now = Date.now();
    let validCount = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
      if (now - this.requests[idx] < this.windowMs) {
        validCount++;
      }
    }
    // If entries expired, update count (circular buffer handles the rest)
    if (validCount < this.count) {
      this.count = validCount;
    }
    return validCount;
  },

  canMakeRequest() {
    return this._cleanup() < this.maxRequests;
  },

  recordRequest() {
    // Add to circular buffer (overwrites oldest if full)
    this.requests[this.head] = Date.now();
    this.head = (this.head + 1) % this.maxRequests;
    if (this.count < this.maxRequests) {
      this.count++;
    }
  },

  async waitForSlot() {
    while (!this.canMakeRequest()) {
      // Find oldest valid request
      const now = Date.now();
      let oldestTime = now;
      for (let i = 0; i < this.count; i++) {
        const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
        if (this.requests[idx] < oldestTime && now - this.requests[idx] < this.windowMs) {
          oldestTime = this.requests[idx];
        }
      }
      const waitTime = Math.max(100, oldestTime + this.windowMs - now + 100);
      console.log(`[Rate Limiter] Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));
    }
  },

  getStatus() {
    const validCount = this._cleanup();
    const now = Date.now();
    let oldestTime = now;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
      if (this.requests[idx] < oldestTime && now - this.requests[idx] < this.windowMs) {
        oldestTime = this.requests[idx];
      }
    }
    return {
      used: validCount,
      remaining: this.maxRequests - validCount,
      resetsIn: validCount > 0 ? Math.max(0, oldestTime + this.windowMs - now) : 0
    };
  }
};

/**
 * Rate-limited fetch wrapper for LinkedIn API
 * Handles rate limiting and common errors (429, 401, 403)
 */
async function linkedInFetch(url, options = {}) {
  // Wait for rate limit slot
  await rateLimiter.waitForSlot();

  // Record this request
  rateLimiter.recordRequest();

  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  // Handle rate limiting (429)
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    console.log(`[LinkedIn API] Rate limited! Waiting ${retryAfter}s...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry once
    rateLimiter.recordRequest();
    return fetch(url, { ...options, credentials: 'include' });
  }

  // Handle auth errors (401, 403)
  if (response.status === 401 || response.status === 403) {
    console.error('[LinkedIn API] Authentication error:', response.status);
    // Notify background script about auth failure
    try {
      chrome.runtime.sendMessage({
        type: 'LINKEDIN_AUTH_ERROR',
        status: response.status,
        message: response.status === 401 ? 'Session expired' : 'Access forbidden'
      });
    } catch (e) {}
    throw new Error(`LinkedIn auth error: ${response.status}. Please refresh LinkedIn and try again.`);
  }

  return response;
}

/**
 * Listen for messages from popup and background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.type);

  // ==================== PING - Must be first for reliability ====================

  // Handle PING first - this is critical for checking if content script is loaded
  if (message.type === 'PING') {
    console.log('[Content Script] PING received, responding with ready status');
    sendResponse({
      success: true,
      message: 'Content script is ready',
      queueAvailable: typeof window.QueueProcessor !== 'undefined',
      executorAvailable: typeof window.ActionExecutor !== 'undefined',
      isProfilePage: window.location.href.includes('linkedin.com/in/'),
      url: window.location.href
    });
    return true;
  }

  // ==================== EXTRACTION MESSAGES ====================

  if (message.type === 'START_EXTRACTION') {
    // Handle extraction asynchronously
    handleExtraction(message.limit)
      .then(sendResponse)
      .catch(error => {
        console.error('[Content Script] Extraction error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Extraction failed'
        });
      });

    // Return true to indicate async response
    return true;
  }

  // Stop extraction request
  if (message.type === 'STOP_EXTRACTION') {
    console.log('[Content Script] Stop extraction requested');

    // Call stopExtraction function from extractor service
    if (typeof stopExtraction === 'function') {
      stopExtraction();
      sendResponse({ success: true, message: 'Stop signal sent' });
    } else {
      console.warn('[Content Script] stopExtraction function not available');
      sendResponse({ success: false, error: 'Stop function not available' });
    }

    return true;
  }

  // ==================== QUEUE MESSAGES ====================

  // Start queue processing
  if (message.type === 'START_QUEUE') {
    console.log('[Content Script] Starting queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.start()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Pause queue processing
  if (message.type === 'PAUSE_QUEUE') {
    console.log('[Content Script] Pausing queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.pause();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Stop queue processing
  if (message.type === 'STOP_QUEUE') {
    console.log('[Content Script] Stopping queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.stop(message.reason || 'User stopped');
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Get queue status
  if (message.type === 'GET_QUEUE_STATUS') {
    if (typeof window.QueueProcessor !== 'undefined') {
      sendResponse({
        success: true,
        status: window.QueueProcessor.getStatus()
      });
    } else {
      sendResponse({
        success: false,
        error: 'Queue processor not loaded'
      });
    }

    return true;
  }

  // ==================== EMAIL EXTRACTION MESSAGES ====================

  // Extract email from current profile page
  if (message.type === 'EXTRACT_EMAIL') {
    console.log('[Content Script] Email extraction requested');

    // Check if we're on a profile page
    if (!window.location.href.includes('linkedin.com/in/')) {
      sendResponse({
        success: false,
        error: 'Please navigate to a LinkedIn profile page first'
      });
      return true;
    }

    // Check if extraction function exists
    if (typeof extractEmailFromProfile !== 'function') {
      sendResponse({
        success: false,
        error: 'Email extractor not loaded. Please refresh the page.'
      });
      return true;
    }

    // Perform email extraction
    extractEmailFromProfile()
      .then(result => {
        console.log('[Content Script] Email extraction result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Content Script] Email extraction error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Email extraction failed'
        });
      });

    return true;
  }

  // ==================== INBOX SYNC MESSAGES ====================

  // Sync inbox conversations
  if (message.type === 'SYNC_INBOX') {
    console.log('[Content Script] Inbox sync requested');

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded. Please refresh the page.'
      });
      return true;
    }

    // Perform sync
    window.MessageExtractor.performFullSync(message.includeMessages || false, message.limit || 50)
      .then(async conversations => {
        // Send to backend API
        try {
          const response = await window.ExtensionAPI.request('/inbox/sync', 'POST', {
            conversations: conversations
          });
          sendResponse({
            success: true,
            conversations: conversations.length,
            message: response.message
          });
        } catch (error) {
          // Still return conversations even if API fails
          sendResponse({
            success: true,
            conversations: conversations.length,
            apiError: error.message
          });
        }
      })
      .catch(error => {
        console.error('[Content Script] Inbox sync error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Inbox sync failed'
        });
      });

    return true;
  }

  // Sync messages for a specific conversation
  if (message.type === 'SYNC_CONVERSATION_MESSAGES') {
    console.log('[Content Script] Conversation messages sync requested');

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded.'
      });
      return true;
    }

    window.MessageExtractor.openAndExtractMessages(message.conversationId)
      .then(async messages => {
        // Send to backend API
        try {
          const response = await window.ExtensionAPI.request(
            `/inbox/${message.backendConversationId}/sync-messages`,
            'POST',
            { messages: messages }
          );
          sendResponse({
            success: true,
            messages: messages.length,
            message: response.message
          });
        } catch (error) {
          sendResponse({
            success: true,
            messages: messages.length,
            apiError: error.message
          });
        }
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  // Open a conversation (pre-load for faster sending)
  if (message.type === 'OPEN_CONVERSATION') {
    console.log('[Content Script] Open conversation requested:', message.conversationId);

    const conversationUrl = `https://www.linkedin.com/messaging/thread/${message.conversationId}/`;

    if (!window.location.href.includes(message.conversationId)) {
      window.location.href = conversationUrl;
    }

    sendResponse({ success: true, message: 'Navigating to conversation' });
    return true;
  }

  // Sync conversations via LinkedIn API (from content script for correct origin)
  if (message.type === 'SYNC_CONVERSATIONS_VIA_API') {
    console.log('[Content Script] Sync conversations via API requested');

    const syncViaApi = async () => {
      const count = message.count || 50;

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please refresh the page.');
      }

      // Get profile URN first (cached - needed for GraphQL endpoints)
      const profileUrn = await getMyProfileUrn();
      if (profileUrn) {
        console.log('[Content Script] Using cached profile URN:', profileUrn);
      }

      // Try GraphQL endpoints (Waalaxy-style - most reliable)
      const graphqlAttempts = [
        // Waalaxy-style GraphQL endpoint (MOST RELIABLE)
        {
          url: profileUrn
            ? `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=voyagerMessagingDashMessengerConversations.58f000d802f3d66a99c09d8ad7f5544b&variables=(categories:List(PRIMARY_INBOX,INBOX),count:${count},mailboxUrn:${encodeURIComponent(profileUrn)})`
            : null,
          accept: 'application/vnd.linkedin.normalized+json+2.1',
          name: 'Waalaxy GraphQL'
        },
        // Fallback: Standard graphql endpoint
        {
          url: 'https://www.linkedin.com/voyager/api/graphql?queryId=voyagerMessagingDashAffiliatedMailboxes.da7e8047e61ae87c4b97ee31fed7d934',
          accept: 'application/vnd.linkedin.normalized+json+2.1',
          name: 'Affiliated Mailboxes'
        },
      ];

      for (const attempt of graphqlAttempts) {
        if (!attempt.url) continue;

        try {
          console.log(`[Content Script] Trying ${attempt.name}:`, attempt.url);

          const response = await linkedInFetch(attempt.url, {
            method: 'GET',
            headers: {
              'accept': attempt.accept,
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'x-li-lang': 'en_US',
              'x-li-track': JSON.stringify({
                clientVersion: '1.13.41695',
                mpVersion: '1.13.41695',
                osName: 'web',
                timezoneOffset: 5,
                timezone: 'Asia/Karachi',
                deviceFormFactor: 'DESKTOP',
                mpName: 'voyager-web',
                displayDensity: 2,
                displayWidth: 2940,
                displayHeight: 1912
              })
            }
          });

          console.log(`[Content Script] ${attempt.name} status:`, response.status);

          if (response.ok) {
            const data = await response.json();
            console.log(`[Content Script] ${attempt.name} keys:`, Object.keys(data));
            console.log(`[Content Script] ${attempt.name} included:`, data?.included?.length || 0);

            // Log sample data for debugging
            if (data?.included?.length > 0) {
              console.log('[Content Script] Sample entity types:',
                [...new Set(data.included.slice(0, 10).map(e => e.$type || e.entityUrn?.split(':')[2]))]);
            }

            // Try to parse as conversations
            const conversations = parseGraphQLConversations(data);
            if (conversations.length > 0) {
              console.log(`[Content Script] ${attempt.name} found ${conversations.length} conversations!`);
              return conversations;
            }

            // Also try legacy parser
            const legacyConvs = parseConversationsFromResponse(data);
            if (legacyConvs.length > 0) {
              console.log(`[Content Script] ${attempt.name} (legacy parser) found ${legacyConvs.length} conversations!`);
              return legacyConvs;
            }
          }
        } catch (error) {
          console.log(`[Content Script] ${attempt.name} error:`, error.message);
        }
      }

      // FIRST: Try DOM-based extraction (fast, doesn't require API)
      console.log('[Content Script] Trying DOM-based extraction first...');
      const domConversations = await extractConversationsFromDOM();
      if (domConversations.length > 0) {
        console.log(`[Content Script] DOM extraction found ${domConversations.length} conversations`);
        return domConversations;
      }

      // Fallback: Try REST endpoints - legacy endpoint first (known to work)
      const endpoints = [
        // Method 1: Legacy endpoint (WORKS!)
        {
          url: `https://www.linkedin.com/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX&count=${count}`,
          name: 'Legacy INBOX'
        },
        // Method 2: Dash conversations (may not work)
        {
          url: `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?decorationId=com.linkedin.voyager.dash.deco.messaging.FullConversation-65&q=search&count=${count}`,
          name: 'Dash v65'
        },
      ];

      let lastError = null;
      let allConversations = [];

      for (const {url, name} of endpoints) {
        try {
          console.log(`[Content Script] Trying ${name} endpoint:`, url);

          const response = await linkedInFetch(url, {
            method: 'GET',
            headers: {
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'x-li-lang': 'en_US'
            }
          });

          console.log(`[Content Script] ${name} response status:`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`[Content Script] ${name} error:`, errorText.substring(0, 200));
            lastError = new Error(`API error: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log(`[Content Script] ${name} raw data keys:`, Object.keys(data));
          console.log(`[Content Script] ${name} elements count:`, data?.data?.elements?.length || data?.elements?.length || 0);
          console.log(`[Content Script] ${name} included count:`, data?.included?.length || 0);

          // Parse conversations
          const conversations = parseConversationsFromResponse(data);
          console.log(`[Content Script] ${name} parsed:`, conversations.length, 'conversations');

          if (conversations.length > 0) {
            return conversations;
          }

          // If we got a response but no conversations parsed, store the data for debugging
          if (data?.included?.length > 0) {
            console.log('[Content Script] Sample included entity:', JSON.stringify(data.included[0]).substring(0, 500));
          }
        } catch (error) {
          console.log(`[Content Script] ${name} error:`, error.message);
          lastError = error;
        }
      }

      // If all API endpoints failed, fall back to MessageExtractor click method
      console.log('[Content Script] All API endpoints failed, trying MessageExtractor...');

      // Check if we're on the messaging page
      if (!window.location.href.includes('/messaging')) {
        throw new Error('Please navigate to LinkedIn Messaging page first, then try syncing again.');
      }

      // Use MessageExtractor's click-based extraction (this gets real thread IDs)
      if (window.MessageExtractor) {
        try {
          console.log('[Content Script] Using MessageExtractor.extractConversationsWithIds (click method)...');
          const conversations = await window.MessageExtractor.extractConversationsWithIds(count);
          if (conversations.length > 0) {
            console.log(`[Content Script] MessageExtractor found ${conversations.length} conversations`);
            return conversations;
          }
        } catch (extractorError) {
          console.log('[Content Script] MessageExtractor failed:', extractorError.message);
        }
      } else {
        console.log('[Content Script] MessageExtractor not available');
      }

      throw lastError || new Error('All endpoints failed - no conversations found');
    };

    // Helper function to extract conversations from DOM (fallback)
    const extractConversationsFromDOM = async () => {
      console.log('[Content Script] Extracting conversations from DOM...');

      const conversations = [];

      // Wait for conversation list to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try different selectors for conversation items
      const selectors = [
        '.msg-conversations-container__conversations-list .msg-conversation-listitem',
        '.msg-conversations-container__conversations-list li',
        '[data-control-name="overlay.view_conversation"]',
        '.msg-conversation-card',
        '.msg-overlay-list-bubble',
      ];

      let conversationElements = [];
      for (const selector of selectors) {
        conversationElements = document.querySelectorAll(selector);
        if (conversationElements.length > 0) {
          console.log(`[Content Script] Found ${conversationElements.length} conversations with selector: ${selector}`);
          break;
        }
      }

      if (conversationElements.length === 0) {
        console.log('[Content Script] No conversation elements found in DOM');
        return [];
      }

      for (const el of conversationElements) {
        try {
          // Extract conversation ID from link or data attribute
          let conversationId = null;

          // Method 1: Look for link with thread URL
          const link = el.querySelector('a[href*="/messaging/thread/"]') || el.querySelector('a[href*="/messaging/"]');
          if (link) {
            const match = link.href.match(/\/messaging\/thread\/([^/?]+)/) || link.href.match(/\/messaging\/([^/?]+)/);
            if (match && match[1] !== 'thread') {
              conversationId = match[1];
            }
          }

          // Method 2: Try data attributes
          if (!conversationId) {
            conversationId = el.dataset?.conversationId || el.dataset?.threadId || el.dataset?.entityUrn;
          }

          // Method 3: Look for any link that might contain conversation ID
          if (!conversationId) {
            const allLinks = el.querySelectorAll('a[href]');
            for (const a of allLinks) {
              const href = a.href;
              const match = href.match(/thread\/([^/?]+)/) || href.match(/conversation[=\/]([^/?&]+)/);
              if (match) {
                conversationId = match[1];
                break;
              }
            }
          }

          // Method 4: Look for conversation ID in nested elements
          if (!conversationId) {
            // Check if the element or any child has a data attribute with the conversation ID
            const allElements = [el, ...el.querySelectorAll('*')];
            for (const elem of allElements) {
              // Look through all data attributes
              for (const attr of elem.attributes || []) {
                if (attr.name.startsWith('data-') && attr.value) {
                  // LinkedIn conversation IDs typically start with "2-" and are base64-like
                  if (attr.value.match(/^2-[A-Za-z0-9_=-]+$/)) {
                    conversationId = attr.value;
                    console.log('[Content Script] Found conversation ID in data attribute:', attr.name);
                    break;
                  }
                }
              }
              if (conversationId) break;
            }
          }

          // Method 5: Look in onclick handlers or other attributes
          if (!conversationId) {
            const elemWithOnClick = el.querySelector('[onclick*="thread"]') || el.querySelector('[data-tracking-control-name*="conversation"]');
            if (elemWithOnClick) {
              const onclick = elemWithOnClick.getAttribute('onclick') || '';
              const match = onclick.match(/thread\/([^'"\/]+)/) || onclick.match(/2-[A-Za-z0-9_=-]+/);
              if (match) {
                conversationId = match[1] || match[0];
              }
            }
          }

          // IMPORTANT: Skip ember IDs - they are NOT conversation IDs
          if (conversationId && conversationId.startsWith('ember')) {
            console.log('[Content Script] Skipping ember ID:', conversationId);
            conversationId = null;
          }

          // Log for debugging
          if (!conversationId) {
            console.log('[Content Script] Could not extract ID from element. Outer HTML:', el.outerHTML.substring(0, 500));
            continue;
          }

          // Validate conversation ID format (should be like "2-xxx" for messaging threads)
          if (!conversationId.match(/^2-[A-Za-z0-9_=-]+$/)) {
            console.log('[Content Script] Invalid conversation ID format:', conversationId);
            continue;
          }

          console.log('[Content Script] Extracted valid conversation ID:', conversationId);

          // Extract participant name - try multiple selectors
          let participantName = 'Unknown';
          const nameSelectors = [
            '.msg-conversation-card__participant-names',
            '.msg-conversation-listitem__participant-names',
            '.msg-conversation-card__row--headline',
            '.msg-conversation-listitem__title',
            '.msg-selectable-entity__title',
            '[class*="participant-name"]',
            'h3',
            '.artdeco-entity-lockup__title'
          ];
          for (const sel of nameSelectors) {
            const nameEl = el.querySelector(sel);
            if (nameEl && nameEl.textContent.trim()) {
              participantName = nameEl.textContent.trim();
              break;
            }
          }

          // Extract avatar - try multiple selectors
          let participantAvatarUrl = null;
          const avatarEl = el.querySelector('img.presence-entity__image, img.msg-facepile-grid__img, img[class*="avatar"], .msg-selectable-entity__img img, img');
          if (avatarEl && avatarEl.src && !avatarEl.src.includes('data:')) {
            participantAvatarUrl = avatarEl.src;
          }

          // Extract last message preview
          let lastMessagePreview = null;
          const previewSelectors = [
            '.msg-conversation-card__message-snippet',
            '.msg-conversation-listitem__message-snippet',
            '.msg-selectable-entity__message-snippet',
            '[class*="message-snippet"]',
            '.msg-conversation-card__body',
            'p'
          ];
          for (const sel of previewSelectors) {
            const previewEl = el.querySelector(sel);
            if (previewEl && previewEl.textContent.trim()) {
              lastMessagePreview = previewEl.textContent.trim();
              break;
            }
          }

          // Extract time
          let lastMessageAt = null;
          const timeEl = el.querySelector('.msg-conversation-card__time-stamp, .msg-conversation-listitem__time-stamp, time, [class*="time-stamp"]');
          if (timeEl) {
            const dateTime = timeEl.getAttribute('datetime');
            if (dateTime) {
              lastMessageAt = dateTime;
            } else if (timeEl.textContent) {
              // Try to parse relative time like "2h" or "3d"
              lastMessageAt = new Date().toISOString(); // Fallback to now
            }
          }

          // Check if unread
          const isUnread = el.classList.contains('msg-conversation-card--unread') ||
                          el.classList.contains('active') ||
                          el.querySelector('.notification-badge, [class*="unread"]') !== null;

          conversations.push({
            linkedin_conversation_id: conversationId,
            participant_name: participantName,
            participant_linkedin_id: null, // Not easily available from DOM
            participant_profile_url: null,
            participant_avatar_url: participantAvatarUrl,
            last_message_preview: lastMessagePreview,
            last_message_at: lastMessageAt,
            is_unread: isUnread,
            unread_count: isUnread ? 1 : 0,
          });
        } catch (e) {
          console.log('[Content Script] Error parsing conversation element:', e);
        }
      }

      console.log(`[Content Script] DOM extraction complete: ${conversations.length} conversations extracted`);
      return conversations;
    };

    // Helper function to parse GraphQL conversation responses
    const parseGraphQLConversations = (data) => {
      const conversations = [];

      try {
        // GraphQL responses can have different structures
        const results = data?.data?.messengerConversationsBySyncToken?.elements ||
                       data?.data?.messengerConversations?.elements ||
                       data?.data?.conversationList?.elements ||
                       data?.elements ||
                       [];

        console.log('[Content Script] GraphQL elements found:', results.length);

        for (const conv of results) {
          try {
            // Extract conversation ID
            let conversationId = null;
            const backendUrn = conv.backendUrn || conv.entityUrn || conv.conversationUrn;

            if (backendUrn) {
              const match = backendUrn.match(/messagingThread:([^,)]+)/) ||
                           backendUrn.match(/,([^)]+)\)/);
              if (match) {
                conversationId = match[1];
              }
            }

            if (!conversationId) continue;

            // Get participant info
            let participantName = 'Unknown';
            let participantLinkedinId = null;
            let participantProfileUrl = null;
            let participantAvatarUrl = null;

            const participants = conv.participants || conv.conversationParticipants || [];
            for (const p of participants) {
              const profile = p.participantProfile || p.profile || p;
              if (profile) {
                participantName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.name || 'Unknown';
                participantLinkedinId = profile.publicIdentifier;
                participantProfileUrl = participantLinkedinId
                  ? `https://www.linkedin.com/in/${participantLinkedinId}/`
                  : null;

                // Avatar
                const picture = profile.profilePicture?.displayImageReference?.vectorImage ||
                               profile.picture;
                if (picture?.rootUrl && picture?.artifacts?.length) {
                  const artifact = picture.artifacts[picture.artifacts.length - 1];
                  participantAvatarUrl = picture.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }
                break;
              }
            }

            // Get last message
            let lastMessagePreview = null;
            if (conv.lastMessage?.body?.text) {
              lastMessagePreview = conv.lastMessage.body.text;
            }

            conversations.push({
              linkedin_conversation_id: conversationId,
              participant_name: participantName,
              participant_linkedin_id: participantLinkedinId,
              participant_profile_url: participantProfileUrl,
              participant_avatar_url: participantAvatarUrl,
              last_message_preview: lastMessagePreview,
              last_message_at: conv.lastActivityAt ? new Date(conv.lastActivityAt).toISOString() : null,
              is_unread: (conv.unreadCount || 0) > 0,
              unread_count: conv.unreadCount || 0,
            });
          } catch (e) {
            console.log('[Content Script] Error parsing GraphQL conversation:', e);
          }
        }
      } catch (e) {
        console.log('[Content Script] GraphQL parse error:', e);
      }

      return conversations;
    };

    // Helper function to parse conversations (handles both legacy and new formats)
    const parseConversationsFromResponse = (response) => {
      const conversations = [];
      const included = response.included || [];

      // Create lookup map for included entities
      const entityMap = {};
      for (const entity of included) {
        if (entity.entityUrn) {
          entityMap[entity.entityUrn] = entity;
        }
        if (entity['$id']) {
          entityMap[entity['$id']] = entity;
        }
      }

      // Handle legacy format: data.*elements contains URN references
      let elements = response.data?.elements || response.elements || [];

      // If elements is empty but we have *elements URNs, resolve them
      if (elements.length === 0 && response.data?.['*elements']) {
        const elementUrns = response.data['*elements'];
        console.log('[Content Script] Legacy format - resolving', elementUrns.length, 'URNs');
        elements = elementUrns.map(urn => entityMap[urn]).filter(Boolean);
      }

      console.log('[Content Script] Parsing - elements:', elements.length, 'included:', included.length);

      for (const element of elements) {
        try {
          // Get conversation ID - handle multiple URN formats
          let conversationId = null;
          const urn = element.backendConversationUrn || element.entityUrn || element['*conversation'];

          if (urn) {
            // Format: urn:li:fs_conversation:2-xxx (legacy)
            const fsMatch = urn.match(/fs_conversation:([^,)]+)/);
            if (fsMatch) {
              conversationId = fsMatch[1];
            }
            // Format: urn:li:messagingThread:2-xxx
            if (!conversationId) {
              const threadMatch = urn.match(/messagingThread:([^,)]+)/);
              if (threadMatch) {
                conversationId = threadMatch[1];
              }
            }
            // Format: urn:li:msg_conversation:(xxx,2-xxx)
            if (!conversationId) {
              const convMatch = urn.match(/,([^)]+)\)/);
              if (convMatch) {
                conversationId = convMatch[1];
              }
            }
          }

          if (!conversationId) {
            console.log('[Content Script] Could not extract conversation ID from:', urn);
            continue;
          }

          // Get participant info - handle both legacy and new formats
          // IMPORTANT: Skip the current user (self) to get the OTHER participant
          let participantName = 'Unknown';
          let participantLinkedinId = null;
          let participantProfileUrl = null;
          let participantAvatarUrl = null;

          // Try new format first (with *conversationParticipants)
          const participantRefs = element['*conversationParticipants'] || element['*participants'] || element.participants || [];

          // Collect all participants first, then pick the non-self one
          const allParticipants = [];

          for (const pRef of participantRefs) {
            const participant = entityMap[pRef] || (typeof pRef === 'object' ? pRef : null);
            if (participant) {
              // New format: participant has *participantProfile
              const profileRef = participant['*participantProfile'] || participant['*profile'] || participant.profile;
              const profile = entityMap[profileRef] || participant;

              // Try to get participant info
              if (profile) {
                const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.name || 'Unknown';
                const linkedinId = profile.publicIdentifier;
                const profileUrl = linkedinId ? `https://www.linkedin.com/in/${linkedinId}/` : null;

                // Get avatar - handle multiple picture formats
                let avatarUrl = null;
                const picture = profile.profilePicture?.displayImageReference?.vectorImage ||
                                (profile.picture?.rootUrl ? profile.picture : null);
                if (picture?.rootUrl && picture?.artifacts?.length) {
                  const artifact = picture.artifacts[picture.artifacts.length - 1];
                  avatarUrl = picture.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }

                // Check if this is self (hostIdentityUrn indicates self)
                const isSelf = participant.hostIdentityUrn || participant.isSelf || false;

                allParticipants.push({
                  name, linkedinId, profileUrl, avatarUrl, isSelf
                });
                continue;
              }

              // Legacy format: participant has *miniProfile
              const miniProfileRef = participant['*miniProfile'];
              const miniProfile = entityMap[miniProfileRef] || participant.miniProfile;
              if (miniProfile) {
                const name = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
                const linkedinId = miniProfile.publicIdentifier;
                const profileUrl = linkedinId ? `https://www.linkedin.com/in/${linkedinId}/` : null;

                let avatarUrl = null;
                const pic = miniProfile.picture;
                if (pic?.rootUrl && pic?.artifacts?.length) {
                  const artifact = pic.artifacts[pic.artifacts.length - 1];
                  avatarUrl = pic.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }

                // Check if this is self
                const isSelf = participant.hostIdentityUrn || participant.isSelf || false;

                allParticipants.push({
                  name, linkedinId, profileUrl, avatarUrl, isSelf
                });
              }
            }
          }

          // Pick the OTHER participant (not self)
          // If we can't determine self, pick the second one (first is usually self in LinkedIn's API)
          const otherParticipant = allParticipants.find(p => !p.isSelf) ||
                                   allParticipants[1] ||
                                   allParticipants[0];

          if (otherParticipant) {
            participantName = otherParticipant.name;
            participantLinkedinId = otherParticipant.linkedinId;
            participantProfileUrl = otherParticipant.profileUrl;
            participantAvatarUrl = otherParticipant.avatarUrl;
          }

          // Get last message preview
          let lastMessagePreview = null;

          // New format: *lastMessage
          const lastMsgRef = element['*lastMessage'];
          if (lastMsgRef) {
            const lastMsg = entityMap[lastMsgRef];
            if (lastMsg?.body?.text) {
              lastMessagePreview = lastMsg.body.text;
            }
          }

          // Legacy format: *events
          if (!lastMessagePreview) {
            const eventsRef = element['*events'];
            if (eventsRef && eventsRef.length > 0) {
              const lastEventRef = eventsRef[0];
              const lastEvent = entityMap[lastEventRef];
              if (lastEvent?.eventContent) {
                const msgEvent = lastEvent.eventContent['com.linkedin.voyager.messaging.event.MessageEvent'];
                if (msgEvent) {
                  lastMessagePreview = msgEvent.attributedBody?.text || msgEvent.body || null;
                }
              }
            }
          }

          conversations.push({
            linkedin_conversation_id: conversationId,
            participant_name: participantName,
            participant_linkedin_id: participantLinkedinId,
            participant_profile_url: participantProfileUrl,
            participant_avatar_url: participantAvatarUrl,
            last_message_preview: lastMessagePreview,
            last_message_at: element.lastActivityAt ? new Date(element.lastActivityAt).toISOString() : null,
            is_unread: (element.unreadCount || 0) > 0,
            unread_count: element.unreadCount || 0,
          });
        } catch (error) {
          console.error('[Content Script] Error parsing conversation:', error);
        }
      }

      return conversations;
    };

    syncViaApi()
      .then(conversations => {
        console.log('[Content Script] Sync success:', conversations.length, 'conversations');
        sendResponse({ success: true, conversations });
      })
      .catch(error => {
        console.error('[Content Script] Sync error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // Send a message via LinkedIn API (from content script for correct origin)
  if (message.type === 'SEND_MESSAGE_VIA_API') {
    console.log('[Content Script] Send message via API requested');

    const sendViaApi = async () => {
      const conversationId = message.conversationId;
      const content = message.content;

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please refresh the page.');
      }

      // Get current user's profile URN (cached)
      const profileUrn = await getMyProfileUrn();
      if (!profileUrn) {
        throw new Error('Could not get profile URN');
      }
      console.log('[Content Script] Profile URN:', profileUrn);

      // Generate UUID
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Generate tracking ID as raw bytes (LinkedIn's format)
      const generateTrackingId = () => {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return String.fromCharCode.apply(null, bytes);
      };

      // Build request body (exact format LinkedIn uses)
      const body = {
        dedupeByClientGeneratedToken: false,
        mailboxUrn: profileUrn,
        message: {
          body: {
            attributes: [],
            text: content
          },
          conversationUrn: `urn:li:msg_conversation:(${profileUrn},${conversationId})`,
          originToken: generateUUID(),
          renderContentUnions: []
        },
        trackingId: generateTrackingId()
      };

      console.log('[Content Script] Sending to API...');
      console.log('[Content Script] Body:', JSON.stringify(body));

      // Mark message as sent to avoid it being detected as incoming
      if (window.MessageExtractor?.markMessageAsSent) {
        window.MessageExtractor.markMessageAsSent(content);
      }

      // Try sending with retry logic
      const maxRetries = 2;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[Content Script] Retry attempt ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          }

          const response = await linkedInFetch('https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'text/plain;charset=UTF-8',
              'csrf-token': csrfToken,
              'x-li-lang': 'en_US',
              'x-li-page-instance': `urn:li:page:d_flagship3_messaging_conversation_detail;${generateUUID().replace(/-/g, '').substring(0, 22)}==`,
              'x-li-track': JSON.stringify({
                clientVersion: '1.13.41695',
                mpVersion: '1.13.41695',
                osName: 'web',
                timezoneOffset: new Date().getTimezoneOffset() * -1,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceFormFactor: 'DESKTOP',
                mpName: 'voyager-web',
                displayDensity: 2,
                displayWidth: window.screen.width,
                displayHeight: window.screen.height
              }),
              'x-restli-protocol-version': '2.0.0'
            },
            body: JSON.stringify(body)
          });

          const responseText = await response.text();
          console.log('[Content Script] Response status:', response.status);
          console.log('[Content Script] Response:', responseText);

          if (!response.ok) {
            throw new Error(`API error ${response.status}: ${responseText}`);
          }

          const data = JSON.parse(responseText);
          return {
            success: true,
            messageId: data?.value?.createdEventUrn || data?.value?.entityUrn || null
          };
        } catch (error) {
          lastError = error;
          console.log(`[Content Script] Send attempt ${attempt + 1} failed:`, error.message);

          // Don't retry on certain errors
          if (error.message.includes('403') || error.message.includes('401')) {
            break; // Auth errors - don't retry
          }
        }
      }

      throw lastError || new Error('Failed to send message after retries');
    };

    sendViaApi()
      .then(result => {
        console.log('[Content Script] API send success:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Content Script] API send error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // Send a message in LinkedIn (assumes conversation is already open via pre-open)
  if (message.type === 'SEND_LINKEDIN_MESSAGE') {
    console.log('[Content Script] Send LinkedIn message requested');
    console.log('[Content Script] Current URL:', window.location.href);
    console.log('[Content Script] Target conversation:', message.linkedinConversationId);

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded.'
      });
      return true;
    }

    const sendMsg = async () => {
      // Check if we're on the right conversation
      const isOnCorrectConversation = window.location.href.includes(message.linkedinConversationId);

      if (!isOnCorrectConversation) {
        // If not on correct conversation, tell background to navigate first
        // Don't navigate here as it will reload the content script
        console.log('[Content Script] Not on correct conversation, requesting navigation...');
        throw new Error('Please click on the conversation first to open it, then try sending again.');
      }

      // Wait for the message input to be ready
      console.log('[Content Script] Waiting for message input...');
      const inputSelectors = [
        '.msg-form__contenteditable[contenteditable="true"]',
        '.msg-form__contenteditable',
        '[contenteditable="true"][role="textbox"]'
      ];

      let inputFound = false;
      for (const selector of inputSelectors) {
        const input = await window.MessageExtractor.waitForElement(selector, 3000);
        if (input) {
          console.log('[Content Script] Found input:', selector);
          inputFound = true;
          break;
        }
      }

      if (!inputFound) {
        throw new Error('Message input not found. Please make sure the conversation is fully loaded.');
      }

      // Send the message
      console.log('[Content Script] Sending message...');
      const success = await window.MessageExtractor.sendMessage(message.content);
      console.log('[Content Script] Send result:', success);

      if (success && message.messageId) {
        // Mark message as sent in backend (fire and forget)
        window.ExtensionAPI.request(
          `/inbox/messages/${message.messageId}/mark-sent`,
          'POST',
          { success: true }
        ).catch(error => {
          console.error('[Content Script] Failed to mark message as sent:', error);
        });
      }

      return success;
    };

    sendMsg()
      .then(success => {
        console.log('[Content Script] Sending response, success:', success);
        sendResponse({ success: success });
      })
      .catch(error => {
        console.error('[Content Script] Send message error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  // ==================== UTILITY MESSAGES ====================

  // Fetch messages for multiple conversations (used during sync)
  if (message.type === 'FETCH_MESSAGES_FOR_CONVERSATIONS') {
    console.log('[Content Script] Fetching messages for conversations...');

    const fetchMessages = async () => {
      const conversationIds = message.conversationIds || [];
      const conversationMessages = {};

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('Not logged in to LinkedIn');
      }

      for (const conversationId of conversationIds) {
        try {
          console.log('[Content Script] Fetching messages for:', conversationId);

          // Use direct conversation ID format (works!)
          let response = await linkedInFetch(
            `https://www.linkedin.com/voyager/api/messaging/conversations/${conversationId}/events?count=20`,
            {
              headers: {
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const included = data.included || [];
            const elements = data.data?.elements || data.elements || [];

            // Build entity map
            const entityMap = {};
            for (const entity of included) {
              if (entity.entityUrn) entityMap[entity.entityUrn] = entity;
            }

            // Get events - the API endpoint is already filtered by conversation ID
            // so all events in the response belong to this conversation
            let eventEntities = [];

            // Try elements array first (main response)
            if (elements.length > 0) {
              eventEntities = elements.filter(e =>
                e['$type'] === 'com.linkedin.voyager.messaging.Event' ||
                e.eventContent
              );
              console.log('[Content Script] Using elements array:', eventEntities.length, 'events');
            }

            // Fallback: check included array for events
            if (eventEntities.length === 0) {
              eventEntities = included.filter(e =>
                e['$type'] === 'com.linkedin.voyager.messaging.Event'
              );
              console.log('[Content Script] Using included array fallback:', eventEntities.length, 'events');
            }

            const messages = [];
            for (const event of eventEntities) {
              const eventContent = event.eventContent || {};

              // New format: content is directly in eventContent, not nested
              const content = eventContent.attributedBody?.text || eventContent.body || '';
              if (!content) continue;

              // Get sender info
              const senderUrn = event['*from'] || event.from;
              const sender = entityMap[senderUrn];
              const miniProfileUrn = sender?.['*miniProfile'];
              const miniProfile = entityMap[miniProfileUrn];

              let senderName = 'Unknown';
              let isFromMe = false;

              if (miniProfile) {
                senderName = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
              }

              // Check if from me - multiple methods for reliability
              // Method 1: Check subtype (most reliable when available)
              if (event.subtype === 'MEMBER_TO_MEMBER_OUTBOUND') {
                isFromMe = true;
              }
              // Method 2: Check fromCurrentUser flag
              else if (event.fromCurrentUser === true) {
                isFromMe = true;
              }
              // Method 3: Check participant type in sender
              else if (sender) {
                const participantRef = sender['*messagingMember'] || sender['*participant'];
                const participant = entityMap[participantRef] || sender;
                if (participant?.participantType === 'SELF' || participant?.isSelf === true) {
                  isFromMe = true;
                }
              }

              messages.push({
                linkedin_message_id: event.entityUrn,
                content,
                is_from_me: isFromMe,
                sender_name: senderName,
                sent_at: event.createdAt ? new Date(event.createdAt).toISOString() : null
              });
            }

            // Sort by sent_at ascending (oldest first)
            messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

            conversationMessages[conversationId] = messages;
            console.log(`[Content Script] Got ${messages.length} messages for ${conversationId}`);
          }
        } catch (e) {
          console.log(`[Content Script] Error fetching messages for ${conversationId}:`, e.message);
          conversationMessages[conversationId] = [];
        }
      }

      return conversationMessages;
    };

    fetchMessages()
      .then(conversationMessages => {
        sendResponse({ success: true, conversationMessages });
      })
      .catch(error => {
        console.error('[Content Script] Fetch messages error:', error);
        sendResponse({ success: false, error: error.message, conversationMessages: {} });
      });

    return true;
  }

  // Check for new messages (polling) - API-based approach
  if (message.type === 'CHECK_NEW_MESSAGES') {
    console.log('[Content Script] 🔍 CHECK_NEW_MESSAGES received');
    console.log('[Content Script] Current URL:', window.location.href);

    const checkMessagesViaAPI = async () => {
      const lastKnownState = message.lastKnownState || {}; // { conversationId: lastMessageTimestamp }
      console.log('[Content Script] Last known state:', Object.keys(lastKnownState).length, 'conversations');

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        console.log('[Content Script] ❌ No CSRF token found');
        throw new Error('Not logged in to LinkedIn');
      }
      console.log('[Content Script] ✅ CSRF token found');

      const newMessages = [];
      const updatedState = { ...lastKnownState };

      // Get conversation(s) to check
      const conversations = [];

      // Method 1: Get current conversation from URL (most reliable)
      const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/?]+)/);
      if (urlMatch) {
        const convId = urlMatch[1];
        // Try to get participant name from the page
        const nameEl = document.querySelector('.msg-entity-lockup__entity-title, .msg-thread__link-to-profile, h2.msg-overlay-bubble-header__title');
        const participantName = nameEl?.textContent?.trim() || 'Unknown';

        console.log('[Content Script] Current conversation from URL:', convId, '-', participantName);
        conversations.push({
          conversationId: convId,
          participantName: participantName,
          hasUnread: false
        });
      }

      // Method 2: Add active conversations passed from background (ones we've messaged)
      const activeConvs = message.activeConversations || [];
      if (activeConvs.length > 0) {
        console.log('[Content Script] 📨 Active conversations from background:', activeConvs.length);
        for (const convId of activeConvs) {
          if (convId && !conversations.find(c => c.conversationId === convId)) {
            conversations.push({
              conversationId: convId,
              participantName: 'Unknown', // We don't have the name, but that's ok
              hasUnread: false
            });
          }
        }
      }

      // Method 3: Also check previously synced conversations from storage
      try {
        const stored = await new Promise(resolve => {
          chrome.storage.local.get('synced_conversations', result => resolve(result.synced_conversations || []));
        });

        for (const conv of stored) {
          // Don't add duplicates
          if (conv.conversationId && !conversations.find(c => c.conversationId === conv.conversationId)) {
            conversations.push(conv);
          }
        }

        if (stored.length > 0) {
          console.log('[Content Script] Added', stored.length, 'conversations from storage');
        }
      } catch (e) {
        console.log('[Content Script] Could not load stored conversations');
      }

      // Method 4: Fetch recent conversations with unread messages from LinkedIn API
      // This catches NEW conversations that haven't been synced yet
      try {
        const unreadResponse = await linkedInFetch(
          'https://www.linkedin.com/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX&q=syncToken&count=10',
          {
            headers: {
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0'
            }
          }
        );

        if (unreadResponse.ok) {
          const unreadData = await unreadResponse.json();
          const included = unreadData.included || [];

          // Find conversation entities
          const convEntities = included.filter(e =>
            e['$type'] === 'com.linkedin.voyager.messaging.Conversation' ||
            e.entityUrn?.includes('msg_conversation')
          );

          let addedCount = 0;
          for (const conv of convEntities) {
            // Only add if has unread messages
            if (conv.unreadCount > 0 || conv.lastActivityAt > (Date.now() - 60000)) {
              // Extract conversation ID
              const entityUrn = conv.entityUrn || '';
              const match = entityUrn.match(/,([^)]+)\)/) || entityUrn.match(/conversation:([^,]+)/);
              const convId = match ? match[1] : null;

              if (convId && !conversations.find(c => c.conversationId === convId)) {
                // Try to get participant name
                let participantName = 'Unknown';
                const participantRefs = conv['*participants'] || conv.participants || [];
                for (const ref of participantRefs) {
                  const participant = included.find(e => e.entityUrn === ref);
                  if (participant) {
                    const profileRef = participant['*miniProfile'] || participant['*profile'];
                    const profile = included.find(e => e.entityUrn === profileRef);
                    if (profile) {
                      participantName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
                      break;
                    }
                  }
                }

                conversations.push({
                  conversationId: convId,
                  participantName: participantName,
                  hasUnread: conv.unreadCount > 0
                });
                addedCount++;
              }
            }
          }

          if (addedCount > 0) {
            console.log('[Content Script] Added', addedCount, 'conversations with recent activity from LinkedIn API');
          }
        }
      } catch (e) {
        console.log('[Content Script] Could not fetch unread conversations:', e.message);
      }

      console.log('[Content Script] 📋 Total conversations to check:', conversations.length);
      if (conversations.length > 0) {
        console.log('[Content Script] Conversations:', conversations.map(c => c.conversationId).join(', '));
      }

      if (conversations.length === 0) {
        console.log('[Content Script] ❌ No conversations to check');
        console.log('[Content Script] Tip: Navigate to a conversation (/messaging/thread/...) or sync inbox first');
        return { newMessages: [], updatedState: lastKnownState };
      }

      // Get my profile URN for filtering out my own messages (cached)
      const myProfileUrn = await getMyProfileUrn();
      if (myProfileUrn) {
        console.log('[Content Script] Using profile URN:', myProfileUrn);
      }

      // Process each conversation to find new messages
      for (const conv of conversations) {
        try {
          const conversationId = conv.conversationId;
          const participantName = conv.participantName;

          console.log('[Content Script] Processing conversation:', conversationId, '-', participantName);

          // Check if this conversation has new activity since last check
          const lastKnown = lastKnownState[conversationId] || 0;

          // Try GraphQL first (Waalaxy-style - more reliable), then fallback to REST
          let msgData = null;
          let useGraphQL = false;

          // Method 1: GraphQL (Waalaxy-style)
          if (myProfileUrn) {
            try {
              const conversationUrn = `urn:li:msg_conversation:(${myProfileUrn},${conversationId})`;
              const graphqlUrl = `https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=voyagerMessagingDashMessengerMessages.c7d0ab7f4b411aa8a849fbf8b210facc&variables=(deliveredAt:${Date.now()},conversationUrn:${encodeURIComponent(conversationUrn)},countBefore:20,countAfter:0)`;

              const graphqlResponse = await linkedInFetch(graphqlUrl, {
                headers: {
                  'accept': 'application/vnd.linkedin.normalized+json+2.1',
                  'csrf-token': csrfToken,
                  'x-restli-protocol-version': '2.0.0'
                }
              });

              if (graphqlResponse.ok) {
                msgData = await graphqlResponse.json();
                useGraphQL = true;
                console.log('[Content Script] Using GraphQL for messages');
              }
            } catch (e) {
              console.log('[Content Script] GraphQL failed, trying REST:', e.message);
            }
          }

          // Method 2: REST fallback
          if (!msgData) {
            const restResponse = await linkedInFetch(
              `https://www.linkedin.com/voyager/api/messaging/conversations/${conversationId}/events?count=10`,
              {
                headers: {
                  'accept': 'application/vnd.linkedin.normalized+json+2.1',
                  'csrf-token': csrfToken,
                  'x-restli-protocol-version': '2.0.0'
                }
              }
            );

            if (restResponse.ok) {
              msgData = await restResponse.json();
              console.log('[Content Script] Using REST for messages');
            }
          }

          if (msgData) {
            const msgIncluded = msgData.included || [];
            const msgElements = msgData.data?.elements || msgData.elements || [];

            // Build message entity map
            const msgEntityMap = {};
            for (const entity of msgIncluded) {
              if (entity.entityUrn) msgEntityMap[entity.entityUrn] = entity;
            }

            // Get message entities - the API endpoint is already filtered by conversation
            // so we just need to find the message/event entities
            let messageEntities = [];

            if (useGraphQL) {
              // GraphQL format - messages are in included array with specific type
              messageEntities = msgIncluded.filter(e =>
                e['$type'] === 'com.linkedin.voyager.dash.messaging.MessengerMessage' ||
                e.entityUrn?.includes('msg_message')
              );
              console.log('[Content Script] GraphQL: Found', messageEntities.length, 'message entities');
            } else {
              // REST format - events are in elements array
              if (msgElements.length > 0) {
                messageEntities = msgElements.filter(e =>
                  e['$type'] === 'com.linkedin.voyager.messaging.Event' || e.eventContent
                );
                console.log('[Content Script] REST elements: Found', messageEntities.length, 'events');
              }
              // Fallback: check included array for events
              if (messageEntities.length === 0) {
                messageEntities = msgIncluded.filter(e =>
                  e['$type'] === 'com.linkedin.voyager.messaging.Event'
                );
                console.log('[Content Script] REST included fallback: Found', messageEntities.length, 'events');
              }
            }

            console.log('[Content Script] Processing', messageEntities.length, 'events for conversation', conversationId);

            // Process messages
            for (const event of messageEntities) {
              // Get timestamp (different field names for GraphQL vs REST)
              const createdAt = event.deliveredAt || event.createdAt;
              if (!createdAt || createdAt <= lastKnown) continue;

              // Get content (different structure for GraphQL vs REST)
              let content = '';
              if (useGraphQL) {
                content = event.body?.text || '';
              } else {
                const eventContent = event.eventContent || {};
                content = eventContent.attributedBody?.text || eventContent.body || '';
              }
              if (!content) continue;

              // Check if from me (skip our own messages)
              let isFromMe = false;
              let senderName = participantName;

              if (useGraphQL) {
                // GraphQL format
                const senderRef = event['*sender'] || event.sender;
                const sender = msgEntityMap[senderRef] || event.sender;
                if (sender) {
                  const profileRef = sender['*profile'] || sender.profile;
                  const profile = msgEntityMap[profileRef] || sender;
                  if (profile?.entityUrn === myProfileUrn) {
                    isFromMe = true;
                  }
                  if (profile) {
                    senderName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || participantName;
                  }
                }
              } else {
                // REST format
                const senderUrn = event['*from'] || event.from;
                const sender = msgEntityMap[senderUrn];

                // Method 1: Check the from field against our profile
                if (senderUrn && myProfileUrn) {
                  const senderProfileMatch = senderUrn.match(/fsd_profile:([^,)]+)/);
                  const myProfileMatch = myProfileUrn.match(/fsd_profile:([^,)]+)/);
                  if (senderProfileMatch && myProfileMatch && senderProfileMatch[1] === myProfileMatch[1]) {
                    isFromMe = true;
                  }
                }

                // Method 2: Check participant type in sender
                if (sender) {
                  const participantRef = sender['*messagingMember'] || sender['*participant'];
                  const participant = msgEntityMap[participantRef] || sender;
                  if (participant?.participantType === 'SELF' || participant?.isSelf) {
                    isFromMe = true;
                  }
                }

                // Method 3: Check event subtype
                if (event.subtype === 'MEMBER_TO_MEMBER_OUTBOUND') {
                  isFromMe = true;
                }

                // Get sender name
                if (sender) {
                  const miniProfileUrn = sender['*miniProfile'];
                  const miniProfile = msgEntityMap[miniProfileUrn] || sender?.miniProfile;
                  if (miniProfile) {
                    senderName = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
                  }
                }
              }

              // Skip messages from me
              if (isFromMe) {
                console.log('[Content Script] Skipping message from me:', content.substring(0, 30));
                continue;
              }

              // Extract message ID
              const messageUrn = event.entityUrn || '';
              const linkedinMessageId = messageUrn;

              console.log('[Content Script] Found incoming message:', content.substring(0, 50));

              newMessages.push({
                conversationId,
                participantName,
                linkedin_message_id: linkedinMessageId,
                message: {
                  content,
                  is_from_me: false,
                  sender_name: senderName,
                  sent_at: new Date(createdAt).toISOString(),
                  linkedin_message_id: linkedinMessageId
                }
                });
              }
            }

          // Update state with current timestamp
          updatedState[conversationId] = Date.now();
        } catch (e) {
          console.log('[Content Script] Error processing conversation:', e);
        }
      }

      // Filter out duplicates and messages we sent
      const filteredMessages = [];
      const seenIds = new Set();

      for (const msg of newMessages) {
        const msgId = msg.linkedin_message_id || `${msg.conversationId}-${msg.message.content}`;
        if (!seenIds.has(msgId)) {
          seenIds.add(msgId);
          filteredMessages.push(msg);
        }
      }

      console.log('[Content Script] Found', filteredMessages.length, 'new messages via API');

      return {
        newMessages: filteredMessages,
        updatedState
      };
    };

    checkMessagesViaAPI()
      .then(result => {
        console.log('[Content Script] API check complete:', result.newMessages.length, 'new messages');
        sendResponse({
          success: true,
          newMessages: result.newMessages,
          updatedState: result.updatedState
        });
      })
      .catch(error => {
        console.error('[Content Script] API check error:', error);
        sendResponse({ success: false, error: error.message, newMessages: [], updatedState: {} });
      });

    return true;
  }

  // Get current user profile URL (for account verification)
  if (message.type === 'GET_CURRENT_USER') {
    if (typeof window.ActionExecutor !== 'undefined') {
      window.ActionExecutor.getCurrentUserProfileUrl()
        .then(profileUrl => {
          sendResponse({ success: true, profileUrl });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: 'Action executor not loaded' });
    }

    return true;
  }
});

/**
 * Handle extraction request
 * @param {number} limit - Maximum number of profiles to extract
 * @returns {Promise<object>} Extraction result
 */
async function handleExtraction(limit) {
  console.log(`[Content Script] Starting extraction with limit: ${limit}`);

  try {
    // Check if we're on a supported LinkedIn page
    if (!isSearchResultsPage()) {
      throw new Error('Please navigate to a LinkedIn Search Results or My Connections page');
    }

    // Check if selectors are loaded
    if (typeof window.LINKEDIN_SELECTORS === 'undefined') {
      throw new Error('LinkedIn selectors not loaded. Please refresh the page.');
    }

    // Check if extractor service is loaded
    if (typeof performExtraction !== 'function') {
      throw new Error('Extractor service not loaded. Please refresh the page.');
    }

    // Perform extraction
    const prospects = await performExtraction(limit);

    console.log(`[Content Script] Extraction complete: ${prospects.length} prospects`);

    return {
      success: true,
      prospects: prospects,
      count: prospects.length
    };
  } catch (error) {
    console.error('[Content Script] Extraction failed:', error);

    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Check if current page is a valid extraction page
 * Supports: Search Results, My Connections
 * @returns {boolean} True if on a supported page
 */
function isSearchResultsPage() {
  const url = window.location.href;

  // Check if URL matches supported patterns
  // LinkedIn uses both /search/results/people and /flagship-web/search/results/people
  const isSearchPage = url.includes('search/results/people');
  const isConnectionsPage = url.includes('linkedin.com/mynetwork/invite-connect/connections');

  const isValidPage = isSearchPage || isConnectionsPage;

  if (!isValidPage) {
    console.warn('[Content Script] Not on a supported extraction page. Current URL:', url);
    console.log('[Content Script] Supported pages: Search Results, My Connections');
  } else {
    console.log('[Content Script] Valid extraction page detected:', isSearchPage ? 'Search Results' : 'My Connections');
  }

  return isValidPage;
}

/**
 * Check if page has loaded search results
 * @returns {boolean} True if results are present
 */
function hasSearchResults() {
  if (!window.LINKEDIN_SELECTORS) {
    return false;
  }

  const resultsContainer = document.querySelector(
    window.LINKEDIN_SELECTORS.SEARCH.RESULTS_CONTAINER
  );

  return resultsContainer !== null;
}

// Log when content script is fully initialized
console.log('[Content Script] Initialization complete');
console.log('[Content Script] Is search page:', isSearchResultsPage());
console.log('[Content Script] Has results:', hasSearchResults());
