# Phase 3: Chrome Extension - Setup Guide

## Overview
This guide will walk you through installing and configuring the LinkedIn Automation Chrome extension for local development and testing.

## Prerequisites

Before installing the extension, ensure you have:

1. **Chrome Browser** - Version 88 or higher (Manifest V3 support)
2. **Phase 1 & 2 Complete** - Backend API must be running
3. **User Account** - Created via Phase 1 authentication endpoints
4. **XAMPP Running** - MySQL and Apache started
5. **Laravel Backend** - Running on `http://localhost:8000`

## Project Structure

```
extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── background.js           # Background service worker
├── content-script.js       # LinkedIn page injection script
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── options.css            # Settings page styles
├── services/
│   ├── api.js            # Backend API communication
│   ├── auth.js           # Authentication logic
│   ├── storage.js        # Chrome storage wrapper
│   └── extractor.js      # LinkedIn extraction logic
├── utils/
│   └── selectors.js      # LinkedIn DOM selectors
└── icons/                # Extension icons
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Installation Steps

### Step 1: Verify Backend is Running

Before installing the extension, ensure your Laravel backend is accessible:

```bash
# Navigate to backend directory
cd C:\Users\a2z\linkedin-automation\backend

# Start Laravel development server
php artisan serve
```

You should see:
```
Starting Laravel development server: http://127.0.0.1:8000
```

Test the API:
```bash
# Open browser and visit
http://localhost:8000/api/user
```

You should see a JSON response (error is expected if not authenticated).

### Step 2: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click: Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to: `C:\Users\a2z\linkedin-automation\extension`
   - Select the `extension` folder and click "Select Folder"

4. **Verify Installation**
   - You should see "LinkedIn Automation" extension card
   - Version: 1.0.0
   - Status: Enabled
   - Extension icon should appear in Chrome toolbar

### Step 3: Configure Extension Settings

When you first install the extension, the **Options page** will open automatically.

#### 3.1 Login to Your Account

1. Enter your credentials:
   - **Email**: The email you registered with in Phase 1
   - **Password**: Your password

2. Click **Login**

3. If successful, you'll see the Settings section

#### 3.2 Verify API URL (Optional)

The default API URL is `http://localhost:8000/api`

If your backend runs on a different port:
1. In Settings section, find "API Base URL"
2. Update to your backend URL (e.g., `http://localhost:8001/api`)
3. Click "Save API URL"

#### 3.3 Set Extraction Limit (Optional)

Default extraction limit is 100 prospects per session.

To change:
1. Find "Default Extraction Limit" field
2. Enter a number between 1 and 100
3. Click "Save Limit"

**Recommended limits**:
- Testing: 10-20 prospects
- Production: 50-100 prospects

### Step 4: Verify Extension Functionality

#### 4.1 Test Popup

1. Click the extension icon in Chrome toolbar
2. You should see:
   - Your email displayed
   - "Extract Prospects" button
   - Extraction limit input field
   - Logout button

#### 4.2 Test Content Script Injection

1. Navigate to LinkedIn: `https://www.linkedin.com`
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. Look for messages:
   ```
   [Content Script] LinkedIn Automation extension loaded
   [Content Script] Initialization complete
   ```

If you see these messages, the content script is working correctly.

## Configuration Reference

### Chrome Storage Data

The extension stores the following data locally (Chrome Storage API):

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `auth_token` | String | Laravel Sanctum bearer token | null |
| `user_email` | String | Logged-in user's email | null |
| `api_url` | String | Backend API base URL | `http://localhost:8000/api` |
| `extraction_limit` | Number | Max prospects per extraction | 100 |

### Permissions

The extension requires these permissions (defined in manifest.json):

- **storage** - Store auth token and settings
- **activeTab** - Access current LinkedIn tab
- **scripting** - Inject content scripts

Host permissions:
- `https://www.linkedin.com/*` - Access LinkedIn pages
- `http://localhost:8000/*` - Access local backend API

## Troubleshooting

### Extension Not Loading

**Problem**: "Load unpacked" shows error

**Solution**:
1. Ensure you selected the `extension` folder (not a parent folder)
2. Check that `manifest.json` exists in the selected folder
3. Verify manifest.json is valid JSON (no syntax errors)

### Content Script Not Injecting

**Problem**: No console messages on LinkedIn pages

**Solution**:
1. Reload the LinkedIn page (Ctrl+R or F5)
2. Check extension is enabled at `chrome://extensions/`
3. Verify you're on `linkedin.com` domain
4. Reload extension:
   - Go to `chrome://extensions/`
   - Click reload icon (⟳) on extension card

### Login Fails

**Problem**: "Login failed" error in Options page

**Solutions**:

1. **Check backend is running**:
   ```bash
   php artisan serve
   ```

