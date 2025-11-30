/**
 * Content Script
 *
 * Injected into LinkedIn pages to handle extraction requests.
 * Listens for messages from popup and performs extraction using extractor service.
 *
 * NOTE: This script runs in the context of the LinkedIn page.
 * It has access to the page's DOM but not the extension's background context.
 */

console.log('[Content Script] LinkedIn Automation extension loaded');

/**
 * Listen for extraction requests from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.type);

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

  // Ping request to check if content script is loaded
  if (message.type === 'PING') {
    sendResponse({ success: true, message: 'Content script is ready' });
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
    // Check if we're on a LinkedIn search results page
    if (!isSearchResultsPage()) {
      throw new Error('Please navigate to a LinkedIn search results page first');
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
 * Check if current page is a LinkedIn search results page
 * @returns {boolean} True if on search results page
 */
function isSearchResultsPage() {
  const url = window.location.href;

  // Check if URL contains search results pattern
  const isSearchPage = url.includes('linkedin.com/search/results/people');

  if (!isSearchPage) {
    console.warn('[Content Script] Not on search results page. Current URL:', url);
  }

  return isSearchPage;
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
