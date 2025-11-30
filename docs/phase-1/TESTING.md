# Phase 1 Testing Guide

Step-by-step guide to test all authentication endpoints using Postman.

## Prerequisites

1. Laravel server is running: `php artisan serve`
2. MySQL is running in XAMPP
3. Postman is installed
4. Migrations have been completed

## Import Postman Collection

1. Open Postman
2. Click **Import** button
3. Select file: `docs/phase-1/postman_collection.json`
4. Collection **"LinkedIn Automation - Phase 1"** will appear

## Create Postman Environment (Optional but Recommended)

This automatically saves your auth token for protected routes.

1. Click **Environments** in left sidebar
2. Click **+** to create new environment
3. Name it: `LinkedIn Automation - Local`
4. Add variables:
   - `base_url` = `http://localhost:8000/api`
   - `auth_token` = (leave empty, will be auto-filled)
   - `user_id` = (leave empty, will be auto-filled)
5. Click **Save**
6. Select this environment from dropdown (top right)

## Test Flow

Follow this order to test all endpoints:

### 1. Test Registration

**Endpoint:** `POST /api/register`

**Steps:**
1. Open the **Register** request
2. Go to **Body** tab
3. Review the JSON data:
```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "password_confirmation": "password123"
}
```
4. Click **Send**

**Expected Response (201 Created):**
```json
{
    "message": "Registration successful",
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "email_verified_at": null,
        "created_at": "2025-11-29T10:00:00.000000Z",
        "updated_at": "2025-11-29T10:00:00.000000Z"
    },
    "token": "1|abcdefghijklmnopqrstuvwxyz..."
}
```

**What Happens:**
- New user created in `users` table
- Password automatically hashed
- Sanctum token generated
- Token saved to environment variable (if using environment)

**Common Errors:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 422 | Email already exists | Email is not unique | Use different email |
| 422 | Password confirmation mismatch | Passwords don't match | Fix password_confirmation |
| 422 | Password too short | Less than 8 chars | Use longer password |
| 500 | Database error | MySQL not running | Start MySQL in XAMPP |

---

### 2. Test Login

**Endpoint:** `POST /api/login`

