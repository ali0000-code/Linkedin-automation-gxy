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
