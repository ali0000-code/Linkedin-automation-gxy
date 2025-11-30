/**
 * Background Service Worker
 *
 * Handles message routing and background tasks for the extension.
 * In Manifest V3, this runs as a service worker (event-driven, not persistent).
 */

console.log('[Background] LinkedIn Automation service worker loaded');

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
      // Note: This broadcast won't work in Manifest V3 service workers
      // Progress updates should be sent directly from content script to popup
      console.log('[Background] Progress update:', message.current, '/', message.limit);
      break;

    case 'BACKGROUND_PING':
      // Health check
      sendResponse({ success: true, message: 'Background service worker is running' });
      break;

    default:
      console.log('[Background] Unknown message type:', message.type);
  }

  return false; // Synchronous response
});

/**
 * Handle extension icon click
 * Note: This is not needed when using default_popup in manifest
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Extension icon clicked on tab:', tab.id);
  // Popup will open automatically due to default_popup in manifest
});

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
