/**
 * Settings Page
 *
 * Handles user settings including Gmail SMTP configuration.
 */

import { useState } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import {
  useGmailSettings,
  useSaveGmailSettings,
  useVerifyGmail,
  useDisconnectGmail,
} from '../hooks/useGmailSettings';

// Icons
const MailIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const Settings = () => {
  const { data: settings, isLoading } = useGmailSettings();
  const saveSettings = useSaveGmailSettings();
  const verifyGmail = useVerifyGmail();
  const disconnectGmail = useDisconnectGmail();

  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    // Use settings.email for updates, or the input email for new connections
    const emailToSave = settings?.connected ? settings.email : email;

    try {
      await saveSettings.mutateAsync({ email: emailToSave, app_password: appPassword });
      setMessage({ type: 'success', text: 'Gmail settings saved. Please verify the connection.' });
      setAppPassword(''); // Clear password after saving
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save Gmail settings.',
      });
    }
  };

  // Handle verification
  const handleVerify = async () => {
    setMessage(null);

    try {
      const result = await verifyGmail.mutateAsync();
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Verification failed.',
      });
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail?')) return;

    setMessage(null);

    try {
      await disconnectGmail.mutateAsync();
      setMessage({ type: 'success', text: 'Gmail disconnected successfully.' });
      setEmail('');
      setAppPassword('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to disconnect Gmail.',
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-linkedin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and integrations.</p>
        </div>

        {/* Gmail Settings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <MailIcon />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Gmail Integration</h2>
                <p className="text-sm text-gray-500">
                  Connect your Gmail account to send emails to prospects.
                </p>
              </div>
              {settings?.connected && (
                <div className="ml-auto flex items-center space-x-2">
                  {settings.is_verified ? (
                    <>
                      <CheckCircleIcon />
                      <span className="text-sm text-green-600 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon />
                      <span className="text-sm text-red-600 font-medium">Not Verified</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Status Message */}
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Instructions */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">How to set up Gmail App Password:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Enable 2-Step Verification on your Google Account</li>
                <li>
                  Go to{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Google App Passwords
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>Create a new App Password for "Mail" on "Other (Custom name)"</li>
                <li>Copy the 16-character password and paste it below</li>
              </ol>
            </div>

            {/* Connection Form */}
            {!settings?.connected ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Gmail Address"
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div className="relative">
                  <Input
                    label="App Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                <Button type="submit" loading={saveSettings.isPending}>
                  Connect Gmail
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Connected Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connected Email
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-900 bg-gray-100 px-3 py-2 rounded-lg">
                      {settings.email}
                    </span>
                    {settings.last_verified_at && (
                      <span className="text-xs text-gray-500">
                        Last verified: {new Date(settings.last_verified_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Update Password Form */}
                <form onSubmit={handleSubmit} className="pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Update App Password</h4>
                  <div className="flex space-x-3">
                    <div className="flex-1 relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New App Password"
                        value={appPassword}
                        onChange={(e) => setAppPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <Button
                      type="submit"
                      disabled={!appPassword}
                      loading={saveSettings.isPending}
                    >
                      Update
                    </Button>
                  </div>
                  <input type="hidden" value={settings.email} />
                </form>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={handleVerify}
                    loading={verifyGmail.isPending}
                  >
                    Test Connection
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDisconnect}
                    loading={disconnectGmail.isPending}
                  >
                    Disconnect Gmail
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
