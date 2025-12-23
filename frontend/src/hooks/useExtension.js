/**
 * Extension Hook
 *
 * Provides communication with the LinkedIn Automation Chrome extension.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Get the extension ID from localStorage or window
 * @returns {string|null} Extension ID
 */
const getExtensionId = () => {
  // Try window first (set immediately by webapp-connector.js)
  if (window.__LINKEDIN_AUTOMATION_EXTENSION_ID__) {
    return window.__LINKEDIN_AUTOMATION_EXTENSION_ID__;
  }
  // Fall back to localStorage
  return localStorage.getItem('linkedin_automation_extension_id');
};

/**
 * Send a message to the Chrome extension
 * @param {string} type - Message type
 * @param {object} data - Message data
 * @returns {Promise<object>} Response from extension
 */
const sendMessage = (type, data = {}) => {
  return new Promise((resolve, reject) => {
    const extensionId = getExtensionId();

    if (!extensionId) {
      reject(new Error('Extension not found. Please make sure the extension is installed and active.'));
      return;
    }

    // Check if chrome.runtime is available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Chrome runtime not available. Please use Chrome browser.'));
      return;
    }

    try {
      chrome.runtime.sendMessage(
        extensionId,
        { type, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response?.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Hook to interact with the LinkedIn Automation extension
 */
export const useExtension = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if extension is available
  useEffect(() => {
    const checkExtension = async () => {
      setIsChecking(true);
      try {
        const response = await sendMessage('PING');
        setIsConnected(response?.success === true);
      } catch (error) {
        console.log('[useExtension] Extension not connected:', error.message);
        setIsConnected(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkExtension();

    // Listen for extension ready event
    const handleExtensionReady = () => {
      console.log('[useExtension] Extension ready');
      setIsConnected(true);
    };

    window.addEventListener('linkedin-automation-extension-ready', handleExtensionReady);

    return () => {
      window.removeEventListener('linkedin-automation-extension-ready', handleExtensionReady);
    };
  }, []);

  /**
   * Trigger inbox sync with extension
   * @param {string} type - Sync type (SYNC_INBOX, SYNC_CONVERSATION_MESSAGES, etc.)
   * @param {object} data - Additional data
   * @returns {Promise<object>} Sync result
   */
  const triggerSync = useCallback(async (type, data = {}) => {
    if (!isConnected) {
      throw new Error('Extension not connected. Please refresh and ensure the extension is active.');
    }

    return sendMessage(type, data);
  }, [isConnected]);

  /**
   * Trigger inbox sync specifically
   * @param {object} options - Sync options
   * @returns {Promise<object>} Sync result
   */
  const syncInbox = useCallback(async (options = {}) => {
    return triggerSync('SYNC_INBOX', {
      limit: options.limit || 50,
      includeMessages: options.includeMessages || false,
    });
  }, [triggerSync]);

  /**
   * Send a message through the extension
   * @param {string} linkedinConversationId - LinkedIn conversation ID
   * @param {string} content - Message content
   * @param {number} messageId - Backend message ID (for tracking)
   * @returns {Promise<object>} Send result
   */
  const sendLinkedInMessage = useCallback(async (linkedinConversationId, content, messageId) => {
    return triggerSync('SEND_LINKEDIN_MESSAGE', {
      linkedinConversationId,
      content,
      messageId,
    });
  }, [triggerSync]);

  /**
   * Get queue status from extension
   * @returns {Promise<object>} Queue status
   */
  const getQueueStatus = useCallback(async () => {
    return sendMessage('GET_QUEUE_STATUS');
  }, []);

  /**
   * Start campaign queue
   * @returns {Promise<object>} Result
   */
  const startCampaignQueue = useCallback(async () => {
    return sendMessage('START_CAMPAIGN_QUEUE');
  }, []);

  /**
   * Stop campaign queue
   * @param {string} reason - Reason for stopping
   * @returns {Promise<object>} Result
   */
  const stopCampaignQueue = useCallback(async (reason = 'User stopped') => {
    return sendMessage('STOP_CAMPAIGN_QUEUE', { reason });
  }, []);

  /**
   * Open a conversation on LinkedIn (pre-load for faster sending)
   * Note: With API mode, this is a no-op but kept for compatibility
   * @param {string} conversationId - LinkedIn conversation ID
   * @returns {Promise<object>} Result
   */
  const openConversation = useCallback(async (conversationId) => {
    return sendMessage('OPEN_CONVERSATION', { conversationId });
  }, []);

  /**
   * Check if user is logged into LinkedIn
   * @returns {Promise<boolean>} Login status
   */
  const checkLinkedInLogin = useCallback(async () => {
    try {
      const response = await sendMessage('CHECK_LINKEDIN_LOGIN');
      return response?.isLoggedIn || false;
    } catch {
      return false;
    }
  }, []);

  /**
   * Sync messages for a specific conversation
   * @param {string} linkedinConversationId - LinkedIn conversation ID
   * @param {number} backendConversationId - Backend conversation ID
   * @returns {Promise<object>} Result
   */
  const syncConversationMessages = useCallback(async (linkedinConversationId, backendConversationId) => {
    return sendMessage('SYNC_CONVERSATION_MESSAGES', {
      conversationId: linkedinConversationId,
      backendConversationId,
    });
  }, []);

  return {
    isConnected,
    isChecking,
    triggerSync,
    syncInbox,
    sendLinkedInMessage,
    getQueueStatus,
    startCampaignQueue,
    stopCampaignQueue,
    openConversation,
    checkLinkedInLogin,
    syncConversationMessages,
  };
};

export default useExtension;
