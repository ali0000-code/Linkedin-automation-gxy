/**
 * @file authStore.js - Zustand authentication store
 *
 * Manages global authentication state for the webapp:
 * - Token, user object, and isAuthenticated flag
 * - Automatic persistence to localStorage via Zustand's `persist` middleware
 *   (only token, user, and isAuthenticated are persisted -- extensionSynced is session-only)
 * - Chrome extension sync: sends AUTH_SUCCESS message to the extension so it can
 *   make authenticated API calls on the user's behalf
 *
 * Token is stored in BOTH Zustand persist storage (key: 'auth-storage') AND
 * a separate localStorage key ('auth_token') for the axios interceptor to read.
 * This dual-write approach keeps the interceptor decoupled from Zustand.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sync authentication token with the Chrome extension via chrome.runtime.sendMessage.
 *
 * The extension ID can come from three sources (checked in priority order):
 * 1. localStorage -- set by the extension's webapp-connector.js content script at page load
 * 2. window global -- also set by webapp-connector.js for immediate availability
 * 3. .env variable -- fallback for development when the extension ID is known ahead of time
 *
 * Returns a Promise that always resolves (never rejects) so callers don't need try/catch.
 *
 * @param {string} token - Bearer token to send to the extension
 * @returns {Promise<boolean>} true if the extension acknowledged, false otherwise
 */
const syncTokenWithExtension = async (token) => {
  if (!token) {
    console.log('[Auth] No token to sync');
    return false;
  }

  // Try multiple sources for the extension ID -- the content script may not have injected yet
  const fromLocalStorage = localStorage.getItem('linkedin_automation_extension_id');
  const fromWindow = window.__LINKEDIN_AUTOMATION_EXTENSION_ID__;
  const fromEnv = import.meta.env?.VITE_EXTENSION_ID;

  const extensionId = fromLocalStorage || fromWindow || fromEnv;

  console.log('[Auth] Extension ID sources:', {
    localStorage: fromLocalStorage,
    window: fromWindow,
    env: fromEnv,
    using: extensionId
  });

  if (!extensionId || extensionId === 'your_chrome_extension_id') {
    console.log('[Auth] Extension ID not available');
    return false;
  }

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[Auth] Chrome runtime not available (not in Chrome browser?)');
    return false;
  }

  return new Promise((resolve) => {
    try {
      console.log('[Auth] Sending AUTH_SUCCESS to extension:', extensionId);
      chrome.runtime.sendMessage(
        extensionId,
        { type: 'AUTH_SUCCESS', token },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Auth] Extension sync failed:', chrome.runtime.lastError.message);
            console.warn('[Auth] Make sure the extension is installed and enabled');
            resolve(false);
          } else {
            console.log('[Auth] Token synced with extension successfully!', response);
            resolve(true);
          }
        }
      );
    } catch (err) {
      console.warn('[Auth] Could not sync with extension:', err);
      resolve(false);
    }
  });
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      token: null,
      user: null,
      isAuthenticated: false,
      extensionSynced: false,

      /**
       * Set authentication data (token and user)
       * @param {string} token - Auth token
       * @param {object} user - User object
       */
      setAuth: (token, user) => {
        // Store token in localStorage
        localStorage.setItem('auth_token', token);

        set({
          token,
          user,
          isAuthenticated: true
        });
      },

      /**
       * Set token only
       * @param {string} token - Auth token
       */
      setToken: (token) => {
        localStorage.setItem('auth_token', token);
        set({ token, isAuthenticated: true });
      },

      /**
       * Update user data
       * @param {object} user - Updated user object
       */
      setUser: (user) => set({ user }),

      /**
       * Clear authentication data (logout)
       */
      clearAuth: () => {
        // Remove token from localStorage
        localStorage.removeItem('auth_token');

        set({
          token: null,
          user: null,
          isAuthenticated: false,
          extensionSynced: false
        });
      },

      /**
       * Sync current token with Chrome extension
       * Call this when extension becomes available or to retry sync
       */
      syncWithExtension: async () => {
        const { token, extensionSynced } = get();
        if (!token) return false;

        // Already synced this session
        if (extensionSynced) return true;

        const success = await syncTokenWithExtension(token);
        if (success) {
          set({ extensionSynced: true });
        }
        return success;
      },
    }),
    {
      name: 'auth-storage', // localStorage key for Zustand persist middleware
      /**
       * Only persist auth-critical fields. `extensionSynced` is deliberately excluded
       * because it represents a session-level state: the extension should be re-synced
       * on each page load (handled by App.jsx), not assumed to still be connected
       * from a previous browser session.
       */
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
