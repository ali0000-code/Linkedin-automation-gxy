/**
 * Complete Selector Test - Optimized Single Run
 *
 * Tests all selectors in one browser session with minimal navigation.
 * Generates JSON report at the end.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const fs = require('fs');
const path = require('path');

// Test profiles for comprehensive coverage
const TEST_PROFILES = [
  { id: 'mahammaqsood', description: 'Connect + Message + More(Follow)' },
  { id: 'irma-waqar-abbasi', description: 'Follow + Message + More(Connect), has email' },
];

// Results storage
const results = {
  timestamp: new Date().toISOString(),
  profile: { working: [], broken: [] },
  contactInfo: { working: [], broken: [] },
  messaging: { working: [], broken: [] },
  connections: { working: [], broken: [] },
  search: { working: [], broken: [] },
  summary: { total: 0, passed: 0, failed: 0 }
};

// Helper to test selector
async function testSelector(page, selector, name) {
  try {
    const elements = await page.$$(selector);
    const found = elements.length > 0;
    return { name, selector, found, count: elements.length };
  } catch (e) {
    return { name, selector, found: false, count: 0, error: e.message };
  }
}

// Helper to wait for LinkedIn page load
async function waitForLoad(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

test.describe.serial('Complete Selector Test', () => {

  // ==================== PROFILE SELECTORS ====================
  test('1. Profile Page Selectors', async ({ page }) => {
    console.log('\n\n========================================');
    console.log('  PROFILE PAGE SELECTORS');
    console.log('========================================\n');

    const profileResults = {};

    for (const profile of TEST_PROFILES) {
      console.log(`\n Testing: ${profile.id}`);
      await page.goto(`/in/${profile.id}`);
      await waitForLoad(page);

      const selectors = {
        'ACTION_CONTAINER': SELECTORS.PROFILE.ACTION_CONTAINER,
        'CONNECT_BUTTON': SELECTORS.PROFILE.CONNECT_BUTTON,
        'MESSAGE_BUTTON': SELECTORS.PROFILE.MESSAGE_BUTTON,
        'FOLLOW_BUTTON': SELECTORS.PROFILE.FOLLOW_BUTTON,
        'MORE_BUTTON': SELECTORS.PROFILE.MORE_BUTTON,
        'PENDING_BUTTON': SELECTORS.PROFILE.PENDING_BUTTON,
      };

      for (const [name, selector] of Object.entries(selectors)) {
        const result = await testSelector(page, selector, name);
        if (!profileResults[name]) profileResults[name] = { found: false, profiles: [] };
        if (result.found) {
          profileResults[name].found = true;
          profileResults[name].profiles.push(profile.id);
        }
        console.log(`   ${result.found ? '✅' : '❌'} ${name}: ${result.count}`);
      }

      // Test dropdown (click More first)
      const moreBtn = await page.$(SELECTORS.PROFILE.MORE_BUTTON);
      if (moreBtn && await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(800);

        const dropdownSelectors = {
          'DROPDOWN_CONNECT': SELECTORS.PROFILE.DROPDOWN_CONNECT,
          'DROPDOWN_FOLLOW': SELECTORS.PROFILE.DROPDOWN_FOLLOW,
        };

        for (const [name, selector] of Object.entries(dropdownSelectors)) {
          const result = await testSelector(page, selector, name);
          if (!profileResults[name]) profileResults[name] = { found: false, profiles: [] };
          if (result.found) {
            profileResults[name].found = true;
            profileResults[name].profiles.push(profile.id);
          }
          console.log(`   ${result.found ? '✅' : '❌'} ${name}: ${result.count}`);
        }
        await page.keyboard.press('Escape');
      }
    }

    // Store results
    for (const [name, data] of Object.entries(profileResults)) {
      if (data.found) {
        results.profile.working.push({ name, profiles: data.profiles });
      } else {
        results.profile.broken.push(name);
      }
    }

    console.log('\n Profile Summary:');
    console.log(`   Working: ${results.profile.working.length}`);
    console.log(`   Broken: ${results.profile.broken.length}`);
  });

  // ==================== CONTACT INFO SELECTORS ====================
  test('2. Contact Info Selectors', async ({ page }) => {
    console.log('\n\n========================================');
    console.log('  CONTACT INFO SELECTORS');
    console.log('========================================\n');

    // Use profile with email
    await page.goto('/in/irma-waqar-abbasi');
    await waitForLoad(page);

    const opener = await page.$(SELECTORS.CONTACT_INFO.OPENER);
    if (opener) {
      await opener.click();
      await page.waitForTimeout(1500);

      const selectors = {
        'MODAL': SELECTORS.CONTACT_INFO.MODAL,
        'CLOSE_BUTTON': SELECTORS.CONTACT_INFO.CLOSE_BUTTON,
        'EMAIL_LINK': SELECTORS.CONTACT_INFO.EMAIL_LINK,
        'PROFILE_LINK': SELECTORS.CONTACT_INFO.PROFILE_LINK,
      };

      for (const [name, selector] of Object.entries(selectors)) {
        const result = await testSelector(page, selector, name);
        if (result.found) {
          results.contactInfo.working.push(name);
        } else {
          results.contactInfo.broken.push(name);
        }
        console.log(`   ${result.found ? '✅' : '❌'} ${name}: ${result.count}`);
      }

      // Close modal
      await page.click(SELECTORS.CONTACT_INFO.CLOSE_BUTTON).catch(() => {});
    }

    console.log('\n Contact Info Summary:');
    console.log(`   Working: ${results.contactInfo.working.length}`);
    console.log(`   Broken: ${results.contactInfo.broken.length}`);
  });

  // ==================== MESSAGING SELECTORS ====================
  test('3. Messaging Selectors', async ({ page }) => {
    console.log('\n\n========================================');
    console.log('  MESSAGING SELECTORS');
    console.log('========================================\n');

    await page.goto('/messaging/');
    await waitForLoad(page);

    // Test conversation list selectors (use first working selector from array)
    const arraySelectors = {
      'CONVERSATION_LIST': SELECTORS.MESSAGING.CONVERSATION_LIST_CONTAINERS,
      'CONVERSATION_ITEM': SELECTORS.MESSAGING.CONVERSATION_ITEMS,
      'PARTICIPANT_NAME': SELECTORS.MESSAGING.PARTICIPANT_NAME,
      'MESSAGE_PREVIEW': SELECTORS.MESSAGING.MESSAGE_PREVIEW,
      'TIMESTAMP': SELECTORS.MESSAGING.TIMESTAMP,
    };

    for (const [name, selectorArray] of Object.entries(arraySelectors)) {
      let found = false;
      let count = 0;
      for (const selector of selectorArray) {
        const result = await testSelector(page, selector, name);
        if (result.found) {
          found = true;
          count = result.count;
          break;
        }
      }
      if (found) {
        results.messaging.working.push(name);
      } else {
        results.messaging.broken.push(name);
      }
      console.log(`   ${found ? '✅' : '❌'} ${name}: ${count}`);
    }

    // Click first conversation to test message selectors
    const convItem = await page.$(SELECTORS.MESSAGING.CONVERSATION_ITEMS[0]);
    if (convItem) {
      await convItem.click();
      await page.waitForTimeout(1500);

      const messageSelectors = {
        'MESSAGE_LIST': SELECTORS.MESSAGING.MESSAGE_LIST,
        'MESSAGE_ITEM': SELECTORS.MESSAGING.MESSAGE_ITEM,
        'MESSAGE_CONTENT': SELECTORS.MESSAGING.MESSAGE_CONTENT,
        'MESSAGE_INPUT': SELECTORS.MESSAGING.MESSAGE_INPUT,
        'SEND_BUTTON': SELECTORS.MESSAGING.SEND_BUTTON,
      };

      for (const [name, selectorArray] of Object.entries(messageSelectors)) {
        let found = false;
        let count = 0;
        for (const selector of selectorArray) {
          const result = await testSelector(page, selector, name);
          if (result.found) {
            found = true;
            count = result.count;
            break;
          }
        }
        if (found) {
          results.messaging.working.push(name);
        } else {
          results.messaging.broken.push(name);
        }
        console.log(`   ${found ? '✅' : '❌'} ${name}: ${count}`);
      }
    }

    console.log('\n Messaging Summary:');
    console.log(`   Working: ${results.messaging.working.length}`);
    console.log(`   Broken: ${results.messaging.broken.length}`);
  });

  // ==================== CONNECTIONS SELECTORS ====================
  test('4. Connections Selectors', async ({ page }) => {
    console.log('\n\n========================================');
    console.log('  CONNECTIONS SELECTORS');
    console.log('========================================\n');

    await page.goto('/mynetwork/invite-connect/connections/');
    await waitForLoad(page);

    const selectors = {
      'CONNECTION_CARD_LINK': SELECTORS.CONNECTIONS.CONNECTION_CARD_LINK,
      'CARD_PROFILE_IMAGE': SELECTORS.CONNECTIONS.CARD_PROFILE_IMAGE,
      'CARD_NAME_LINK': SELECTORS.CONNECTIONS.CARD_NAME_LINK,
      'PROFILE_IMAGE': SELECTORS.CONNECTIONS.PROFILE_IMAGE,
    };

    for (const [name, selector] of Object.entries(selectors)) {
      const result = await testSelector(page, selector, name);
      if (result.found) {
        results.connections.working.push(name);
      } else {
        results.connections.broken.push(name);
      }
      console.log(`   ${result.found ? '✅' : '❌'} ${name}: ${result.count}`);
    }

    console.log('\n Connections Summary:');
    console.log(`   Working: ${results.connections.working.length}`);
    console.log(`   Broken: ${results.connections.broken.length}`);
  });

  // ==================== SEARCH SELECTORS ====================
  test('5. Search Selectors', async ({ page }) => {
    console.log('\n\n========================================');
    console.log('  SEARCH SELECTORS');
    console.log('========================================\n');

    await page.goto('/search/results/people/?keywords=developer');
    await waitForLoad(page);

    const selectors = {
      'PROFILE_LINK': SELECTORS.SEARCH.PROFILE_LINK,
      'PROFILE_IMAGE': SELECTORS.SEARCH.PROFILE_IMAGE,
    };

    for (const [name, selector] of Object.entries(selectors)) {
      const result = await testSelector(page, selector, name);
      if (result.found) {
        results.search.working.push(name);
      } else {
        results.search.broken.push(name);
      }
      console.log(`   ${result.found ? '✅' : '❌'} ${name}: ${result.count}`);
    }

    console.log('\n Search Summary:');
    console.log(`   Working: ${results.search.working.length}`);
    console.log(`   Broken: ${results.search.broken.length}`);
  });

  // ==================== FINAL REPORT ====================
  test('6. Generate Report', async () => {
    console.log('\n\n========================================');
    console.log('  FINAL REPORT');
    console.log('========================================\n');

    // Calculate totals
    const allWorking = [
      ...results.profile.working.map(w => w.name || w),
      ...results.contactInfo.working,
      ...results.messaging.working,
      ...results.connections.working,
      ...results.search.working,
    ];

    const allBroken = [
      ...results.profile.broken,
      ...results.contactInfo.broken,
      ...results.messaging.broken,
      ...results.connections.broken,
      ...results.search.broken,
    ];

    results.summary.passed = allWorking.length;
    results.summary.failed = allBroken.length;
    results.summary.total = allWorking.length + allBroken.length;

    console.log(' WORKING SELECTORS:');
    allWorking.forEach(s => console.log(`   ✅ ${s}`));

    if (allBroken.length > 0) {
      console.log('\n BROKEN SELECTORS:');
      allBroken.forEach(s => console.log(`   ❌ ${s}`));
    }

    console.log('\n----------------------------------------');
    console.log(` TOTAL: ${results.summary.passed} working, ${results.summary.failed} broken`);
    console.log('========================================\n');

    // Save JSON report
    const reportPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(` JSON report saved to: test-results.json\n`);
  });
});
