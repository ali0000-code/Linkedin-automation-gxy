/**
 * Test Helper Utilities
 *
 * Common functions for testing LinkedIn selectors.
 */

/**
 * Test a single selector and return result
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector to test
 * @param {string} name - Human-readable name for the selector
 * @returns {object} Test result
 */
async function testSelector(page, selector, name) {
  try {
    const elements = await page.$$(selector);
    const count = elements.length;

    return {
      name,
      selector,
      found: count > 0,
      count,
      status: count > 0 ? 'PASS' : 'FAIL'
    };
  } catch (error) {
    return {
      name,
      selector,
      found: false,
      count: 0,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Test multiple selectors (array of alternatives)
 * Returns result of first matching selector
 * @param {Page} page - Playwright page
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {string} name - Human-readable name
 * @returns {object} Test result
 */
async function testSelectorArray(page, selectors, name) {
  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    const result = await testSelector(page, selector, `${name}[${i}]`);

    if (result.found) {
      return {
        name,
        selector,
        found: true,
        count: result.count,
        status: 'PASS',
        matchedIndex: i
      };
    }
  }

  return {
    name,
    selectors,
    found: false,
    count: 0,
    status: 'FAIL',
    note: 'None of the selectors matched'
  };
}

/**
 * Test all selectors in a category
 * @param {Page} page - Playwright page
 * @param {object} selectorGroup - Object of selectors to test
 * @param {string} groupName - Name of the selector group
 * @returns {object[]} Array of test results
 */
async function testSelectorGroup(page, selectorGroup, groupName) {
  const results = [];

  for (const [key, value] of Object.entries(selectorGroup)) {
    const name = `${groupName}.${key}`;

    // Skip non-selector values (like nested objects for pagination)
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively test nested groups
      const nestedResults = await testSelectorGroup(page, value, name);
      results.push(...nestedResults);
      continue;
    }

    // Test array of selectors
    if (Array.isArray(value)) {
      const result = await testSelectorArray(page, value, name);
      results.push(result);
    }
    // Test single selector
    else if (typeof value === 'string') {
      const result = await testSelector(page, value, name);
      results.push(result);
    }
  }

  return results;
}

/**
 * Print test results in a formatted way
 * @param {object[]} results - Array of test results
 * @param {string} title - Title for the results section
 */
function printResults(results, title) {
  console.log('\n' + '='.repeat(60));
  console.log(` ${title}`);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.found ? '✅' : '❌';
    const countStr = result.found ? `(${result.count} found)` : '';
    const indexStr = result.matchedIndex !== undefined ? `[${result.matchedIndex}]` : '';

    console.log(`${icon} ${result.name}${indexStr}: ${result.status} ${countStr}`);

    if (result.found) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('-'.repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log('='.repeat(60) + '\n');

  return { passed, failed, total: results.length };
}

/**
 * Generate HTML report of test results
 * @param {object[]} results - All test results
 * @param {string} pageType - Type of page tested
 * @returns {string} HTML report
 */
function generateHtmlReport(results, pageType) {
  const passed = results.filter(r => r.found).length;
  const failed = results.length - passed;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>LinkedIn Selector Test Report - ${pageType}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #0077B5; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #0077B5; color: white; }
    tr:hover { background: #f5f5f5; }
    .selector { font-family: monospace; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>LinkedIn Selector Test Report</h1>
  <p>Page Type: <strong>${pageType}</strong></p>
  <p>Tested at: ${new Date().toLocaleString()}</p>

  <div class="summary">
    <strong>Summary:</strong>
    <span class="pass">${passed} passed</span> /
    <span class="fail">${failed} failed</span> /
    ${results.length} total
  </div>

  <table>
    <tr>
      <th>Status</th>
      <th>Selector Name</th>
      <th>Count</th>
      <th>Selector</th>
    </tr>
    ${results.map(r => `
      <tr>
        <td class="${r.found ? 'pass' : 'fail'}">${r.found ? '✅ PASS' : '❌ FAIL'}</td>
        <td>${r.name}</td>
        <td>${r.count}</td>
        <td class="selector">${Array.isArray(r.selectors) ? r.selectors.join('<br>') : r.selector}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
  `;
}

/**
 * Wait for page to be fully loaded with LinkedIn content
 * @param {Page} page - Playwright page
 */
async function waitForLinkedInLoad(page) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Wait a bit more for dynamic content
  await page.waitForTimeout(2000);

  // Check if we're on LinkedIn
  const isLinkedIn = await page.evaluate(() => {
    return window.location.hostname.includes('linkedin.com');
  });

  if (!isLinkedIn) {
    throw new Error('Not on LinkedIn - check authentication');
  }
}

module.exports = {
  testSelector,
  testSelectorArray,
  testSelectorGroup,
  printResults,
  generateHtmlReport,
  waitForLinkedInLoad
};
