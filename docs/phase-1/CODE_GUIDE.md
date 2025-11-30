# Phase 1 Code Guide

Comprehensive guide explaining the architecture, design decisions, concepts, and approach used in Phase 1.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Pattern](#architecture-pattern)
3. [Database Design](#database-design)
4. [Authentication Flow](#authentication-flow)
5. [Code Organization](#code-organization)
6. [Key Concepts](#key-concepts)
7. [Design Decisions](#design-decisions)
8. [Security Considerations](#security-considerations)

---

## Overview

Phase 1 establishes the **backend foundation** for the LinkedIn automation platform. It implements:

- ✅ RESTful API with Laravel 11
- ✅ Token-based authentication using Laravel Sanctum
- ✅ Complete database schema (8 tables)
- ✅ Service Layer Pattern for business logic
- ✅ Form Request Validation
- ✅ API Resources for response transformation

**Why this approach?**
- **Modular:** Each component has a single responsibility
- **Testable:** Business logic separated from controllers
- **Scalable:** Easy to extend in future phases
- **Secure:** Password hashing, encrypted cookies, token auth

---

## Architecture Pattern

We use the **Service Layer Pattern** (also called Repository/Service pattern):

```
Request → Route → Controller → Service → Model → Database
                      ↓
                  Response ← Resource ← Service
```

### Why Service Layer?

**Traditional approach (MVC only):**
```php
// Fat controller - business logic mixed with HTTP handling
class LoginController {
    public function login(Request $request) {
        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages(['email' => 'Invalid']);
        }
        $token = $user->createToken('api-token')->plainTextToken;
        return response()->json(['token' => $token]);
    }
}
```

**Our approach (MVC + Service):**
```php
// Thin controller - delegates to service
class LoginController {
    public function __invoke(LoginRequest $request) {
        $result = $this->authService->login($request->validated());
        return response()->json([
            'user' => new UserResource($result['user']),
            'token' => $result['token']
        ]);
    }
}

// Service - contains business logic
class AuthService {
    public function login(array $credentials): array {
        // All authentication logic here
    }
}
```

**Benefits:**
1. **Reusability:** Service can be used by multiple controllers
2. **Testing:** Easy to unit test service logic
3. **Clarity:** Controller only handles HTTP, service handles business rules
4. **Maintenance:** Business logic in one place

---

## Database Design

### Overview of 8 Tables

```
users (authentication)
  ↓ 1-to-1
linkedin_accounts (LinkedIn profiles)

users (owns prospects)
  ↓ 1-to-many
prospects (extracted leads)
  ↕ many-to-many
tags (categorization)

users (owns campaigns)
  ↓ 1-to-many
campaigns (automation)
  ↕ many-to-many (via campaign_prospects)
prospects (leads in campaigns)

campaigns → action_queue (scheduled actions)
```

### Table Relationships Explained

#### 1. users ↔ linkedin_accounts (1-to-1)

**Why 1-to-1?**
- MVP: Each user has exactly ONE LinkedIn account
- Simplifies the codebase for now
- Can be changed to 1-to-many in future (workspaces feature)

**Implementation:**
```php
// In User model
public function linkedInAccount() {
    return $this->hasOne(LinkedInAccount::class);
}

// Usage:
$user->linkedInAccount; // Get the connected LinkedIn profile
```

#### 2. prospects ↔ tags (many-to-many)

**Why many-to-many?**
- A prospect can have multiple tags (e.g., "CEO", "Hot Lead")
- A tag can be applied to multiple prospects
- Classic use case for pivot table

**Implementation:**
```php
// In Prospect model
public function tags() {
    return $this->belongsToMany(Tag::class, 'prospect_tag')
        ->withTimestamps();
}

// Usage:
$prospect->tags; // Get all tags for this prospect
$prospect->tags()->attach($tagId); // Add a tag
$prospect->tags()->detach($tagId); // Remove a tag
```

#### 3. campaigns ↔ prospects (many-to-many with extra data)

**Why extra columns in pivot?**
- Need to track status PER prospect in EACH campaign
- Example: Prospect A in Campaign 1 might be "completed"
- Same Prospect A in Campaign 2 might be "pending"
- Standard pivot table can't handle this

**Implementation:**
```php
// In Campaign model
public function prospects() {
    return $this->belongsToMany(Prospect::class, 'campaign_prospects')
        ->withPivot('status', 'failure_reason', 'processed_at')
        ->withTimestamps();
}

// Usage:
$campaign->prospects()->first()->pivot->status; // "completed"
```

### Database Normalization

**3rd Normal Form (3NF):**
- ✅ No duplicate data
- ✅ Separate tables for separate entities
- ✅ Relationships via foreign keys

**Example of good normalization:**

Instead of storing tags as CSV in prospects:
```sql
-- BAD: Denormalized
prospects: id, name, tags (CSV: "CEO,Hot Lead,Marketing")
```

We use a pivot table:
```sql
-- GOOD: Normalized
prospects: id, name
tags: id, name
prospect_tag: prospect_id, tag_id
```

**Why?**
- Can't easily query "all prospects with tag X"
- Can't enforce referential integrity
- Updating a tag name requires updating all prospects

---

## Authentication Flow

### Registration Flow

```
1. User submits: name, email, password, password_confirmation
   ↓
2. RegisterRequest validates the input
   ↓
3. RegisterController receives validated data
   ↓
4. Calls AuthService->register()
   ↓
5. Service creates user in database (password auto-hashed)
   ↓
6. Service generates Sanctum token
   ↓
7. Controller transforms user with UserResource
   ↓
8. Returns JSON: { user, token }
```

**Code walkthrough:**

```php
// 1. Request hits this route
Route::post('/register', RegisterController::class);

// 2. RegisterRequest validates automatically
class RegisterRequest extends FormRequest {
    public function rules(): array {
        return [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'min:8', 'confirmed'],
        ];
    }
}

// 3. Controller receives only validated data
class RegisterController {
    public function __invoke(RegisterRequest $request) {
        $user = $this->authService->register($request->validated());
        // validated() only returns: name, email, password
        // All invalid data rejected before reaching here
    }
}

// 4. Service handles business logic
class AuthService {
    public function register(array $data): User {
        // Create user (password hashed automatically)
        $user = User::create($data);
        return $user;
    }
}

// 5. Password hashing happens in User model
class User {
    protected function casts(): array {
        return [
            'password' => 'hashed', // Laravel 11 auto-hashing
        ];
    }
}
```

**Why this is secure:**
- Password never stored in plain text
- Validation happens before business logic
- Hashing handled by Laravel (uses bcrypt)
- No SQL injection (Eloquent uses prepared statements)

### Login Flow

```
1. User submits: email, password
   ↓
2. LoginRequest validates
   ↓
3. LoginController calls AuthService->login()
   ↓
4. Service finds user by email
   ↓
5. Service checks password with Hash::check()
   ↓
6. If valid, creates Sanctum token
   ↓
7. Returns: { user, token }
```

**Code walkthrough:**

```php
// AuthService->login()
public function login(array $credentials): array {
    // Find user
    $user = User::where('email', $credentials['email'])->first();

    // Verify password
    if (!$user || !Hash::check($credentials['password'], $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect.'],
        ]);
    }

    // Generate token
    $token = $user->createToken('api-token')->plainTextToken;

    return ['user' => $user, 'token' => $token];
}
```

**How Sanctum tokens work:**

1. `createToken()` generates a random token (SHA-256 hash)
2. Token saved in `personal_access_tokens` table
3. Returns the **plain text** token ONCE (can't retrieve again)
4. Client stores this token
5. Client includes in requests: `Authorization: Bearer {token}`
6. Sanctum middleware validates token on each request

### Protected Route Flow

```
1. Client sends: GET /api/user
   Header: Authorization: Bearer {token}
   ↓
2. Sanctum middleware intercepts
   ↓
3. Finds token in personal_access_tokens table
   ↓
4. If valid, loads associated user
   ↓
5. Injects user into $request->user()
   ↓
6. Controller can access authenticated user
```

**Code:**

```php
// In routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return new UserResource($request->user());
        // $request->user() is automatically available
    });
});
```

### Logout Flow

```
1. Client sends: POST /api/logout (with Bearer token)
   ↓
2. Sanctum middleware authenticates
   ↓
3. LogoutController calls AuthService->logout()
   ↓
4. Service revokes token: $user->currentAccessToken()->delete()
   ↓
5. Token deleted from database
   ↓
6. Future requests with this token will fail (401)
```

---

## Code Organization

### Directory Structure

```
app/
├── Http/
│   ├── Controllers/Auth/
│   │   ├── RegisterController.php    # Handles registration
│   │   ├── LoginController.php       # Handles login
│   │   └── LogoutController.php      # Handles logout
│   ├── Requests/Auth/
│   │   ├── RegisterRequest.php       # Validates registration input
│   │   └── LoginRequest.php          # Validates login input
│   └── Resources/
│       └── UserResource.php          # Transforms user data for API
├── Models/
│   ├── User.php                      # User model + relationships
│   ├── LinkedInAccount.php           # LinkedIn profile model
│   ├── Prospect.php                  # Prospect (lead) model
│   ├── Tag.php                       # Tag model
│   ├── Campaign.php                  # Campaign model
│   ├── CampaignProspect.php          # Pivot model
│   └── ActionQueue.php               # Action queue model
└── Services/
    └── AuthService.php               # Authentication business logic
```

### Why This Structure?

**Controllers grouped by feature:**
```
Auth/
├── RegisterController.php
├── LoginController.php
└── LogoutController.php
```

**Benefits:**
- Easy to find related code
- Scales well (can add Prospect/, Campaign/ folders later)
- Clear module boundaries

**Single-action controllers:**
```php
class RegisterController {
    public function __invoke(RegisterRequest $request) {
        // One responsibility: handle registration
    }
}
```

**Why `__invoke()`?**
- Controller has ONE action → cleaner routes
- Route: `Route::post('/register', RegisterController::class);`
- Instead of: `Route::post('/register', [RegisterController::class, 'register']);`

---

## Key Concepts

### 1. Dependency Injection

Laravel automatically injects dependencies:

```php
class RegisterController {
    // Laravel sees AuthService type hint
    public function __construct(AuthService $authService) {
        $this->authService = $authService;
    }
    // Laravel creates AuthService instance and injects it
}
```

**Benefits:**
- No need for `new AuthService()`
- Easy to mock for testing
- Promotes loose coupling

### 2. Form Request Validation

Instead of validating in controller:

```php
// BAD: Validation in controller
public function register(Request $request) {
    $validated = $request->validate([
        'email' => 'required|email|unique:users',
        'password' => 'required|min:8|confirmed',
    ]);
}
```

We use Form Requests:

```php
// GOOD: Dedicated validation class
class RegisterRequest extends FormRequest {
    public function rules(): array {
        return [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'min:8', 'confirmed'],
        ];
    }
}

// Controller just receives validated data
public function register(RegisterRequest $request) {
    $validated = $request->validated(); // Already validated!
}
```

**Benefits:**
- Reusable validation logic
- Custom error messages in one place
- Authorization logic: `authorize()` method
- Keeps controller clean

### 3. API Resources

Transform model data for API responses:

```php
// Without Resource: Exposes ALL fields
return $user; // Includes password hash!

// With Resource: Control what's exposed
class UserResource extends JsonResource {
    public function toArray(Request $request): array {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            // password NOT included
        ];
    }
}

return new UserResource($user); // Safe!
```

**Benefits:**
- Hide sensitive data (passwords, tokens)
- Consistent API response format
- Transform data (e.g., format dates)
- Easy to version (UserResourceV2)

### 4. Eloquent Relationships

Define relationships in models:

```php
// User model
public function prospects() {
    return $this->hasMany(Prospect::class);
}

// Usage in controller
$user = auth()->user();
$prospects = $user->prospects; // All prospects for this user

// Eager loading (prevents N+1 queries)
$users = User::with('prospects')->get();
```

**Benefits:**
- Clean syntax
- Auto-handles foreign keys
- Lazy loading (loads when accessed)
- Eager loading (loads upfront)

### 5. Model Casts

Automatically transform attributes:

```php
class User {
    protected function casts(): array {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}

// Usage
$user->password = 'plain-text'; // Automatically hashed
$user->email_verified_at; // Returns Carbon instance
```

**Benefits:**
- No manual transformations
- Type safety
- Consistent behavior

---

## Design Decisions

### Why Laravel 11?

1. **Latest version:** Modern PHP features, better performance
2. **Sanctum built-in:** Token auth without external packages
3. **Eloquent ORM:** Clean database interactions
4. **Migration system:** Version control for database
5. **Well-documented:** Large community, easy to find help

### Why Sanctum over JWT?

| Feature | Sanctum | JWT |
|---------|---------|-----|
| Setup | Simple, built-in | Requires package |
| Token storage | Database | Stateless |
| Revocation | Easy (delete row) | Hard (needs blacklist) |
| Best for | SPA + Mobile | Stateless APIs |

**Our use case:**
- Extension needs to logout → Must revoke token
- SPA will need sessions too
- Sanctum handles both

**How Sanctum works:**
1. Generates random token
2. Stores hash in database
3. Returns plain token to client
4. Client sends token with each request
5. Sanctum validates against database

### Why Database Queue?

**Options:**
- Redis (in-memory, fast)
- Database (uses MySQL)
- Sync (no queue, immediate)

**We chose database:**
- ✅ No extra dependencies (MySQL already installed)
- ✅ Persistent (survives restarts)
- ✅ Good enough for MVP
- ✅ Easy to debug (can query queue table)

**Can upgrade to Redis later** when we need:
- Higher throughput
- Better performance
- More advanced features

### Why Explicit Table Names?

```php
protected $table = 'linkedin_accounts';
```

**Why specify?**
- Laravel auto-pluralizes: `LinkedInAccount` → `linked_in_accounts`
- Explicit naming prevents confusion
- Makes table names searchable in code

### Why API Resources?

We could return models directly:

```php
return $user; // Returns ALL fields
```

But API Resources provide:
1. **Security:** Hide sensitive fields
2. **Consistency:** Same format everywhere
3. **Flexibility:** Easy to add computed fields
4. **Versioning:** Different resources for different API versions

---

## Security Considerations

### 1. Password Security

**Implementation:**
```php
// In User model
protected function casts(): array {
    return [
        'password' => 'hashed', // Laravel 11 feature
    ];
}
```

**What happens:**
- Plain password → bcrypt hash (60 characters)
- Cost factor: 12 (configurable in config/hashing.php)
- Rainbow tables useless (salt included in hash)

**Verification:**
```php
Hash::check($plainPassword, $user->password)
// Uses timing-safe comparison (prevents timing attacks)
```

### 2. Mass Assignment Protection

**The problem:**
```php
User::create($request->all());
// If request includes 'is_admin' => true, user becomes admin!
```

**Our solution:**
```php
// In User model
protected $fillable = ['name', 'email', 'password'];
// Only these fields can be mass-assigned

// In controller
User::create($request->validated());
// validated() only includes defined rules
```

### 3. SQL Injection Prevention

**Laravel prevents by default:**
```php
// Safe: Uses prepared statements
User::where('email', $email)->first();

// Even this is safe:
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
```

**Never do this:**
```php
// UNSAFE: Direct concatenation
DB::select("SELECT * FROM users WHERE email = '$email'");
```

### 4. Token Security

**Sanctum tokens:**
- Stored as SHA-256 hash in database
- Plain token shown only ONCE (during creation)
- Can't retrieve plain token later
- Transmitted over HTTPS (in production)

**Best practices:**
```php
// Client should store token securely
// Browser: httpOnly cookie (can't access from JS)
// Extension: Chrome storage (encrypted)
// Never: localStorage (XSS vulnerable)
```

### 5. CORS (Future Phase)

When frontend/extension connects:

```php
// Will need to configure CORS in config/cors.php
'allowed_origins' => [
    'chrome-extension://your-extension-id',
    'http://localhost:3000', // React dev server
],
```

---

## What's Next?

Phase 1 is complete! Here's what we built:

✅ Laravel 11 API with MySQL
✅ 8 database tables (users, prospects, campaigns, etc.)
✅ Sanctum token authentication
✅ Service Layer architecture
✅ Form Request validation
✅ API Resources
✅ Complete documentation

**Phase 2 will add:**
- Prospect CRUD (Create, Read, Update, Delete)
- Tag management
- Filtering and search
- Bulk operations

**How to extend this code:**

1. **Add new endpoint:**
   - Create Controller in `app/Http/Controllers/`
   - Create Service in `app/Services/`
   - Add route in `routes/api.php`

2. **Add validation:**
   - Create FormRequest in `app/Http/Requests/`
   - Define rules in `rules()` method

3. **Transform response:**
   - Create Resource in `app/Http/Resources/`
   - Define fields in `toArray()` method

---

**Last Updated:** 2025-11-29
**Phase:** 1 - Backend Foundation
**Status:** ✅ Complete
