/**
 * Search Results Page Selector Tests
 *
 * Tests selectors on LinkedIn people search results.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  testSelectorGroup,
  printResults,
  waitForLinkedInLoad
} = require('./test-helpers');

// Test search URL
const TEST_SEARCH_URL = '/search/results/people/?keywords=software%20engineer';

test.describe('Search Results Page Selectors', () => {
  let allResults = [];

  test.beforeAll(async () => {
    console.log('\n📝 Testing Search Results Page Selectors');
    console.log(`   URL: ${TEST_SEARCH_URL}\n`);
  });

  test.afterAll(async () => {
    printResults(allResults, 'SEARCH PAGE SELECTORS');
  });

  test('Navigate to search page', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);

    // Wait for search results to load
    await page.waitForTimeout(2000);

    // Verify we're on a search page
    const isSearch = await page.evaluate(() => {
      return window.location.pathname.includes('/search/');
    });
    expect(isSearch).toBe(true);
  });

  test('SEARCH.RESULTS_CONTAINER selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.RESULTS_CONTAINER,
      'SEARCH.RESULTS_CONTAINER'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Results container: ${result.count} found`);
  });

  test('SEARCH.PROFILE_CARD selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.PROFILE_CARD,
      'SEARCH.PROFILE_CARD'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Profile cards: ${result.count} found`);
  });

  test('SEARCH.PROFILE_LINK selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.PROFILE_LINK,
      'SEARCH.PROFILE_LINK'
    );
    allResults.push(result);

    // Try alternative if primary fails
    if (!result.found) {
      const altResult = await testSelector(
        page,
        SELECTORS.SEARCH.PROFILE_LINK_ALT,
        'SEARCH.PROFILE_LINK_ALT'
      );
      allResults.push(altResult);
      console.log(`  ${altResult.found ? '✅' : '❌'} Profile links (alt): ${altResult.count} found`);
    } else {
      console.log(`  ${result.found ? '✅' : '❌'} Profile links: ${result.count} found`);
    }
  });

  test('SEARCH.PROFILE_NAME selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.PROFILE_NAME,
      'SEARCH.PROFILE_NAME'
    );
    allResults.push(result);

    if (!result.found) {
      const altResult = await testSelector(
        page,
        SELECTORS.SEARCH.PROFILE_NAME_ALT,
        'SEARCH.PROFILE_NAME_ALT'
      );
      allResults.push(altResult);
    }
    console.log(`  ${result.found ? '✅' : '❌'} Profile names: ${result.count} found`);
  });

  test('SEARCH.HEADLINE selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.HEADLINE,
      'SEARCH.HEADLINE'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Headlines: ${result.count} found`);
  });

  test('SEARCH.LOCATION selector', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.LOCATION,
      'SEARCH.LOCATION'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Locations: ${result.count} found`);
  });

  test('SEARCH.PROFILE_IMAGE selectors', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelector(
      page,
      SELECTORS.SEARCH.PROFILE_IMAGE,
      'SEARCH.PROFILE_IMAGE'
    );
    allResults.push(result);

    if (!result.found) {
      const altResult = await testSelector(
        page,
        SELECTORS.SEARCH.PROFILE_IMAGE_ALT,
        'SEARCH.PROFILE_IMAGE_ALT'
      );
      allResults.push(altResult);
    }
    console.log(`  ${result.found ? '✅' : '❌'} Profile images: ${result.count} found`);
  });

  test('SEARCH.PAGINATION selectors', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const container = await testSelector(
      page,
      SELECTORS.SEARCH.PAGINATION.CONTAINER,
      'SEARCH.PAGINATION.CONTAINER'
    );
    allResults.push(container);

    const nextBtn = await testSelector(
      page,
      SELECTORS.SEARCH.PAGINATION.NEXT_BUTTON,
      'SEARCH.PAGINATION.NEXT_BUTTON'
    );
    allResults.push(nextBtn);

    console.log(`  ${container.found ? '✅' : '❌'} Pagination container: ${container.count} found`);
    console.log(`  ${nextBtn.found ? '✅' : '❌'} Next button: ${nextBtn.count} found`);
  });
});

test.describe('Search - Extract Profile Data', () => {
  test('Extract profile data from search results', async ({ page }) => {
    await page.goto(TEST_SEARCH_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    // Try to extract data from first few profiles
    const profiles = await page.evaluate((selectors) => {
      const cards = document.querySelectorAll(selectors.PROFILE_CARD);
      const extracted = [];

      cards.forEach((card, index) => {
        if (index >= 3) return; // Only first 3

        const nameEl = card.querySelector(selectors.PROFILE_NAME) ||
                       card.querySelector(selectors.PROFILE_NAME_ALT);
        const linkEl = card.querySelector(selectors.PROFILE_LINK) ||
                       card.querySelector(selectors.PROFILE_LINK_ALT);
        const headlineEl = card.querySelector(selectors.HEADLINE);
        const locationEl = card.querySelector(selectors.LOCATION);

        extracted.push({
          name: nameEl?.textContent?.trim() || null,
          profileUrl: linkEl?.href || null,
          headline: headlineEl?.textContent?.trim() || null,
          location: locationEl?.textContent?.trim() || null
        });
      });

      return extracted;
    }, SELECTORS.SEARCH);

    console.log('\n  📊 Extracted Profile Data:');
    profiles.forEach((profile, i) => {
      console.log(`\n  Profile ${i + 1}:`);
      console.log(`    Name: ${profile.name || '❌ Not found'}`);
      console.log(`    URL: ${profile.profileUrl ? '✅ Found' : '❌ Not found'}`);
      console.log(`    Headline: ${profile.headline || '❌ Not found'}`);
      console.log(`    Location: ${profile.location || '❌ Not found'}`);
    });

    // At least one profile should have a name
    const hasNames = profiles.some(p => p.name);
    expect(hasNames).toBe(true);
  });
});
