/**
 * Authentication Store (Zustand)
 *
 * Global state management for user authentication.
 * Persists token to localStorage automatically.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Sync authentication token with Chrome extension
 * @param {string} token - Auth token to send
 * @returns {Promise<boolean>} True if sync successful
 */
const syncTokenWithExtension = async (token) => {
  if (!token) {
    console.log('[Auth] No token to sync');
    return false;
  }

  // Get extension ID from multiple sources
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
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
