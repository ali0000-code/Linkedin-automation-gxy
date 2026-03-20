import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/common/Spinner';

/**
 * LinkedInCallback Component
 *
 * Handles the OAuth callback from LinkedIn after user authorizes.
 * Extracts token from URL fragment, fetches user data, stores auth state,
 * and sends token to Chrome extension.
 */
export default function LinkedInCallback() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract token from URL fragment (#token=xxx)
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1)); // Remove # and parse
        const token = params.get('token');

        // Check for error in query string
        const queryParams = new URLSearchParams(window.location.search);
        const errorMessage = queryParams.get('error');

        if (errorMessage) {
          setError(decodeURIComponent(errorMessage));
          setIsProcessing(false);
          return;
        }

        if (!token) {
          setError('No authentication token received. Please try again.');
          setIsProcessing(false);
          return;
        }

        // Fetch user data with the token
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();

        // Store token and user data in Zustand store (this will also store in localStorage)
        setToken(token);
        setUser(userData.data);

        // Send token to Chrome extension
        // Try to get extension ID from multiple sources:
        // 1. Injected by webapp-connector.js (stored in localStorage)
        // 2. Environment variable (fallback)
        const extensionId =
          localStorage.getItem('linkedin_automation_extension_id') ||
          window.__LINKEDIN_AUTOMATION_EXTENSION_ID__ ||
          import.meta.env.VITE_EXTENSION_ID;

        if (extensionId && extensionId !== 'your_chrome_extension_id' && typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'AUTH_SUCCESS',
                token: token,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.warn('Extension not available:', chrome.runtime.lastError.message);
                } else {
                  console.log('Token sent to extension successfully');
                }
              }
            );
          } catch (err) {
            // Extension not installed or not available, continue anyway
            console.warn('Could not communicate with extension:', err);
          }
        }

        // Redirect to prospects page
        navigate('/prospects', { replace: true });

      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [navigate, setUser, setToken]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Failed
            </h3>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
        <p className="mt-2 text-sm text-gray-500">Please wait while we set up your account</p>
      </div>
    </div>
  );
}
