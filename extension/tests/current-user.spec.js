/**
 * Current User Detection Selector Tests
 *
 * Tests selectors for detecting the logged-in user.
 * These work on any LinkedIn page when logged in.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  printResults,
  waitForLinkedInLoad
} = require('./test-helpers');

test.describe('Current User Detection Selectors', () => {
  let allResults = [];

  test.beforeAll(async () => {
    console.log('\n📝 Testing Current User Detection Selectors\n');
  });

  test.afterAll(async () => {
    printResults(allResults, 'CURRENT USER SELECTORS');
  });

  test('CURRENT_USER.ME_BUTTON selector', async ({ page }) => {
    await page.goto('/feed/');
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.CURRENT_USER.ME_BUTTON,
      'CURRENT_USER.ME_BUTTON'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Me button: ${result.count} found`);
  });

  test('CURRENT_USER.ME_BUTTON_ALT selector', async ({ page }) => {
    await page.goto('/feed/');
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.CURRENT_USER.ME_BUTTON_ALT,
      'CURRENT_USER.ME_BUTTON_ALT'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Me button (alt): ${result.count} found`);
  });

  test('CURRENT_USER.FEED_PROFILE selector', async ({ page }) => {
    await page.goto('/feed/');
    await waitForLinkedInLoad(page);

    const result = await testSelector(
      page,
      SELECTORS.CURRENT_USER.FEED_PROFILE,
      'CURRENT_USER.FEED_PROFILE'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Feed profile link: ${result.count} found`);
  });

  test('CURRENT_USER.DROPDOWN_PROFILE selector (after clicking Me)', async ({ page }) => {
    await page.goto('/feed/');
    await waitForLinkedInLoad(page);

    // Click the Me button to open dropdown
    const meButton = await page.$(SELECTORS.CURRENT_USER.ME_BUTTON) ||
                     await page.$(SELECTORS.CURRENT_USER.ME_BUTTON_ALT);

    if (meButton) {
      await meButton.click();
      await page.waitForTimeout(1000);

      const result = await testSelector(
        page,
        SELECTORS.CURRENT_USER.DROPDOWN_PROFILE,
        'CURRENT_USER.DROPDOWN_PROFILE'
      );
      allResults.push(result);
      console.log(`  ${result.found ? '✅' : '❌'} Dropdown profile link: ${result.count} found`);
    } else {
      console.log('  ⚠️  Me button not found, skipping dropdown test');
      allResults.push({
        name: 'CURRENT_USER.DROPDOWN_PROFILE',
        found: false,
        count: 0,
        status: 'SKIP',
        note: 'Me button not found'
      });
    }
  });
});

test.describe('Current User - Extract User Info', () => {
  test('Extract current user information', async ({ page }) => {
    await page.goto('/feed/');
    await waitForLinkedInLoad(page);

    // Try to get user info from feed sidebar
    const userInfo = await page.evaluate((selectors) => {
      const feedProfile = document.querySelector(selectors.FEED_PROFILE);
      if (feedProfile) {
        const href = feedProfile.href || '';
        const match = href.match(/\/in\/([^\/\?]+)/);
        return {
          source: 'feed',
          linkedinId: match ? match[1] : null,
          profileUrl: href
        };
      }

      return null;
    }, SELECTORS.CURRENT_USER);

    if (userInfo) {
      console.log('\n  📊 Extracted User Info from Feed:');
      console.log(`    LinkedIn ID: ${userInfo.linkedinId || '❌ Not found'}`);
      console.log(`    Profile URL: ${userInfo.profileUrl || '❌ Not found'}`);
    }

    // Also try from Me dropdown
    const meButton = await page.$(SELECTORS.CURRENT_USER.ME_BUTTON) ||
                     await page.$(SELECTORS.CURRENT_USER.ME_BUTTON_ALT);

    if (meButton) {
      await meButton.click();
      await page.waitForTimeout(1000);

      const dropdownInfo = await page.evaluate((selectors) => {
        const dropdownProfile = document.querySelector(selectors.DROPDOWN_PROFILE);
        if (dropdownProfile) {
          const href = dropdownProfile.href || '';
          const match = href.match(/\/in\/([^\/\?]+)/);
          const nameEl = dropdownProfile.querySelector('.t-bold') ||
                        dropdownProfile.querySelector('.artdeco-entity-lockup__title');
          return {
            source: 'dropdown',
            linkedinId: match ? match[1] : null,
            name: nameEl?.textContent?.trim() || null,
            profileUrl: href
          };
        }
        return null;
      }, SELECTORS.CURRENT_USER);

      if (dropdownInfo) {
        console.log('\n  📊 Extracted User Info from Dropdown:');
        console.log(`    Name: ${dropdownInfo.name || '❌ Not found'}`);
        console.log(`    LinkedIn ID: ${dropdownInfo.linkedinId || '❌ Not found'}`);
        console.log(`    Profile URL: ${dropdownInfo.profileUrl || '❌ Not found'}`);
      }
    }
  });
});
