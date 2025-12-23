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

console.log('[Content Script] LinkedIn Automation extension loaded');

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
 * Listen for messages from popup and background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.type);

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

  // Send a message via LinkedIn API (from content script for correct origin)
  if (message.type === 'SEND_MESSAGE_VIA_API') {
    console.log('[Content Script] Send message via API requested');

    const sendViaApi = async () => {
      const conversationId = message.conversationId;
      const content = message.content;

      // Get CSRF token from cookie
      const getCsrfToken = () => {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'JSESSIONID') {
            return value.replace(/"/g, '');
          }
        }
        return null;
      };

      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please refresh the page.');
      }

      // Get current user's profile URN
      const getProfileUrn = async () => {
        const response = await fetch('https://www.linkedin.com/voyager/api/voyagerIdentityDashProfiles?q=memberIdentity&memberIdentity=me', {
          method: 'GET',
          headers: {
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'csrf-token': csrfToken,
            'x-restli-protocol-version': '2.0.0'
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.included) {
            for (const entity of data.included) {
              if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
                return entity.entityUrn;
              }
            }
          }
        }
        throw new Error('Could not get profile URN');
      };

      const profileUrn = await getProfileUrn();
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

      const response = await fetch('https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage', {
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
            timezoneOffset: 5,
            timezone: 'Asia/Karachi',
            deviceFormFactor: 'DESKTOP',
            mpName: 'voyager-web',
            displayDensity: 2,
            displayWidth: 2940,
            displayHeight: 1912
          }),
          'x-restli-protocol-version': '2.0.0'
        },
        body: JSON.stringify(body),
        credentials: 'include'
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
        messageId: data?.value?.createdEventUrn || null
      };
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

  // Ping request to check if content script is loaded
  if (message.type === 'PING') {
    sendResponse({
      success: true,
      message: 'Content script is ready',
      queueAvailable: typeof window.QueueProcessor !== 'undefined',
      executorAvailable: typeof window.ActionExecutor !== 'undefined',
      isProfilePage: window.location.href.includes('linkedin.com/in/')
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