**Steps:**
1. Open the **Login** request
2. Go to **Body** tab
3. Use the same email/password from registration:
```json
{
    "email": "john@example.com",
    "password": "password123"
}
```
4. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Login successful",
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        ...
    },
    "token": "2|xyz123..."
}
```

**What Happens:**
- Credentials validated against database
- New Sanctum token generated (different from registration)
- Old token still works (until revoked)
- Token saved to environment variable

**Common Errors:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 422 | Invalid credentials | Wrong email or password | Check credentials |
| 422 | Validation error | Missing email/password | Include both fields |

**Test Invalid Login:**
Try with wrong password:
```json
{
    "email": "john@example.com",
    "password": "wrongpassword"
}
```
Should return: `422 Unprocessable Entity`

---

### 3. Test Get Authenticated User

**Endpoint:** `GET /api/user`

**Important:** This route requires authentication!

**Steps:**
1. Open the **Get Authenticated User** request
2. Go to **Headers** tab
3. Verify the Authorization header:
   - Key: `Authorization`
   - Value: `Bearer {{auth_token}}` (if using environment)
   - OR manually: `Bearer 1|abcdefghijk...` (your actual token)
4. Click **Send**

**Expected Response (200 OK):**
```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "email_verified_at": null,
    "created_at": "2025-11-29T10:00:00.000000Z",
    "updated_at": "2025-11-29T10:00:00.000000Z"
}
```

**What Happens:**
- Sanctum validates the token
- Returns authenticated user's data
- Password is hidden (not returned)

**Common Errors:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 401 | Unauthenticated | Missing or invalid token | Add Bearer token |
| 401 | Token expired | Token was revoked | Login again |

**Test Without Token:**
1. Remove the Authorization header
2. Click **Send**
3. Should return: `401 Unauthenticated`

---

### 4. Test Logout

**Endpoint:** `POST /api/logout`

**Important:** Requires authentication!

**Steps:**
1. Open the **Logout** request
2. Verify Authorization header is present: `Bearer {{auth_token}}`
3. Click **Send**

**Expected Response (200 OK):**
```json
{
    "message": "Logout successful"
}
```

**What Happens:**
- Current access token is deleted from database
- User must login again to get a new token
- The deleted token can no longer be used

**Verification:**
After logout, try using the **Get Authenticated User** request again:
- Should return: `401 Unauthenticated`
- The old token no longer works

---

## Complete Test Sequence

Run this full sequence to verify everything works:

1. **Register** a new user → Save token
2. **Get User** with the token → Verify user data
3. **Logout** → Revoke token
4. **Get User** again → Should fail (401)
5. **Login** with same credentials → Get new token
6. **Get User** with new token → Should work

## Testing Validation

### Test Email Validation

**Register with invalid email:**
```json
{
    "name": "Test User",
    "email": "notanemail",
    "password": "password123",
    "password_confirmation": "password123"
}
```

**Expected:** `422` with error:
```json
{
    "message": "Please provide a valid email address.",
    "errors": {
        "email": ["Please provide a valid email address."]
    }
}
```

### Test Password Length

**Register with short password:**
```json
{
    "name": "Test User",
    "email": "test@example.com",
    "password": "123",
    "password_confirmation": "123"
}
```

**Expected:** `422` with error:
```json
{
    "errors": {
        "password": ["Password must be at least 8 characters."]
    }
}
```

### Test Unique Email

**Register with existing email:**
```json
{
    "name": "Another User",
    "email": "john@example.com",
    "password": "password123",
    "password_confirmation": "password123"
}
```

**Expected:** `422` with error:
```json
{
    "errors": {
        "email": ["This email is already registered."]
    }
}
```

## Database Verification

After testing, verify data in phpMyAdmin:

1. Open: `http://localhost/phpmyadmin`
2. Select database: `linkedin_automation`
3. Check `users` table:
   - Should see your registered user
   - Password should be hashed (starts with `$2y$`)
4. Check `personal_access_tokens` table:
   - Should see Sanctum tokens
   - Logout should delete the token

## Troubleshooting

### No Response

**Problem:** Request times out or no response

**Solutions:**
1. Verify Laravel server is running: `php artisan serve`
2. Check the base URL: `http://localhost:8000/api`
3. Try in browser first: `http://localhost:8000/up`

### 500 Internal Server Error

**Problem:** Server error

**Solutions:**
1. Check Laravel logs: `backend/storage/logs/laravel.log`
2. Enable debug mode in `.env`: `APP_DEBUG=true`
3. Clear cache: `php artisan config:clear`

### Token Not Saved

**Problem:** `auth_token` variable stays empty

**Solutions:**
1. Check environment is selected (top right in Postman)
2. Go to request **Tests** tab, verify script exists
3. Manually copy token from response and paste into environment

### CORS Errors (Future Phase)

When testing from frontend/extension, you may need CORS configuration. This will be covered in later phases.

## Testing Tips

1. **Use Variables:** Always use `{{base_url}}` and `{{auth_token}}` variables
2. **Test Errors:** Don't just test success cases, test validation errors too
3. **Check Database:** Verify data is actually saved in MySQL
4. **Read Logs:** Check `storage/logs/laravel.log` when something fails
5. **Postman Console:** View full request/response in Postman Console (bottom)

## Expected Test Results

| Test | Expected Status | Expected Behavior |
|------|----------------|-------------------|
| Register new user | 201 | User created, token returned |
| Register duplicate email | 422 | Validation error |
| Login valid credentials | 200 | Token returned |
| Login invalid credentials | 422 | Validation error |
| Get user with token | 200 | User data returned |
| Get user without token | 401 | Unauthenticated |
| Logout with token | 200 | Success message |
| Use revoked token | 401 | Unauthenticated |

---

**Phase 1 Testing Status:** ✅ Complete

**Next:** Review the code architecture in `CODE_GUIDE.md`
