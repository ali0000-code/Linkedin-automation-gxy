/**
 * Extension Communication Service
 *
 * Handles communication between the webapp and the Chrome extension.
 * Uses chrome.runtime.sendMessage for external messaging.
 */

// Storage key for extension ID
const EXTENSION_ID_KEY = 'linkedin_automation_extension_id';

/**
 * Get the extension ID from storage or window
 * @returns {string|null}
 */
function getExtensionId() {
  // First check localStorage (set by webapp-connector.js)
  const stored = localStorage.getItem(EXTENSION_ID_KEY);
  if (stored) {
    return stored;
  }

  // Check if injected by content script
  if (window.__LINKEDIN_AUTOMATION_EXTENSION_ID__) {
    localStorage.setItem(EXTENSION_ID_KEY, window.__LINKEDIN_AUTOMATION_EXTENSION_ID__);
    return window.__LINKEDIN_AUTOMATION_EXTENSION_ID__;
  }

  return null;
}

/**
 * Prompt user to enter extension ID manually
 * @returns {string|null}
 */
function promptForExtensionId() {
  const id = prompt(
    'Extension ID not detected automatically.\n\n' +
    'To find your extension ID:\n' +
    '1. Go to chrome://extensions\n' +
    '2. Find "LinkedIn Automation"\n' +
    '3. Copy the ID (looks like: abcdefghijklmnop...)\n\n' +
    'Paste the extension ID here:'
  );

  if (id && id.trim()) {
    const trimmedId = id.trim();
    localStorage.setItem(EXTENSION_ID_KEY, trimmedId);
    return trimmedId;
  }

  return null;
}

/**
 * Check if the extension is installed and available
 * @returns {Promise<{installed: boolean, extensionId?: string}>}
 */
export async function isExtensionInstalled() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[Extension] Chrome runtime not available');
    return { installed: false };
  }

  const extensionId = getExtensionId();
  if (!extensionId) {
    console.log('[Extension] Extension ID not configured');
    return { installed: false, needsConfig: true };
  }

  try {
    const response = await sendMessageToExtension({ type: 'PING' });
    if (response && response.success) {
      return { installed: true, extensionId };
    }
    return { installed: false };
  } catch (error) {
    console.log('[Extension] Extension not responding:', error.message);
    return { installed: false };
  }
}

/**
 * Send a message to the extension
 * @param {object} message - Message to send
 * @param {boolean} allowPrompt - Allow prompting user for extension ID
 * @returns {Promise<object>} Response from extension
 */
export async function sendMessageToExtension(message, allowPrompt = true) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      reject(new Error('Chrome extension API not available. Please use Chrome browser.'));
      return;
    }

    let extensionId = getExtensionId();

    // If no extension ID and prompting is allowed, ask user
    if (!extensionId && allowPrompt) {
      extensionId = promptForExtensionId();
    }

    if (!extensionId) {
      reject(new Error('Extension ID not configured. Please refresh the page or enter the extension ID manually.'));
      return;
    }

    try {
      chrome.runtime.sendMessage(extensionId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Check if it's a connection error
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Could not establish connection')) {
            // Clear the stored ID since it's invalid
            localStorage.removeItem(EXTENSION_ID_KEY);
            reject(new Error('Extension not found. Please check that the extension is installed and try again.'));
          } else {
            reject(new Error(errorMsg));
          }
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Start the campaign queue in the extension
 * Opens LinkedIn if needed and starts processing actions
 * @returns {Promise<object>}
 */
export async function startCampaignQueue() {
  console.log('[Extension] Starting campaign queue...');

  try {
    const response = await sendMessageToExtension({
      type: 'START_CAMPAIGN_QUEUE'
    });

    console.log('[Extension] Start queue response:', response);
    return response;
  } catch (error) {
    console.error('[Extension] Failed to start queue:', error);
    throw error;
  }
}

/**
 * Stop the campaign queue in the extension
 * @param {string} reason - Reason for stopping
 * @returns {Promise<object>}
 */
export async function stopCampaignQueue(reason = 'User stopped from webapp') {
  console.log('[Extension] Stopping campaign queue...');

  try {
    const response = await sendMessageToExtension({
      type: 'STOP_CAMPAIGN_QUEUE',
      reason
    });

    console.log('[Extension] Stop queue response:', response);
    return response;
  } catch (error) {
    console.error('[Extension] Failed to stop queue:', error);
    throw error;
  }
}

/**
 * Get queue status from extension
 * @returns {Promise<object>}
 */
export async function getQueueStatus() {
  try {
    const response = await sendMessageToExtension({
      type: 'GET_QUEUE_STATUS'
    });
    return response;
  } catch (error) {
    console.error('[Extension] Failed to get queue status:', error);
    throw error;
  }
}

/**
 * Set the extension ID (call this after finding the extension ID)
 * @param {string} extensionId
 */
export function setExtensionId(extensionId) {
  localStorage.setItem('linkedin_automation_extension_id', extensionId);
}

export default {
  isExtensionInstalled,
  sendMessageToExtension,
  startCampaignQueue,
  stopCampaignQueue,
  getQueueStatus,
  setExtensionId
};
