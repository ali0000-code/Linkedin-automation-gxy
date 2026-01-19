/**
 * Comprehensive Selector Test
 *
 * Runs all selector tests and generates a summary report.
 * Use: npm run test:all
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  testSelectorArray,
  testSelectorGroup,
  printResults,
  generateHtmlReport,
  waitForLinkedInLoad
} = require('./test-helpers');
const fs = require('fs');
const path = require('path');

// Test URLs
const URLS = {
  PROFILE: '/in/williamhgates',
  SEARCH: '/search/results/people/?keywords=software%20engineer',
  INBOX: '/messaging/',
  CONNECTIONS: '/mynetwork/invite-connect/connections/',
  FEED: '/feed/'
};

let allTestResults = {
  profile: [],
  search: [],
  inbox: [],
  connections: [],
  currentUser: []
};

test.describe.serial('Complete Selector Validation Suite', () => {

  test('1. Profile Page Selectors', async ({ page }) => {
    console.log('\n\n🔍 Testing PROFILE PAGE selectors...');
    await page.goto(URLS.PROFILE);
    await waitForLinkedInLoad(page);

    const results = await testSelectorGroup(page, SELECTORS.PROFILE, 'PROFILE');
    allTestResults.profile = results;
    printResults(results, 'PROFILE SELECTORS');

    // Test contact info selectors
    const contactResults = [];
    const openerResult = await testSelector(page, SELECTORS.CONTACT_INFO.OPENER, 'CONTACT_INFO.OPENER');
    contactResults.push(openerResult);

    if (openerResult.found) {
      await page.click(SELECTORS.CONTACT_INFO.OPENER);
      await page.waitForTimeout(1500);

      for (const [key, selector] of Object.entries(SELECTORS.CONTACT_INFO)) {
        if (key === 'OPENER') continue;
        if (typeof selector === 'string') {
          const result = await testSelector(page, selector, `CONTACT_INFO.${key}`);
          contactResults.push(result);
        }
      }

      // Close modal
      await page.click(SELECTORS.CONTACT_INFO.CLOSE_BUTTON).catch(() => {});
    }

    printResults(contactResults, 'CONTACT INFO SELECTORS');
    allTestResults.profile.push(...contactResults);
  });

  test('2. Search Page Selectors', async ({ page }) => {
    console.log('\n\n🔍 Testing SEARCH PAGE selectors...');
    await page.goto(URLS.SEARCH);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const results = [];

    // Test main search selectors
    for (const [key, value] of Object.entries(SELECTORS.SEARCH)) {
      if (key === 'PAGINATION') {
        // Test pagination separately
        for (const [pKey, pSel] of Object.entries(value)) {
          const result = await testSelector(page, pSel, `SEARCH.PAGINATION.${pKey}`);
          results.push(result);
        }
      } else if (typeof value === 'string') {
        const result = await testSelector(page, value, `SEARCH.${key}`);
        results.push(result);
      }
    }

    allTestResults.search = results;
    printResults(results, 'SEARCH SELECTORS');
  });

  test('3. Inbox/Messaging Selectors', async ({ page }) => {
    console.log('\n\n🔍 Testing MESSAGING selectors...');
    await page.goto(URLS.INBOX);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const results = [];

    for (const [key, value] of Object.entries(SELECTORS.MESSAGING)) {
      if (Array.isArray(value)) {
        const result = await testSelectorArray(page, value, `MESSAGING.${key}`);
        results.push(result);
      } else if (typeof value === 'string' && !key.includes('ATTR')) {
        const result = await testSelector(page, value, `MESSAGING.${key}`);
        results.push(result);
      }
    }

    allTestResults.inbox = results;
    printResults(results, 'MESSAGING SELECTORS');
  });

  test('4. Connections Page Selectors', async ({ page }) => {
    console.log('\n\n🔍 Testing CONNECTIONS PAGE selectors...');
    await page.goto(URLS.CONNECTIONS);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const results = await testSelectorGroup(page, SELECTORS.CONNECTIONS, 'CONNECTIONS');
    allTestResults.connections = results;
    printResults(results, 'CONNECTIONS SELECTORS');
  });

  test('5. Current User Detection Selectors', async ({ page }) => {
    console.log('\n\n🔍 Testing CURRENT USER selectors...');
    await page.goto(URLS.FEED);
    await waitForLinkedInLoad(page);

    const results = await testSelectorGroup(page, SELECTORS.CURRENT_USER, 'CURRENT_USER');
    allTestResults.currentUser = results;
    printResults(results, 'CURRENT USER SELECTORS');
  });

  test('6. Generate Summary Report', async ({ page }) => {
    console.log('\n\n📊 GENERATING SUMMARY REPORT...\n');

    // Combine all results
    const allResults = [
      ...allTestResults.profile,
      ...allTestResults.search,
      ...allTestResults.inbox,
      ...allTestResults.connections,
      ...allTestResults.currentUser
    ];

    const passed = allResults.filter(r => r.found).length;
    const failed = allResults.filter(r => !r.found).length;
    const total = allResults.length;

    console.log('='.repeat(60));
    console.log(' FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n  Total Selectors Tested: ${total}`);
    console.log(`  ✅ Passed: ${passed} (${Math.round(passed/total*100)}%)`);
    console.log(`  ❌ Failed: ${failed} (${Math.round(failed/total*100)}%)`);
    console.log('\n' + '='.repeat(60));

    // List failed selectors
    if (failed > 0) {
      console.log('\n  ⚠️  FAILED SELECTORS:');
      allResults.filter(r => !r.found).forEach(r => {
        console.log(`    - ${r.name}`);
      });
    }

    // Save JSON report
    const reportPath = path.join(__dirname, 'selector-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed },
      results: {
        profile: allTestResults.profile,
        search: allTestResults.search,
        inbox: allTestResults.inbox,
        connections: allTestResults.connections,
        currentUser: allTestResults.currentUser
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n  📄 JSON report saved: ${reportPath}`);

    // Save HTML report
    const htmlReportPath = path.join(__dirname, 'selector-report.html');
    const htmlReport = generateHtmlReport(allResults, 'All Pages');
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`  📄 HTML report saved: ${htmlReportPath}`);

    console.log('\n' + '='.repeat(60) + '\n');
  });
});
