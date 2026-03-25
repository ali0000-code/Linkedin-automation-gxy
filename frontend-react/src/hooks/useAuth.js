/**
 * Authentication React Query Hooks (OAuth Version)
 *
 * Custom hooks for OAuth authentication operations.
 * Login is now handled via redirect, not a mutation.
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

/**
 * LinkedIn OAuth login
 * Returns a function to redirect to LinkedIn OAuth
 * @returns {Function} Function to initiate OAuth flow
 */
export const useLinkedInLogin = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  return () => {
    window.location.href = `${backendUrl}/api/auth/linkedin`;
  };
};

/**
 * Verify LinkedIn account mutation
 * Used by extension to verify LinkedIn account linkage
 * @returns {object} Mutation object with mutate function
 */
export const useVerifyLinkedIn = () => {
  return useMutation({
    mutationFn: (linkedinId) => authService.verifyLinkedInAccount(linkedinId),
  });
};

/**
 * Logout mutation
 * Logs out from webapp and notifies extension to logout as well
 * @returns {object} Mutation object with mutate function
 */
export const useLogout = () => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear auth store
      clearAuth();

      // Notify extension to logout as well
      const extensionId = import.meta.env.VITE_EXTENSION_ID;
      if (extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          chrome.runtime.sendMessage(
            extensionId,
            { type: 'LOGOUT' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn('Extension not available:', chrome.runtime.lastError.message);
              } else {
                console.log('Logout message sent to extension');
              }
            }
          );
        } catch (err) {
          console.warn('Could not communicate with extension:', err);
        }
      }

      // Redirect to login page
      navigate('/login');
    },
    onError: () => {
      // Even if API call fails, clear local auth
      clearAuth();

      // Try to notify extension
      const extensionId = import.meta.env.VITE_EXTENSION_ID;
      if (extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          chrome.runtime.sendMessage(extensionId, { type: 'LOGOUT' });
        } catch (err) {
          console.warn('Could not communicate with extension:', err);
        }
      }

      navigate('/login');
    },
  });
};
