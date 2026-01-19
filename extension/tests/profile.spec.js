/**
 * Profile Page Selector Tests
 *
 * Tests selectors on LinkedIn profile pages (/in/username).
 * Requires a valid profile URL to test against.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  testSelectorGroup,
  printResults,
  waitForLinkedInLoad
} = require('./test-helpers');

// Test profile URL - change this to a valid LinkedIn profile
const TEST_PROFILE_URL = '/in/williamhgates'; // Bill Gates - public profile

test.describe('Profile Page Selectors', () => {
  let allResults = [];

  test.beforeAll(async ({ browser }) => {
    console.log('\n📝 Testing Profile Page Selectors');
    console.log(`   URL: ${TEST_PROFILE_URL}\n`);
  });

  test.afterAll(async () => {
    printResults(allResults, 'PROFILE PAGE SELECTORS');
  });

  test('Navigate to profile page', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    // Verify we're on a profile page
    const isProfile = await page.evaluate(() => {
      return window.location.pathname.includes('/in/');
    });
    expect(isProfile).toBe(true);
  });

  test('PROFILE.ACTION_CONTAINER selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.ACTION_CONTAINER,
      'PROFILE.ACTION_CONTAINER'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Action container: ${result.count} found`);
  });

  test('PROFILE.ACTION_BUTTON_CHECK selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.ACTION_BUTTON_CHECK,
      'PROFILE.ACTION_BUTTON_CHECK'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Action buttons: ${result.count} found`);
  });

  test('PROFILE.CONNECT_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.CONNECT_BUTTON,
      'PROFILE.CONNECT_BUTTON'
    );
    allResults.push(result);

    // Note: Connect button may not be visible if already connected
    if (!result.found) {
      console.log('  ℹ️  Connect button not found (may already be connected)');
    }
  });

  test('PROFILE.MESSAGE_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.MESSAGE_BUTTON,
      'PROFILE.MESSAGE_BUTTON'
    );
    allResults.push(result);
  });

  test('PROFILE.MORE_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.MORE_BUTTON,
      'PROFILE.MORE_BUTTON'
    );
    allResults.push(result);
  });

  test('PROFILE.FOLLOW_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.FOLLOW_BUTTON,
      'PROFILE.FOLLOW_BUTTON'
    );
    allResults.push(result);
  });

  test('PROFILE.PENDING_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.PROFILE.PENDING_BUTTON,
      'PROFILE.PENDING_BUTTON'
    );
    allResults.push(result);

    // Pending is expected to not be found on most profiles
    if (!result.found) {
      console.log('  ℹ️  Pending button not found (expected if no pending request)');
    }
  });

  test('CONTACT_INFO.OPENER selector', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.CONTACT_INFO.OPENER,
      'CONTACT_INFO.OPENER'
    );
    allResults.push(result);
  });
});

test.describe('Profile Dropdown Selectors', () => {
  test('PROFILE.DROPDOWN selectors (after clicking More)', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    // Click the More button to open dropdown
    const moreButton = await page.$(SELECTORS.PROFILE.MORE_BUTTON);
    if (moreButton) {
      await moreButton.click();
      await page.waitForTimeout(1000);

      // Test dropdown selectors
      const dropdownConnect = await testSelector(
        page,
        SELECTORS.PROFILE.DROPDOWN_CONNECT,
        'PROFILE.DROPDOWN_CONNECT'
      );
      console.log(`  ${dropdownConnect.found ? '✅' : '❌'} Dropdown Connect: ${dropdownConnect.count} found`);

      const dropdownFollow = await testSelector(
        page,
        SELECTORS.PROFILE.DROPDOWN_FOLLOW,
        'PROFILE.DROPDOWN_FOLLOW'
      );
      console.log(`  ${dropdownFollow.found ? '✅' : '❌'} Dropdown Follow: ${dropdownFollow.count} found`);
    } else {
      console.log('  ⚠️  More button not found, skipping dropdown tests');
    }
  });
});

test.describe('Contact Info Modal Selectors', () => {
  test('Contact info modal selectors', async ({ page }) => {
    await page.goto(TEST_PROFILE_URL);
    await waitForLinkedInLoad(page);

    // Try to open contact info modal
    const opener = await page.$(SELECTORS.CONTACT_INFO.OPENER);
    if (opener) {
      await opener.click();
      await page.waitForTimeout(1500);

      // Test modal selectors
      const modal = await testSelector(page, SELECTORS.CONTACT_INFO.MODAL, 'CONTACT_INFO.MODAL');
      console.log(`  ${modal.found ? '✅' : '❌'} Modal: ${modal.count} found`);

      const closeBtn = await testSelector(page, SELECTORS.CONTACT_INFO.CLOSE_BUTTON, 'CONTACT_INFO.CLOSE_BUTTON');
      console.log(`  ${closeBtn.found ? '✅' : '❌'} Close button: ${closeBtn.count} found`);

      const emailSection = await testSelector(page, SELECTORS.CONTACT_INFO.EMAIL_SECTION, 'CONTACT_INFO.EMAIL_SECTION');
      console.log(`  ${emailSection.found ? '✅' : '❌'} Email section: ${emailSection.count} found`);

      const emailLink = await testSelector(page, SELECTORS.CONTACT_INFO.EMAIL_LINK, 'CONTACT_INFO.EMAIL_LINK');
      console.log(`  ${emailLink.found ? '✅' : '❌'} Email link: ${emailLink.count} found`);

      // Close modal
      if (closeBtn.found) {
        await page.click(SELECTORS.CONTACT_INFO.CLOSE_BUTTON);
      }
    } else {
      console.log('  ⚠️  Contact info opener not found on this profile');
    }
  });
});
