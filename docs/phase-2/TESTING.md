# Phase 2 Testing Guide

Step-by-step guide to test all prospect and tag endpoints using Postman.

## Prerequisites

1. Phase 1 complete (authentication working)
2. Laravel server is running: `php artisan serve`
3. MySQL is running in XAMPP
4. Postman is installed
5. You have a valid auth token from Phase 1 login

## Import Postman Collection

1. Open Postman
2. Click **Import** button
3. Select file: `docs/phase-2/postman_collection.json`
4. Collection **"LinkedIn Automation - Phase 2"** will appear

## Use Phase 1 Environment

Make sure you're using the environment created in Phase 1 with:
- `base_url` = `http://localhost:8000/api`
- `auth_token` = (your valid token from login)

If you don't have a token, run the Phase 1 **Login** request first!

---

## Test Flow - Tags First, Then Prospects

### Part 1: Tag Management

Tags are used to categorize prospects, so let's create some tags first.

#### 1. Create Your First Tag

**Endpoint:** `POST /api/tags`

**Steps:**
1. Open the **Create Tag** request
2. Go to **Body** tab
3. Review the JSON:
```json
{
    "name": "Hot Lead",
    "color": "#ef4444"
}
```
4. Click **Send**

**Expected Response (201 Created):**
```json
{
    "message": "Tag created successfully",
    "tag": {
        "id": 1,
        "name": "Hot Lead",
        "color": "#ef4444",
        "prospects_count": 0,
        "created_at": "2025-11-29T...",
        "updated_at": "2025-11-29T..."
    }
}
```

**Create More Tags:**
Try creating these additional tags:
- CEO: `{"name": "CEO", "color": "#3b82f6"}`
- Marketing: `{"name": "Marketing", "color": "#10b981"}`
- Tech: `{"name": "Tech", "color": "#8b5cf6"}`

---

#### 2. Get All Tags

**Endpoint:** `GET /api/tags`

**Steps:**
1. Open the **Get All Tags** request
2. Click **Send**

**Expected Response (200 OK):**
```json
[
    {
        "id": 1,
        "name": "Hot Lead",
        "color": "#ef4444",
        "prospects_count": 0,
        "created_at": "...",
        "updated_at": "..."
    },
    {
        "id": 2,
        "name": "CEO",
        "color": "#3b82f6",
        "prospects_count": 0,
        "created_at": "...",
        "updated_at": "..."
    }
]
```

**What to Notice:**
- `prospects_count` is 0 because we haven't added any prospects yet
- Tags are sorted alphabetically by name

---

#### 3. Update a Tag

**Endpoint:** `PUT /api/tags/{id}`

