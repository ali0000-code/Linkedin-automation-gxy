/**
 * Multi-Profile Selector Tests
 *
 * Tests selectors across multiple profiles with different states:
 * - irma-waqar-abbasi: Follow, Message, More (Connect inside), has email/birthday
 * - mahammaqsood: Connect, Message, More (Follow inside)
 * - williamhgates: Public figure profile
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const { testSelector, waitForLinkedInLoad } = require('./test-helpers');

const TEST_PROFILES = [
  {
    id: 'irma-waqar-abbasi',
    description: 'Follow + Message + More(Connect), has email/birthday',
    expected: {
      followButton: true,
      messageButton: true,
      moreButton: true,
      dropdownConnect: true,
      hasEmail: true,
      hasBirthday: true
    }
  },
  {
    id: 'mahammaqsood',
    description: 'Connect + Message + More(Follow)',
    expected: {
      connectButton: true,
      messageButton: true,
      moreButton: true,
      dropdownFollow: true
    }
  },
  {
    id: 'williamhgates',
    description: 'Public figure (Bill Gates)',
    expected: {
      followButton: true,
      moreButton: true
    }
  }
];

// Aggregate results across all profiles
const aggregateResults = {};

test.describe.serial('Multi-Profile Selector Validation', () => {

  for (const profile of TEST_PROFILES) {
    test.describe(`Profile: ${profile.id}`, () => {

      test(`Test profile buttons on ${profile.id}`, async ({ page }) => {
        console.log(`\n\n🔍 Testing profile: ${profile.id}`);
        console.log(`   ${profile.description}\n`);

        await page.goto(`/in/${profile.id}`);
        await waitForLinkedInLoad(page);
        await page.waitForTimeout(2000);

        // Test all profile selectors
        const selectors = {
          'ACTION_CONTAINER': SELECTORS.PROFILE.ACTION_CONTAINER,
          'ACTION_BUTTON_CHECK': SELECTORS.PROFILE.ACTION_BUTTON_CHECK,
          'CONNECT_BUTTON': SELECTORS.PROFILE.CONNECT_BUTTON,
          'MESSAGE_BUTTON': SELECTORS.PROFILE.MESSAGE_BUTTON,
          'FOLLOW_BUTTON': SELECTORS.PROFILE.FOLLOW_BUTTON,
          'MORE_BUTTON': SELECTORS.PROFILE.MORE_BUTTON,
          'PENDING_BUTTON': SELECTORS.PROFILE.PENDING_BUTTON,
        };

        console.log('  Profile Button Selectors:');
        for (const [name, selector] of Object.entries(selectors)) {
          const result = await testSelector(page, selector, name);

          // Aggregate
          if (!aggregateResults[name]) {
            aggregateResults[name] = { found: false, profiles: [] };
          }
          if (result.found) {
            aggregateResults[name].found = true;
            aggregateResults[name].profiles.push(profile.id);
          }

          const icon = result.found ? '✅' : '❌';
          console.log(`    ${icon} ${name}: ${result.count} found`);
        }
      });

      test(`Test More dropdown on ${profile.id}`, async ({ page }) => {
        await page.goto(`/in/${profile.id}`);
        await waitForLinkedInLoad(page);
        await page.waitForTimeout(2000);

        // Click More button - find visible one
        const moreButtons = await page.$$(SELECTORS.PROFILE.MORE_BUTTON);
        let clicked = false;

        for (const btn of moreButtons) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click();
            clicked = true;
            break;
          }
        }

        if (clicked) {
          await page.waitForTimeout(1000);

          console.log('\n  Dropdown Selectors (after clicking More):');

          const dropdownSelectors = {
            'DROPDOWN_CONNECT': SELECTORS.PROFILE.DROPDOWN_CONNECT,
            'DROPDOWN_FOLLOW': SELECTORS.PROFILE.DROPDOWN_FOLLOW,
          };

          for (const [name, selector] of Object.entries(dropdownSelectors)) {
            const result = await testSelector(page, selector, name);

            if (!aggregateResults[name]) {
              aggregateResults[name] = { found: false, profiles: [] };
            }
            if (result.found) {
              aggregateResults[name].found = true;
              aggregateResults[name].profiles.push(profile.id);
            }

            const icon = result.found ? '✅' : '❌';
            console.log(`    ${icon} ${name}: ${result.count} found`);
          }

          // Close dropdown by pressing Escape
          await page.keyboard.press('Escape');
        } else {
          console.log('  ⚠️  More button not visible/clickable, skipping dropdown test');
        }
      });

      test(`Test Contact Info on ${profile.id}`, async ({ page }) => {
        await page.goto(`/in/${profile.id}`);
        await waitForLinkedInLoad(page);
        await page.waitForTimeout(2000);

        // Test contact info opener
        const openerResult = await testSelector(page, SELECTORS.CONTACT_INFO.OPENER, 'CONTACT_INFO.OPENER');

        if (!aggregateResults['CONTACT_INFO.OPENER']) {
          aggregateResults['CONTACT_INFO.OPENER'] = { found: false, profiles: [] };
        }
        if (openerResult.found) {
          aggregateResults['CONTACT_INFO.OPENER'].found = true;
          aggregateResults['CONTACT_INFO.OPENER'].profiles.push(profile.id);
        }

        console.log(`\n  Contact Info Selectors:`);
        console.log(`    ${openerResult.found ? '✅' : '❌'} OPENER: ${openerResult.count} found`);

        if (openerResult.found) {
          await page.click(SELECTORS.CONTACT_INFO.OPENER);
          await page.waitForTimeout(1500);

          const contactSelectors = {
            'MODAL': SELECTORS.CONTACT_INFO.MODAL,
            'CLOSE_BUTTON': SELECTORS.CONTACT_INFO.CLOSE_BUTTON,
            'EMAIL_LINK': SELECTORS.CONTACT_INFO.EMAIL_LINK,
            'PROFILE_LINK': SELECTORS.CONTACT_INFO.PROFILE_LINK,
          };

          for (const [name, selector] of Object.entries(contactSelectors)) {
            const result = await testSelector(page, selector, `CONTACT_INFO.${name}`);

            const key = `CONTACT_INFO.${name}`;
            if (!aggregateResults[key]) {
              aggregateResults[key] = { found: false, profiles: [] };
            }
            if (result.found) {
              aggregateResults[key].found = true;
              aggregateResults[key].profiles.push(profile.id);
            }

            const icon = result.found ? '✅' : '❌';
            console.log(`    ${icon} ${name}: ${result.count} found`);
          }

          // Close modal
          await page.click(SELECTORS.CONTACT_INFO.CLOSE_BUTTON).catch(() => {});
        }
      });
    });
  }

  test('Aggregate Results Summary', async () => {
    console.log('\n\n' + '='.repeat(70));
    console.log(' AGGREGATE RESULTS - Selector works if found on ANY profile');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;

    // Sort by name
    const sortedKeys = Object.keys(aggregateResults).sort();

    for (const name of sortedKeys) {
      const result = aggregateResults[name];
      const icon = result.found ? '✅' : '❌';
      const profiles = result.profiles.length > 0 ? `(${result.profiles.join(', ')})` : '';

      console.log(`${icon} ${name}: ${result.found ? 'WORKS' : 'BROKEN'} ${profiles}`);

      if (result.found) passed++;
      else failed++;
    }

    console.log('\n' + '-'.repeat(70));
    console.log(`TOTAL: ${passed} working, ${failed} broken out of ${passed + failed}`);
    console.log('='.repeat(70));

    // List only truly broken selectors (not found on any profile)
    const broken = sortedKeys.filter(k => !aggregateResults[k].found);
    if (broken.length > 0) {
      console.log('\n⚠️  SELECTORS NEEDING UPDATE (not found on any profile):');
      broken.forEach(k => console.log(`   - ${k}`));
    }

    console.log('\n');
  });
});
