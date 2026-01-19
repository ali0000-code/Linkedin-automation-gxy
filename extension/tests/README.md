# LinkedIn Selector Tests

Automated Playwright tests to validate LinkedIn DOM selectors used by the extension.

## Setup

```bash
cd extension/tests
npm install
npx playwright install chromium
```

## Authentication

Before running tests, you need to save your LinkedIn session:

```bash
npm run auth:save
```

This will:
1. Open a browser window
2. Navigate to LinkedIn login
3. Wait for you to log in manually
4. Press Enter in the terminal after logging in
5. Save your session to `auth.json`

The saved session is reused for all tests so you don't need to log in each time.

## Running Tests

### Run all tests (headed - see browser)
```bash
npm run test:all
```

### Run specific page tests
```bash
npm run test:profile      # Profile page selectors
npm run test:search       # Search results selectors
npm run test:inbox        # Messaging/inbox selectors
npm run test:connections  # Connections page selectors
```

### Run with UI (interactive mode)
```bash
npm run test:ui
```

### Run in debug mode
```bash
npm run test:debug
```

### View test report
```bash
npm run report
```

## Test Files

| File | Tests |
|------|-------|
| `profile.spec.js` | Profile page buttons, contact info modal |
| `search.spec.js` | Search results, profile cards, pagination |
| `inbox.spec.js` | Conversation list, messages, input |
| `connections.spec.js` | Connection cards, names, images |
| `current-user.spec.js` | Me button, user detection |
| `all-selectors.spec.js` | Comprehensive test of all selectors |

## Output

After running tests, you'll see:
- Console output with ✅/❌ for each selector
- `selector-report.json` - Detailed JSON report
- `selector-report.html` - Visual HTML report
- `playwright-report/` - Playwright's built-in report

## Updating Selectors

If tests fail because LinkedIn changed their UI:

1. Run tests to identify broken selectors
2. Use browser DevTools to find new selectors
3. Update `../utils/selectors.js` in the extension
4. Update `./selectors.js` in tests (keep in sync!)
5. Re-run tests to verify

## Tips

- LinkedIn may rate-limit or block automated access
- Tests run sequentially to avoid detection
- If tests fail with "not logged in", re-run `npm run auth:save`
- Use `--headed` flag to see what's happening in the browser