**Steps:**
1. Open the **Update Tag** request
2. Change the ID in the URL to `1`
3. Update the body:
```json
{
    "name": "Hot Lead - Priority",
    "color": "#dc2626"
}
```
4. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Tag updated successfully",
    "tag": {
        "id": 1,
        "name": "Hot Lead - Priority",
        "color": "#dc2626",
        ...
    }
}
```

---

#### 4. Get Single Tag

**Endpoint:** `GET /api/tags/{id}`

**Steps:**
1. Open the **Get Single Tag** request
2. Change ID to `1` in the URL
3. Click **Send**

**Expected Response (200 OK):**
Returns the tag with `prospects_count` included.

---

### Part 2: Prospect Management

Now let's create and manage prospects.

#### 5. Create Your First Prospect

**Endpoint:** `POST /api/prospects`

**Steps:**
1. Open the **Create Prospect** request
2. Review the body:
```json
{
    "full_name": "Jane Smith",
    "profile_url": "https://linkedin.com/in/janesmith",
    "headline": "CEO at TechCorp",
    "company": "TechCorp",
    "location": "San Francisco, CA"
}
```
3. Click **Send**

**Expected Response (201 Created):**
```json
{
    "message": "Prospect created successfully",
    "prospect": {
        "id": 1,
        "linkedin_id": null,
        "full_name": "Jane Smith",
        "headline": "CEO at TechCorp",
        "profile_url": "https://linkedin.com/in/janesmith",
        "location": "San Francisco, CA",
        "company": "TechCorp",
        "profile_image_url": null,
        "connection_status": "not_connected",
        "notes": null,
        "last_contacted_at": null,
        "tags": [],
        "created_at": "...",
        "updated_at": "..."
    }
}
```

**Create More Prospects:**
Create a few more with different data:
```json
{
    "full_name": "Michael Brown",
    "profile_url": "https://linkedin.com/in/michaelbrown",
    "headline": "CTO at StartupXYZ",
    "company": "StartupXYZ",
    "location": "New York, NY"
}
```

---

#### 6. Bulk Import Prospects

**Endpoint:** `POST /api/prospects/bulk`

This is the key endpoint the Chrome extension will use!

**Steps:**
1. Open the **Bulk Import Prospects** request
2. Review the body (contains 2 prospects):
```json
{
    "prospects": [
        {
            "full_name": "Michael Brown",
            "profile_url": "https://linkedin.com/in/michaelbrown",
            "headline": "CTO at StartupXYZ",
            "company": "StartupXYZ",
            "location": "New York, NY"
        },
        {
            "full_name": "Sarah Wilson",
            "profile_url": "https://linkedin.com/in/sarahwilson",
            "headline": "VP Marketing at BigCorp",
            "company": "BigCorp",
            "location": "Austin, TX"
        }
    ]
}
```
3. Click **Send**

**Expected Response (201 Created):**
```json
{
    "message": "Bulk import completed",
    "created": 1,
    "skipped": 1,
    "prospects": [
        {
            "id": 3,
            "full_name": "Sarah Wilson",
            ...
        }
    ]
}
```

**What Happened:**
- Michael Brown was **skipped** (already exists from step 5)
- Sarah Wilson was **created** (new prospect)
- Deduplication works based on `profile_url`

---

#### 7. Get All Prospects

**Endpoint:** `GET /api/prospects`

**Steps:**
1. Open the **Get All Prospects** request
2. Click **Send**

**Expected Response (200 OK):**
```json
{
    "data": [
        {
            "id": 3,
            "full_name": "Sarah Wilson",
            ...
        },
        {
            "id": 2,
            "full_name": "Michael Brown",
            ...
        },
        {
            "id": 1,
            "full_name": "Jane Smith",
            ...
        }
    ],
    "links": {...},
    "meta": {
        "current_page": 1,
        "per_page": 15,
        "total": 3
    }
}
```

**Pagination:**
- Results are paginated (default 15 per page)
- Newest prospects appear first

---

#### 8. Filter Prospects by Connection Status

**Endpoint:** `GET /api/prospects?connection_status=not_connected`

**Steps:**
1. Open the **Get All Prospects** request
2. In the **Params** tab, enable the `connection_status` parameter
3. Set value to `not_connected`
4. Click **Send**

**Expected:** Only prospects with `connection_status: "not_connected"`

**Try Other Statuses:**
- `pending` - Connection request sent
- `connected` - Connected on LinkedIn
- `withdrawn` - Connection request withdrawn

---

#### 9. Search Prospects

**Endpoint:** `GET /api/prospects?search=CEO`

**Steps:**
1. Open the **Get All Prospects** request
2. Enable the `search` parameter
3. Set value to `CEO`
4. Click **Send**

**Expected:** Only prospects with "CEO" in name, company, or headline

**Try Other Searches:**
- `TechCorp` - Find by company
- `San Francisco` - Find by location
- `Jane` - Find by name

---

#### 10. Update a Prospect

**Endpoint:** `PUT /api/prospects/{id}`

**Steps:**
1. Open the **Update Prospect** request
2. Change ID to `1` in the URL
3. Update the body:
```json
{
    "connection_status": "pending",
    "notes": "Sent connection request on 2025-11-29"
}
```
4. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Prospect updated successfully",
    "prospect": {
        "id": 1,
        "connection_status": "pending",
        "notes": "Sent connection request on 2025-11-29",
        ...
    }
}
```

