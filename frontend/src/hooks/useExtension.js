/**
 * @file useExtension.js - Chrome extension communication hook
 *
 * Provides a React context + hook pattern for communicating with the
 * LinkedIn Automation Chrome extension via chrome.runtime.sendMessage.
 *
 * Architecture:
 * - ExtensionProvider: mounted once at the app root (in App.jsx), sends a single PING
 *   to detect whether the extension is installed and responding. This avoids every
 *   component that calls useExtension() from firing its own PING.
 * - useExtension(): reads connection state from context and provides command functions
 *   (syncInbox, sendLinkedInMessage, startCampaignQueue, etc.)
 *
 * Extension communication protocol:
 * - All messages are sent via chrome.runtime.sendMessage(extensionId, { type, ...data })
 * - The extension responds via the callback (not postMessage), ensuring request-response pairing
 * - If the extension is not installed, chrome.runtime.lastError is set
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

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
 * Send a message to the Chrome extension using external messaging.
 *
 * This is the low-level transport function. Higher-level commands (syncInbox, sendLinkedInMessage, etc.)
 * are built on top of this. The message type is spread into the payload so the extension's
 * onMessageExternal handler receives { type: 'SYNC_INBOX', limit: 50, ... } as a flat object.
 *
 * @param {string} type - Message type identifier (e.g., 'PING', 'SYNC_INBOX', 'SEND_LINKEDIN_MESSAGE')
 * @param {object} data - Additional payload fields to include
 * @returns {Promise<object>} The response object from the extension's callback
 */
const sendMessage = (type, data = {}) => {
  return new Promise((resolve, reject) => {
    const extensionId = getExtensionId();

    if (!extensionId) {
      reject(new Error('Extension not found. Please make sure the extension is installed and active.'));
      return;
    }

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

// Context — holds extension connection state (initialized once)
const ExtensionContext = createContext(null);

/**
 * Provider that initializes extension connection once.
 * Wrap your app with this so all useExtension() calls share one PING.
 */
export const ExtensionProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Check extension connectivity with a single PING -- runs exactly once on mount
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

  return (
    <ExtensionContext.Provider value={{ isConnected, isChecking, lastSyncTime, setLastSyncTime }}>
      {children}
    </ExtensionContext.Provider>
  );
};

/**
 * Hook to interact with the LinkedIn Automation extension.
 * Reads connection state from ExtensionProvider (single PING).
 */
export const useExtension = () => {
  const context = useContext(ExtensionContext);

  // Fallback if used outside provider (shouldn't happen, but safe)
  const isConnected = context?.isConnected ?? false;
  const isChecking = context?.isChecking ?? true;
  const lastSyncTime = context?.lastSyncTime ?? null;
  const setLastSyncTime = context?.setLastSyncTime ?? (() => {});

  /**
   * Trigger inbox sync with extension
   */
  const triggerSync = useCallback(async (type, data = {}) => {
    if (!isConnected) {
      throw new Error('Extension not connected. Please refresh and ensure the extension is active.');
    }

    return sendMessage(type, data);
  }, [isConnected]);

  /**
   * Trigger inbox sync specifically
   */
  const syncInbox = useCallback(async (options = {}) => {
    const result = await triggerSync('SYNC_INBOX', {
      limit: options.limit || 50,
      includeMessages: options.includeMessages || false,
    });
    setLastSyncTime(Date.now());
    return result;
  }, [triggerSync, setLastSyncTime]);

  /**
   * Send a message through the extension
   */
  const sendLinkedInMessage = useCallback(async (linkedinConversationId, content, messageId) => {
    return triggerSync('SEND_LINKEDIN_MESSAGE', {
      linkedinConversationId,
      content,
      messageId,
    });
  }, [triggerSync]);

  /** Get the current campaign action queue status from the extension */
  const getQueueStatus = useCallback(async () => {
    return sendMessage('GET_QUEUE_STATUS');
  }, []);

  /** Tell the extension to start processing pending campaign actions (opens LinkedIn if needed) */
  const startCampaignQueue = useCallback(async () => {
    return sendMessage('START_CAMPAIGN_QUEUE');
  }, []);

  /** Tell the extension to stop processing the campaign queue */
  const stopCampaignQueue = useCallback(async (reason = 'User stopped') => {
    return sendMessage('STOP_CAMPAIGN_QUEUE', { reason });
  }, []);

  /** Open a specific LinkedIn conversation in a new tab via the extension */
  const openConversation = useCallback(async (conversationId) => {
    return sendMessage('OPEN_CONVERSATION', { conversationId });
  }, []);

  /** Check if the user is currently logged into LinkedIn (extension checks cookies/session) */
  const checkLinkedInLogin = useCallback(async () => {
    try {
      const response = await sendMessage('CHECK_LINKEDIN_LOGIN');
      return response?.isLoggedIn || false;
    } catch {
      return false;
    }
  }, []);

  /**
   * Sync messages for a specific conversation by having the extension scrape them from LinkedIn.
   * The extension navigates to the conversation, extracts messages, and POSTs them to the backend.
   */
  const syncConversationMessages = useCallback(async (linkedinConversationId, backendConversationId) => {
    return sendMessage('SYNC_CONVERSATION_MESSAGES', {
      conversationId: linkedinConversationId,
      backendConversationId,
    });
  }, []);

  /**
   * Lightweight new-message check used by the Sidebar for the unread badge.
   * Returns { hasNewMessages, count, timestamp } without doing a full inbox sync.
   * Silently returns defaults on error so the UI never breaks.
   */
  const checkNewMessages = useCallback(async () => {
    try {
      const response = await sendMessage('GET_NEW_MESSAGES_STATUS');
      return {
        hasNewMessages: response?.hasNewMessages || false,
        count: response?.count || 0,
        timestamp: response?.timestamp || 0,
      };
    } catch {
      return { hasNewMessages: false, count: 0, timestamp: 0 };
    }
  }, []);

  /**
   * Quick inbox sync: a faster, lighter sync that only grabs new/changed conversations.
   * Used on Inbox page load to get latest data without a full re-scrape.
   */
  const quickSyncInbox = useCallback(async () => {
    try {
      return await sendMessage('QUICK_SYNC_INBOX');
    } catch {
      return { success: false };
    }
  }, []);

  /** Get the extension's auto-sync status (last sync timestamp, whether auto-sync is active) */
  const getSyncStatus = useCallback(async () => {
    try {
      return await sendMessage('GET_SYNC_STATUS');
    } catch {
      return { success: false, lastSync: 0, isAutoSyncActive: false };
    }
  }, []);

  return {
    isConnected,
    isChecking,
    lastSyncTime,
    triggerSync,
    syncInbox,
    sendLinkedInMessage,
    getQueueStatus,
    startCampaignQueue,
    stopCampaignQueue,
    openConversation,
    checkLinkedInLogin,
    syncConversationMessages,
    checkNewMessages,
    quickSyncInbox,
    getSyncStatus,
  };
};

export default useExtension;