2. **Verify API URL**:
   - Options page → API Base URL should be `http://localhost:8000/api`

3. **Test API manually**:
   ```bash
   # In Postman or browser
   POST http://localhost:8000/api/login
   Body: {
     "email": "your@email.com",
     "password": "your_password"
   }
   ```

4. **Check CORS settings**:
   - Laravel backend should allow `chrome-extension://` origin
   - Or use `*` for development (in `config/cors.php`)

5. **Check credentials**:
   - Ensure you registered a user in Phase 1
   - Email and password must match database

### Extraction Returns 0 Prospects

**Problem**: Extraction completes but finds no prospects

**Solutions**:

1. **Ensure you're on search results page**:
   - URL must contain: `/search/results/people`
   - Example: `https://www.linkedin.com/search/results/people/?keywords=developer`

2. **Update LinkedIn selectors**:
   - LinkedIn may have changed their DOM structure
   - Open `extension/utils/selectors.js`
   - Inspect LinkedIn page and update selectors
   - See CODE_GUIDE.md for selector maintenance

3. **Check console for errors**:
   - Open DevTools (F12) → Console
   - Look for `[Extractor]` messages
   - Errors will indicate which selector failed

### Backend Import Fails

**Problem**: Extraction works but import to backend fails

**Solutions**:

1. **Check authentication**:
   - Logout and login again in Options page
   - Token may have expired

2. **Check backend logs**:
   ```bash
   # In backend directory
   tail -f storage/logs/laravel.log
   ```

3. **Test bulk import endpoint manually**:
   ```bash
   # In Postman
   POST http://localhost:8000/api/prospects/bulk
   Headers:
     Authorization: Bearer YOUR_TOKEN_HERE
     Content-Type: application/json
   Body: {
     "prospects": [
       {
         "full_name": "Test User",
         "profile_url": "https://linkedin.com/in/test",
         "linkedin_id": "test",
         "headline": "Developer",
         "company": "TechCorp",
         "location": "USA"
       }
     ]
   }
   ```

## Development Tips

### Debugging

**View Extension Console**:
1. Go to `chrome://extensions/`
2. Find "LinkedIn Automation"
3. Click "service worker" link (under "Inspect views")
4. Opens DevTools for background service worker

**View Popup Console**:
1. Right-click extension icon
2. Select "Inspect popup"
3. Opens DevTools for popup.html

**View Content Script Console**:
1. Open any LinkedIn page
2. Press F12 for DevTools
3. Go to Console tab
4. Content script logs appear here

### Hot Reload

When you make changes to extension code:

1. **For content scripts** (content-script.js, extractor.js, selectors.js):
   - Refresh the LinkedIn page (F5)

2. **For popup/options** (popup.js, options.js):
   - Close and reopen popup/options page

3. **For background worker** (background.js):
   - Go to `chrome://extensions/`
   - Click reload icon (⟳) on extension card

4. **For manifest.json**:
   - MUST reload extension (⟳)

### Viewing Storage

To see stored data:

1. Go to `chrome://extensions/`
2. Find "LinkedIn Automation"
3. Click "Details"
4. Scroll to "Inspect views"
5. Click "service worker"
6. In console, type:
   ```javascript
   chrome.storage.local.get(null, (data) => console.log(data));
   ```

## Next Steps

Once the extension is installed and configured:

1. **Read CODE_GUIDE.md** - Understand the architecture
2. **Read TESTING.md** - Learn how to test extraction
3. **Test on LinkedIn** - Extract your first prospects
4. **Verify in Backend** - Check prospects were saved to database

## Security Notes

### For Development

- API URL defaults to `localhost:8000` (HTTP is fine)
- CORS must allow extension origin
- Auth token stored in Chrome local storage (encrypted by Chrome)

### For Production

When deploying to production:

1. **Use HTTPS** for API URL
2. **Update host_permissions** in manifest.json to your production domain
3. **Configure CORS** to allow only extension origin
4. **Rate limiting** should be enabled on backend
5. **Token expiration** should be enforced

## Common Issues

### Issue: "Manifest version 2 is deprecated"

**Solution**: This extension uses Manifest V3 (modern standard). Ignore V2 warnings.

### Issue: Extension icon grayed out

**Solution**: Extension only works on `linkedin.com` pages. Navigate to LinkedIn.

### Issue: "Service worker inactive"

**Solution**: This is normal. Service workers activate on-demand in Manifest V3.

## Support

If you encounter issues not covered here:

1. Check browser console for errors
2. Verify backend is running and accessible
3. Review Phase 1 & 2 documentation
4. Check Laravel logs for API errors
5. Ensure database migrations are up to date

---

**Phase 3 Setup Complete!**

Your Chrome extension is now installed and ready to extract LinkedIn prospects.

Proceed to **CODE_GUIDE.md** to understand the extension architecture.