---

### Part 3: Tag Attachment

Now let's attach tags to prospects.

#### 11. Attach Tags to Prospect

**Endpoint:** `POST /api/prospects/{id}/tags`

**Steps:**
1. Open the **Attach Tags to Prospect** request
2. Change ID to `1` in the URL
3. Body should have tag IDs:
```json
{
    "tag_ids": [1, 2]
}
```
4. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Tags attached successfully",
    "prospect": {
        "id": 1,
        "full_name": "Jane Smith",
        "tags": [
            {
                "id": 1,
                "name": "Hot Lead - Priority",
                "color": "#dc2626"
            },
            {
                "id": 2,
                "name": "CEO",
                "color": "#3b82f6"
            }
        ],
        ...
    }
}
```

**Try Multiple Times:**
Running this again won't create duplicates - tags are attached only once.

---

#### 12. Filter Prospects by Tag

**Endpoint:** `GET /api/prospects?tag_id=1`

**Steps:**
1. Open the **Get All Prospects** request
2. Enable the `tag_id` parameter
3. Set value to `1`
4. Click **Send**

**Expected:** Only prospects that have tag ID 1 attached.

---

#### 13. Remove Tag from Prospect

**Endpoint:** `DELETE /api/prospects/{prospectId}/tags/{tagId}`

**Steps:**
1. Open the **Remove Tag from Prospect** request
2. Set prospect ID to `1` and tag ID to `2` in the URL
3. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Tag removed successfully",
    "prospect": {
        "id": 1,
        "tags": [
            {
                "id": 1,
                "name": "Hot Lead - Priority",
                ...
            }
        ]
    }
}
```

Tag ID 2 (CEO) should be removed, only tag ID 1 remains.

---

#### 14. Get Prospect Statistics

**Endpoint:** `GET /api/prospects/stats`

**Steps:**
1. Open the **Get Prospect Stats** request
2. Click **Send**

**Expected Response (200 OK):**
```json
{
    "stats": {
        "total": 3,
        "not_connected": 2,
        "pending": 1,
        "connected": 0
    }
}
```

**Use Case:** Display dashboard statistics showing prospect counts.

---

#### 15. Delete a Prospect

**Endpoint:** `DELETE /api/prospects/{id}`

**Steps:**
1. Open the **Delete Prospect** request
2. Change ID to `3` in the URL
3. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Prospect deleted successfully"
}
```

**Verify:**
- Run `GET /api/prospects` again
- Prospect ID 3 should be gone
- Total count should be 2

---

#### 16. Delete a Tag

**Endpoint:** `DELETE /api/tags/{id}`

**Steps:**
1. Open the **Delete Tag** request
2. Change ID to `3` in the URL
3. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Tag deleted successfully"
}
```

**What Happens:**
- Tag is deleted
- All prospect associations are removed automatically (cascade)
- Prospects remain, just lose this tag

---

## Complete Test Sequence

Run this full flow to verify everything:

1. ✅ **Create 3 tags** (Hot Lead, CEO, Marketing)
2. ✅ **Create 1 prospect manually** (Jane Smith)
3. ✅ **Bulk import 2 prospects** (Michael + Sarah)
4. ✅ **Verify bulk import** shows 1 created, 1 skipped (Michael duplicate)
5. ✅ **Get all prospects** → Should show 3 total
6. ✅ **Attach 2 tags to Jane** (Hot Lead + CEO)
7. ✅ **Filter by tag** → Only shows Jane
8. ✅ **Search for "CEO"** → Shows Jane and any others with CEO in data
9. ✅ **Update Michael** → Change status to "pending"
10. ✅ **Get stats** → Shows breakdown by status
11. ✅ **Remove one tag from Jane** → Verify it's removed
12. ✅ **Delete Sarah** → Verify she's gone
13. ✅ **Delete a tag** → Verify prospects still exist

