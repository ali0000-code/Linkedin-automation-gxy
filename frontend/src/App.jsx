/**
 * Main App Component
 *
 * Sets up React Query, routing, and protected routes.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

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
import ComingSoon from './pages/ComingSoon';
import NotFound from './pages/NotFound';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
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
 * Redirects to prospects if user is already authenticated
 */
const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/prospects" replace />;
  }

  return children;
};

/**
 * Main App Component
 */
function App() {
  const { token, setUser, clearAuth, syncWithExtension } = useAuthStore();

  // Verify token and refresh user data on app mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          console.log('[App] Verifying auth and fetching fresh user data...');
          // Fetch fresh user data with the stored token
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            console.log('[App] Fresh user data fetched:', userData.data);
            // Update user data in store
            setUser(userData.data);
          } else {
            console.error('[App] Token is invalid, clearing auth');
            // Token is invalid, clear auth
            clearAuth();
          }
        } catch (error) {
          console.error('[App] Failed to verify auth:', error);
          // On network error, keep existing auth state
        }
      }
    };

    verifyAuth();
  }, [token]); // Run whenever token changes

  // Sync with extension when it becomes ready
  useEffect(() => {
    if (!token) return;

    // Try to sync immediately (extension may already be ready)
    syncWithExtension();

    // Listen for extension-ready event (fired by webapp-connector.js)
    const handleExtensionReady = () => {
      console.log('[App] Extension ready event received, syncing...');
      syncWithExtension();
    };

    window.addEventListener('linkedin-automation-extension-ready', handleExtensionReady);

    return () => {
      window.removeEventListener('linkedin-automation-extension-ready', handleExtensionReady);
    };
  }, [token, syncWithExtension]);

  return (
    <QueryClientProvider client={queryClient}>
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
                <ComingSoon title="Home Dashboard" description="Your personalized dashboard is coming soon!" />
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
            path="/pricing"
            element={
              <ProtectedRoute>
                <ComingSoon title="Pricing" description="Pricing and subscription management coming soon." />
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

          {/* Default Route - redirect to prospects */}
          <Route path="/" element={<Navigate to="/prospects" replace />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
