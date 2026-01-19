/**
 * Save LinkedIn Authentication State (Auto-detect)
 *
 * Opens browser, waits for you to log in, automatically detects
 * when logged in and saves the session.
 */

const { chromium } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

async function saveAuth() {
  console.log('\n🔐 LinkedIn Authentication Setup\n');
  console.log('1. A browser window will open');
  console.log('2. Log in to LinkedIn manually');
  console.log('3. Session will be saved automatically when logged in\n');

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

  // Wait for successful login by detecting feed or global nav
  try {
    await page.waitForSelector('.global-nav, .feed-identity-module, [data-test-global-nav]', {
      timeout: 120000 // 2 minutes to log in
    });

    // Wait a bit more for everything to settle
    await page.waitForTimeout(2000);

    // Save storage state
    await context.storageState({ path: AUTH_FILE });

    console.log(`✅ Authentication saved to: ${AUTH_FILE}\n`);
    console.log('You can now run tests with: npm run test:headed\n');

  } catch (error) {
    console.log('⚠️  Login timeout or error. Please try again.\n');
  }

  await browser.close();
  process.exit(0);
}

saveAuth().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