---

## Testing Validation Errors

### Duplicate Tag Name

**Create tag with existing name:**
```json
{
    "name": "Hot Lead",
    "color": "#000000"
}
```

**Expected:** `422` with error:
```json
{
    "message": "You already have a tag with this name.",
    "errors": {
        "name": ["You already have a tag with this name."]
    }
}
```

---

### Invalid Hex Color

**Create tag with invalid color:**
```json
{
    "name": "New Tag",
    "color": "red"
}
```

**Expected:** `422` with error about hex color format.

---

### Duplicate Prospect URL

**Create prospect with existing URL:**
```json
{
    "full_name": "Jane Doe",
    "profile_url": "https://linkedin.com/in/janesmith"
}
```

**Expected:** `422` with error:
```json
{
    "errors": {
        "profile_url": ["You have already added this prospect."]
    }
}
```

---

### Missing Required Fields

**Create prospect without full_name:**
```json
{
    "profile_url": "https://linkedin.com/in/test"
}
```

**Expected:** `422` with validation error about required field.

---

### Bulk Import Max Limit

**Try importing 101 prospects** (max is 100):

**Expected:** `422` with error about max 100 prospects.

---

### Invalid Tag IDs

**Attach non-existent tag:**
```json
{
    "tag_ids": [999]
}
```

**Expected:** `422` with error about invalid tag ID.

---

## Database Verification

After testing, check the database:

1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Select database: `linkedin_automation`
3. Check `prospects` table - should see your test data
4. Check `tags` table - should see created tags
5. Check `prospect_tag` table - should see tag associations

---

## Troubleshooting

### 401 Unauthenticated

**Problem:** All requests return 401

**Solution:**
1. Run Phase 1 **Login** request
2. Copy the token from response
3. Update `auth_token` in environment
4. Try again

---

### 404 Not Found

**Problem:** Endpoint returns 404

**Solution:**
1. Check the URL - should be `http://localhost:8000/api/...`
2. Verify server is running: `php artisan serve`
3. Check route exists: `php artisan route:list --path=api`

---

### 422 Validation Error

**Problem:** Request rejected with validation errors

**Solution:**
1. Read the error message - it tells you what's wrong
2. Check required fields are present
3. Verify data formats (URLs, emails, etc.)
4. Check for duplicates if relevant

---

### Prospect Count Doesn't Update

**Problem:** Tag's `prospects_count` is 0 even after attaching

**Solution:**
- This is lazy-loaded
- Use `GET /api/tags` endpoint (loads count automatically)
- Or `GET /api/tags/{id}` for single tag

---

## Expected Test Results

| Test | Expected Status | Expected Behavior |
|------|----------------|-------------------|
| Create tag | 201 | Tag created with ID |
| Create duplicate tag name | 422 | Validation error |
| Get all tags | 200 | Array of tags with counts |
| Update tag | 200 | Tag updated |
| Delete tag | 200 | Tag deleted, associations removed |
| Create prospect | 201 | Prospect created |
| Create duplicate prospect URL | 422 | Validation error |
| Bulk import (all new) | 201 | All prospects created |
| Bulk import (some duplicates) | 201 | Shows created + skipped counts |
| Get all prospects | 200 | Paginated list |
| Filter by status | 200 | Filtered results |
| Filter by tag | 200 | Only tagged prospects |
| Search prospects | 200 | Matching prospects |
| Update prospect | 200 | Prospect updated |
| Attach tags | 200 | Tags added to prospect |
| Remove tag | 200 | Tag removed from prospect |
| Get stats | 200 | Counts by status |
| Delete prospect | 200 | Prospect deleted |

---

**Phase 2 Testing Status:** ✅ Complete

**Next:** Review CODE_GUIDE.md to understand how the code works, then proceed to Phase 3 (Chrome Extension).
