/**
 * @file authStore.js - Zustand authentication store
 *
 * Manages global authentication state for the webapp:
 * - Token, user object, and isAuthenticated flag
 * - Automatic persistence to localStorage via Zustand's `persist` middleware
 *
 * Token is stored in BOTH Zustand persist storage (key: 'auth-storage') AND
 * a separate localStorage key ('auth_token') for the axios interceptor to read.
 * This dual-write approach keeps the interceptor decoupled from Zustand.
 *
 * The Chrome extension authenticates independently via auth key (Settings page).
 * No token is shared between webapp and extension.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      // State
      token: null,
      user: null,
      isAuthenticated: false,

      /**
       * Set authentication data (token and user)
       */
      setAuth: (token, user) => {
        localStorage.setItem('auth_token', token);
        set({ token, user, isAuthenticated: true });
      },

      /**
       * Set token only
       */
      setToken: (token) => {
        localStorage.setItem('auth_token', token);
        set({ token, isAuthenticated: true });
      },

      /**
       * Update user data
       */
      setUser: (user) => set({ user }),

      /**
       * Clear authentication data (logout)
       */
      clearAuth: () => {
        localStorage.removeItem('auth_token');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
