/**
 * Connections Page Selector Tests
 *
 * Tests selectors on LinkedIn connections page.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  printResults,
  waitForLinkedInLoad
} = require('./test-helpers');

const TEST_CONNECTIONS_URL = '/mynetwork/invite-connect/connections/';

test.describe('Connections Page Selectors', () => {
  let allResults = [];

  test.beforeAll(async () => {
    console.log('\n📝 Testing Connections Page Selectors');
    console.log(`   URL: ${TEST_CONNECTIONS_URL}\n`);
  });

  test.afterAll(async () => {
    printResults(allResults, 'CONNECTIONS PAGE SELECTORS');
  });

  test('Navigate to connections page', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const isConnections = await page.evaluate(() => {
      return window.location.pathname.includes('/connections');
    });
    expect(isConnections).toBe(true);
  });

  test('CONNECTIONS.CONTAINER selector', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.CONTAINER,
      'CONNECTIONS.CONTAINER'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Connections container: ${result.count} found`);
  });

  test('CONNECTIONS.CONNECTION_CARD_LINK selector (New UI)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.CONNECTION_CARD_LINK,
      'CONNECTIONS.CONNECTION_CARD_LINK'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Connection card links (new UI): ${result.count} found`);
  });

  test('CONNECTIONS.CARD_PROFILE_IMAGE selector (New UI)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.CARD_PROFILE_IMAGE,
      'CONNECTIONS.CARD_PROFILE_IMAGE'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Profile images (new UI): ${result.count} found`);
  });

  test('CONNECTIONS.CARD_NAME_LINK selector (New UI)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.CARD_NAME_LINK,
      'CONNECTIONS.CARD_NAME_LINK'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Name links (new UI): ${result.count} found`);
  });

  test('CONNECTIONS.CONNECTION_CARD selector (Legacy)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.CONNECTION_CARD,
      'CONNECTIONS.CONNECTION_CARD'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Connection cards (legacy): ${result.count} found`);
  });

  test('CONNECTIONS.PROFILE_LINK selector (Legacy)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.PROFILE_LINK,
      'CONNECTIONS.PROFILE_LINK'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Profile links (legacy): ${result.count} found`);
  });

  test('CONNECTIONS.NAME selector (Legacy)', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.NAME,
      'CONNECTIONS.NAME'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Names (legacy): ${result.count} found`);
  });

  test('CONNECTIONS.LOAD_MORE_BUTTON selector', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    // Scroll down to trigger load more button
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.LOAD_MORE_BUTTON,
      'CONNECTIONS.LOAD_MORE_BUTTON'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Load more button: ${result.count} found`);
  });

  test('CONNECTIONS.ALT_PROFILE_LINK selector', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.CONNECTIONS.ALT_PROFILE_LINK,
      'CONNECTIONS.ALT_PROFILE_LINK'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Profile links (alt): ${result.count} found`);
  });
});

test.describe('Connections - Extract Data', () => {
  test('Extract connection data', async ({ page }) => {
    await page.goto(TEST_CONNECTIONS_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const connections = await page.evaluate((selectors) => {
      const extracted = [];

      // Try new UI first
      let cards = document.querySelectorAll(selectors.CONNECTION_CARD_LINK);

      if (cards.length > 0) {
        // New UI
        cards.forEach((card, index) => {
          if (index >= 5) return;

          const nameEl = card.querySelector('p a');
          const imgEl = card.querySelector('img');

          extracted.push({
            ui: 'new',
            name: nameEl?.textContent?.trim() || null,
            profileUrl: card.href || null,
            imageUrl: imgEl?.src || null
          });
        });
      } else {
        // Try legacy UI
        cards = document.querySelectorAll(selectors.CONNECTION_CARD);
        cards.forEach((card, index) => {
          if (index >= 5) return;

          const nameEl = card.querySelector(selectors.NAME);
          const linkEl = card.querySelector(selectors.PROFILE_LINK);
          const imgEl = card.querySelector(selectors.PROFILE_IMAGE);

          extracted.push({
            ui: 'legacy',
            name: nameEl?.textContent?.trim() || null,
            profileUrl: linkEl?.href || null,
            imageUrl: imgEl?.src || null
          });
        });
      }

      return extracted;
    }, SELECTORS.CONNECTIONS);

    console.log('\n  📊 Extracted Connection Data:');
    if (connections.length > 0) {
      console.log(`  UI Version: ${connections[0].ui}`);
    }
    connections.forEach((conn, i) => {
      console.log(`\n  Connection ${i + 1}:`);
      console.log(`    Name: ${conn.name || '❌ Not found'}`);
      console.log(`    URL: ${conn.profileUrl ? '✅ Found' : '❌ Not found'}`);
      console.log(`    Image: ${conn.imageUrl ? '✅ Found' : '❌ Not found'}`);
    });

    // Should have extracted some data
    const hasData = connections.some(c => c.name);
    if (!hasData && connections.length === 0) {
      console.log('\n  ⚠️  No connections found or selectors need updating');
    }
  });
});
