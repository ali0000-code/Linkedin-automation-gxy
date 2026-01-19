/**
 * Playwright Configuration for LinkedIn Selector Tests
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  testMatch: '*.spec.js',

  // Run tests sequentially (LinkedIn rate limiting)
  fullyParallel: false,
  workers: 1,

  // Retry failed tests once
  retries: 1,

  // Reporter
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Shared settings for all tests
  use: {
    // Base URL for LinkedIn
    baseURL: 'https://www.linkedin.com',

    // Use saved authentication state
    storageState: './auth.json',

    // Browser settings
    headless: false,
    viewport: { width: 1280, height: 800 },

    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Capture screenshots on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Trace on failure for debugging
    trace: 'retain-on-failure',
  },

  // Global timeout per test
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Projects for different browsers (just Chrome for LinkedIn)
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // LinkedIn works best with a real Chrome user agent
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    },
  ],
});
