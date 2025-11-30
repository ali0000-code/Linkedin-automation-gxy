/**
 * Authentication Service
 *
 * Manages authentication state and user session.
 * Handles login, logout, and token validation.
 */

/**
 * Check if user is authenticated
 * Verifies token exists and is still valid by calling /user endpoint
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
async function isAuthenticated() {
  const token = await getAuthToken();

  // No token means not authenticated
  if (!token) {
    return false;
  }

  // Verify token is still valid with backend
  try {
    await getUser();
    return true;
  } catch (error) {
    // Token is invalid or expired
    await clearAuth();
    return false;
  }
}

/**
 * Handle user login
 * Authenticates with backend and stores token locally
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} User object from backend
 * @throws {Error} If login fails
 */
async function handleLogin(email, password) {
  try {
    // Call backend login endpoint
    const response = await login(email, password);

    // Store token and email
    await setAuthToken(response.token);
    await setUserEmail(email);

    return response.user;
  } catch (error) {
    // Re-throw with user-friendly message
    throw new Error(error.message || 'Login failed');
  }
}

/**
 * Handle user logout
 * Revokes token on backend and clears local storage
 * @returns {Promise<void>}
 */
async function handleLogout() {
  try {
    // Try to revoke token on backend
    await logout();
  } catch (error) {
    // Even if API call fails, clear local data
    console.error('Logout API call failed:', error);
  } finally {
    // Always clear local auth data
    await clearAuth();
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<object|null>} User object or null if not authenticated
 */
async function getCurrentUser() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return null;
  }

  try {
    const response = await getUser();
    return response.data || response; // Handle both {data: user} and direct user response
  } catch (error) {
    return null;
  }
}

/**
 * Get stored user email
 * @returns {Promise<string|null>} User email or null
 */
async function getStoredUserEmail() {
  return await getUserEmail();
}
