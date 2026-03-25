/**
 * @file App.jsx - Root application component
 *
 * Bootstraps the entire frontend application:
 * - Configures TanStack React Query with global defaults for caching, retries, and stale times
 * - Wraps the app in ExtensionProvider so all components share a single Chrome extension PING
 * - Provides protected (auth-required) and public (guest-only) route guards
 * - Verifies the auth token on mount and syncs it with the Chrome extension
 *
 * The token verification uses a ref guard (verifiedTokenRef) so the /user fetch
 * only fires once per unique token value, avoiding redundant network calls on re-renders.
 */

import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { ExtensionProvider } from './hooks/useExtension';

// Pages
import Login from './pages/Login';
import LinkedInCallback from './pages/LinkedInCallback';
import ProspectsNew from './pages/ProspectsNew';
import CampaignsList from './pages/CampaignsList';
import CampaignCreate from './pages/CampaignCreate';
import CampaignDetails from './pages/CampaignDetails';
import MessageTemplates from './pages/MessageTemplates';
import Settings from './pages/Settings';
import Mail from './pages/Mail';
import Inbox from './pages/Inbox';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';
import NotFound from './pages/NotFound';

/**
 * Global React Query client configuration.
 *
 * Query defaults:
 * - refetchOnWindowFocus disabled: prevents surprise refetches when user Alt-Tabs back
 * - retry: 2 with exponential backoff (1s, 2s, capped at 10s) to handle transient failures
 * - staleTime: 30s -- data is considered fresh for 30 seconds before background refetch
 *
 * Mutation defaults:
 * - retry: 0 -- mutations are side-effects (create/update/delete) and should NOT be retried
 *   automatically, since retrying could cause duplicate actions (e.g. double-send a message)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30000,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Public Route Component
 * Redirects to dashboard if user is already authenticated
 */
const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

/**
 * Main App Component
 */
function App() {
  const { token, setUser, clearAuth } = useAuthStore();

  /**
   * Ref guard: stores the last token we verified against the /user endpoint.
   * This prevents re-verification on every render when the token hasn't actually changed.
   * Without this, React strict mode double-renders and HMR would trigger duplicate API calls.
   */
  const verifiedTokenRef = useRef(null);

  // Verify token and refresh user data -- only once per token value
  useEffect(() => {
    if (!token || verifiedTokenRef.current === token) return;
    verifiedTokenRef.current = token;

    const verifyAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData.data);
        } else {
          clearAuth();
        }
      } catch (error) {
        console.error('[App] Failed to verify auth:', error);
      }
    };

    verifyAuth();
  }, [token]); // Run whenever token changes

  return (
    <QueryClientProvider client={queryClient}>
      <ExtensionProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/callback"
            element={<LinkedInCallback />}
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/prospects"
            element={
              <ProtectedRoute>
                <ProspectsNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign/list"
            element={
              <ProtectedRoute>
                <CampaignsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign/create"
            element={
              <ProtectedRoute>
                <CampaignCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign/:id"
            element={
              <ProtectedRoute>
                <CampaignDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign/templates"
            element={
              <ProtectedRoute>
                <MessageTemplates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mail"
            element={
              <ProtectedRoute>
                <Mail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Default Route - redirect to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ExtensionProvider>
    </QueryClientProvider>
  );
}

export default App;
