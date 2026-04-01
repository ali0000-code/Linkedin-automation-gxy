/**
 * Login Page (OAuth Version)
 *
 * Redirects user to LinkedIn OAuth for authentication.
 * No email/password form - authentication is handled by LinkedIn.
 */

import Button from '../components/common/Button';

const Login = () => {
  /**
   * Redirect to backend OAuth endpoint
   * Backend will redirect to LinkedIn for authentication
   */
  const handleLinkedInLogin = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    window.location.href = `${backendUrl}/api/auth/linkedin`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            LinkedIn Automation
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with your LinkedIn account
          </p>
        </div>

        {/* OAuth Login Card */}
        <div className="bg-white p-8 rounded-lg shadow">
          {/* LinkedIn Logo and Info */}
          <div className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <svg
                className="h-12 w-12 text-[#0077B5]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
            <p className="text-center text-sm text-gray-600">
              We use LinkedIn OAuth to securely authenticate your account.
              Your credentials are never stored on our servers.
            </p>
          </div>

          {/* Sign in with LinkedIn Button */}
          <Button
            type="button"
            variant="primary"
            className="w-full bg-[#0077B5] hover:bg-[#006097] flex items-center justify-center"
            onClick={handleLinkedInLogin}
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Sign in with LinkedIn
          </Button>

          {/* Info Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to connect your LinkedIn account to this automation platform.
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            What happens next?
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• You'll be redirected to LinkedIn to authorize access</li>
            <li>• We'll securely receive your profile information</li>
            <li>• Your account will be created automatically</li>
            <li>• You'll be redirected back to start managing prospects</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
