/**
 * Messaging/Inbox Page Selector Tests
 *
 * Tests selectors on LinkedIn messaging page.
 */

const { test, expect } = require('@playwright/test');
const SELECTORS = require('./selectors');
const {
  testSelector,
  testSelectorArray,
  printResults,
  waitForLinkedInLoad
} = require('./test-helpers');

const TEST_INBOX_URL = '/messaging/';

test.describe('Messaging Page Selectors', () => {
  let allResults = [];

  test.beforeAll(async () => {
    console.log('\n📝 Testing Messaging/Inbox Page Selectors');
    console.log(`   URL: ${TEST_INBOX_URL}\n`);
  });

  test.afterAll(async () => {
    printResults(allResults, 'MESSAGING PAGE SELECTORS');
  });

  test('Navigate to messaging page', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const isMessaging = await page.evaluate(() => {
      return window.location.pathname.includes('/messaging');
    });
    expect(isMessaging).toBe(true);
  });

  test('MESSAGING.CONVERSATION_LIST_CONTAINERS selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.CONVERSATION_LIST_CONTAINERS,
      'MESSAGING.CONVERSATION_LIST_CONTAINERS'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Conversation list container: ${result.found ? `found with selector [${result.matchedIndex}]` : 'NOT FOUND'}`);
  });

  test('MESSAGING.CONVERSATION_ITEMS selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.CONVERSATION_ITEMS,
      'MESSAGING.CONVERSATION_ITEMS'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Conversation items: ${result.count} found`);
  });

  test('MESSAGING.CONVERSATION_LINK_DIV selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.CONVERSATION_LINK_DIV,
      'MESSAGING.CONVERSATION_LINK_DIV'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Conversation link divs: ${result.count} found`);
  });

  test('MESSAGING.PARTICIPANT_NAME selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.PARTICIPANT_NAME,
      'MESSAGING.PARTICIPANT_NAME'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Participant names: ${result.count} found`);
  });

  test('MESSAGING.AVATAR selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.AVATAR,
      'MESSAGING.AVATAR'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Avatars: ${result.count} found`);
  });

  test('MESSAGING.MESSAGE_PREVIEW selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_PREVIEW,
      'MESSAGING.MESSAGE_PREVIEW'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Message previews: ${result.count} found`);
  });

  test('MESSAGING.TIMESTAMP selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const result = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.TIMESTAMP,
      'MESSAGING.TIMESTAMP'
    );
    allResults.push(result);
    console.log(`  ${result.found ? '✅' : '❌'} Timestamps: ${result.count} found`);
  });
});

test.describe('Messaging - Conversation View Selectors', () => {
  test('Open a conversation and test message selectors', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    // Try to click on first conversation
    let clicked = false;
    for (const selector of SELECTORS.MESSAGING.CONVERSATION_LINK_DIV) {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.log('  ⚠️  No conversation to click, skipping conversation view tests');
      return;
    }

    await page.waitForTimeout(2000);

    // Test message list selectors
    const messageList = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_LIST,
      'MESSAGING.MESSAGE_LIST'
    );
    console.log(`  ${messageList.found ? '✅' : '❌'} Message list: ${messageList.count} found`);

    const messageItems = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_ITEM,
      'MESSAGING.MESSAGE_ITEM'
    );
    console.log(`  ${messageItems.found ? '✅' : '❌'} Message items: ${messageItems.count} found`);

    const messageContent = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_CONTENT,
      'MESSAGING.MESSAGE_CONTENT'
    );
    console.log(`  ${messageContent.found ? '✅' : '❌'} Message content: ${messageContent.count} found`);

    const messageSender = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_SENDER,
      'MESSAGING.MESSAGE_SENDER'
    );
    console.log(`  ${messageSender.found ? '✅' : '❌'} Message sender: ${messageSender.count} found`);

    const messageInput = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.MESSAGE_INPUT,
      'MESSAGING.MESSAGE_INPUT'
    );
    console.log(`  ${messageInput.found ? '✅' : '❌'} Message input: ${messageInput.count} found`);

    const sendButton = await testSelectorArray(
      page,
      SELECTORS.MESSAGING.SEND_BUTTON,
      'MESSAGING.SEND_BUTTON'
    );
    console.log(`  ${sendButton.found ? '✅' : '❌'} Send button: ${sendButton.count} found`);
  });
});

test.describe('Messaging - Extract Conversation Data', () => {
  test('Extract conversation list data', async ({ page }) => {
    await page.goto(TEST_INBOX_URL);
    await waitForLinkedInLoad(page);
    await page.waitForTimeout(2000);

    const conversations = await page.evaluate((selectors) => {
      const extracted = [];

      // Try each conversation item selector
      let items = [];
      for (const sel of selectors.CONVERSATION_ITEMS) {
        items = document.querySelectorAll(sel);
        if (items.length > 0) break;
      }

      items.forEach((item, index) => {
        if (index >= 5) return; // Only first 5

        // Try to find participant name
        let name = null;
        for (const sel of selectors.PARTICIPANT_NAME) {
          const el = item.querySelector(sel);
          if (el) {
            name = el.textContent?.trim();
            break;
          }
        }

        // Try to find timestamp
        let timestamp = null;
        for (const sel of selectors.TIMESTAMP) {
          const el = item.querySelector(sel);
          if (el) {
            timestamp = el.textContent?.trim();
            break;
          }
        }

        // Try to find preview
        let preview = null;
        for (const sel of selectors.MESSAGE_PREVIEW) {
          const el = item.querySelector(sel);
          if (el) {
            preview = el.textContent?.trim()?.substring(0, 50);
            break;
          }
        }

        extracted.push({ name, timestamp, preview });
      });

      return extracted;
    }, SELECTORS.MESSAGING);

    console.log('\n  📊 Extracted Conversation Data:');
    conversations.forEach((conv, i) => {
      console.log(`\n  Conversation ${i + 1}:`);
      console.log(`    Name: ${conv.name || '❌ Not found'}`);
      console.log(`    Time: ${conv.timestamp || '❌ Not found'}`);
      console.log(`    Preview: ${conv.preview || '❌ Not found'}`);
    });

    // At least some data should be extracted
    const hasData = conversations.some(c => c.name || c.timestamp);
    if (!hasData && conversations.length === 0) {
      console.log('\n  ⚠️  No conversations found in inbox');
    }
  });
});
