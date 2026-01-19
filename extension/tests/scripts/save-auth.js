/**
 * Save LinkedIn Authentication State
 *
 * This script opens a browser, lets you log in to LinkedIn manually,
 * then saves the authentication state for use in tests.
 *
 * Usage: npm run auth:save
 */

const { chromium } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

async function saveAuth() {
  console.log('\n🔐 LinkedIn Authentication Setup\n');
  console.log('1. A browser window will open');
  console.log('2. Log in to LinkedIn manually');
  console.log('3. Once logged in, press Enter in this terminal');
  console.log('4. Your session will be saved for future tests\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Navigate to LinkedIn login
  await page.goto('https://www.linkedin.com/login');

  console.log('⏳ Waiting for you to log in...\n');
  console.log('   After logging in, press Enter here to save your session.\n');

  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Check if logged in by looking for the feed or nav
  const isLoggedIn = await page.evaluate(() => {
    return !!(
      document.querySelector('.global-nav') ||
      document.querySelector('.feed-identity-module') ||
      document.querySelector('[data-test-global-nav]')
    );
  });

  if (!isLoggedIn) {
    console.log('⚠️  Warning: You might not be fully logged in.');
    console.log('   Saving session anyway...\n');
  }

  // Save storage state
  await context.storageState({ path: AUTH_FILE });

  console.log(`✅ Authentication saved to: ${AUTH_FILE}\n`);
  console.log('You can now run tests with: npm run test:headed\n');

  await browser.close();
}

saveAuth().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
