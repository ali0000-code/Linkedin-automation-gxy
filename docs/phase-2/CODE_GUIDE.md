# Phase 2 Code Guide

Comprehensive guide explaining the architecture, design decisions, concepts, and approach used in Phase 2.

## Table of Contents

1. [Overview](#overview)
2. [What Was Built](#what-was-built)
3. [Service Layer Deep Dive](#service-layer-deep-dive)
4. [Request Validation Strategy](#request-validation-strategy)
5. [Resource Transformation](#resource-transformation)
6. [Controller Design](#controller-design)
7. [Key Features Explained](#key-features-explained)
8. [Design Decisions](#design-decisions)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## Overview

Phase 2 adds complete **Prospect and Tag Management** to the LinkedIn automation platform. It builds on Phase 1's authentication foundation and implements:

- ✅ Full CRUD for prospects (LinkedIn leads)
- ✅ Full CRUD for tags (categorization)
- ✅ Bulk prospect import (for Chrome extension)
- ✅ Advanced filtering and search
- ✅ Tag attachment/detachment
- ✅ Statistics aggregation

**Why this matters:**
- Extension needs bulk import to save extracted LinkedIn profiles
- Users need to organize prospects with tags
- Dashboard needs filtering/search for large prospect lists
- Statistics provide quick insights

---

## What Was Built

### Services (Business Logic Layer)

#### 1. ProspectService
**File:** `backend/app/Services/ProspectService.php`

**Responsibilities:**
- Get prospects with filters/search/pagination
- Create single prospect
- Bulk import prospects (deduplication logic)
- Update prospect
- Delete prospect
- Attach/detach tags
- Calculate statistics

**Why we created it:**
- Centralizes all prospect logic
- Reusable across controllers (API, future CLI commands, jobs)
- Testable without HTTP layer
- Single source of truth for business rules

**Key Methods:**

```php
// Get paginated prospects with optional filters
public function getProspects(
    User $user,
    array $filters = [],
    int $perPage = 15
): LengthAwarePaginator

// Bulk import with deduplication
public function bulkImport(
    User $user,
    array $prospects
): array {
    // Returns: ['created' => count, 'skipped' => count, 'prospects' => Collection]
}

// Attach tags without creating duplicates
public function attachTags(
    Prospect $prospect,
    array $tagIds
): Prospect
```

---

#### 2. TagService
**File:** `backend/app/Services/TagService.php`

**Responsibilities:**
- Get all tags with prospect counts
- Create tag
- Update tag
- Delete tag
- Check if tag name exists (for validation)

**Why simpler than ProspectService:**
- Tags don't need complex filtering
- No bulk operations required
- Straightforward CRUD

**Key Method:**

```php
// Checks for duplicate tag names per user
public function tagNameExists(
    User $user,
    string $name,
    ?int $excludeTagId = null
): bool
```

This is used by validators to prevent duplicate tag names.

---

### Form Requests (Validation Layer)

We created **6 Form Request classes** to validate input:

#### Prospect Validators

**1. StoreProspectRequest** - Create validation
```php
'profile_url' => [
    'required',
    'string',
    'url',
    'unique:prospects,profile_url,NULL,id,user_id,' . auth()->id()
]
```

**Why this rule?**
- Ensures prospect URL is unique **per user**
- Different users can have the same prospect
- Prevents duplicates within one user's list

**2. UpdateProspectRequest** - Update validation
```php
'profile_url' => [
    'sometimes',  // Optional for updates
    'unique:prospects,profile_url,' . $prospectId . ',id,user_id,' . auth()->id()
]
```

**Difference from create:**
- `sometimes` = field is optional
- Excludes current prospect from uniqueness check

**3. BulkImportProspectsRequest** - Bulk validation
```php
'prospects' => ['required', 'array', 'min:1', 'max:100'],
'prospects.*.full_name' => ['required', 'string', 'max:255'],
'prospects.*.profile_url' => ['required', 'string', 'url', 'max:500'],
```

**Why max 100?**
- Prevents server overload
- Chrome extension extracts ~50 at a time
- Reasonable batch size for processing

**4. AttachTagsRequest** - Tag attachment validation
```php
'tag_ids' => ['required', 'array', 'min:1'],
'tag_ids.*' => ['required', 'integer', 'exists:tags,id'],
```

**Why `exists:tags,id`?**
- Ensures tag IDs actually exist in database
- Prevents attaching invalid tags

---

#### Tag Validators

**1. StoreTagRequest** - Create validation
```php
'name' => [
    'required',
    'string',
    'max:100',
    Rule::unique('tags')->where(function ($query) {
        return $query->where('user_id', auth()->id());
    })
],
'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
```

**Why regex for color?**
- Ensures proper hex format: `#3b82f6`
- Frontend can directly use this color value
- No need for additional validation client-side

**2. UpdateTagRequest** - Update validation
```php
Rule::unique('tags')
    ->where(fn($query) => $query->where('user_id', auth()->id()))
    ->ignore($tagId)
```

**Why ignore current tag?**
- When updating "Hot Lead" to "Hot Lead", shouldn't fail
- Only checks uniqueness against OTHER tags

---

### API Resources (Response Transformation)

#### 1. ProspectResource
**File:** `backend/app/Http/Resources/ProspectResource.php`

**What it does:**
Transforms Prospect model into consistent API response:

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'full_name' => $this->full_name,
        'profile_url' => $this->profile_url,
        // ... all prospect fields
        'tags' => TagResource::collection($this->whenLoaded('tags')),
        'created_at' => $this->created_at,
        'updated_at' => $this->updated_at,
    ];
}
```

**Key feature: `whenLoaded('tags')`**
- Only includes tags if they were eager loaded
- Prevents N+1 queries
- If tags not loaded, field is omitted

**Example responses:**

```json
// Without tags loaded
{
    "id": 1,
    "full_name": "Jane Smith",
    "profile_url": "...",
    "created_at": "..."
}

// With tags loaded
{
    "id": 1,
    "full_name": "Jane Smith",
    "tags": [
        {"id": 1, "name": "Hot Lead", "color": "#ef4444"}
    ],
    "created_at": "..."
}
```

---

#### 2. TagResource
**File:** `backend/app/Http/Resources/TagResource.php`

**Conditional field: `prospects_count`**

```php
'prospects_count' => $this->when(
    isset($this->prospects_count),
    $this->prospects_count
)
```

**Why conditional?**
- Count is only loaded when using `withCount('prospects')`
- Not every query needs the count
- Keeps responses lean

---

### Controllers (HTTP Layer)

#### 1. ProspectController
**File:** `backend/app/Http/Controllers/Prospect/ProspectController.php`

**9 endpoints:**

| Method | Endpoint | Controller Method |
|--------|----------|-------------------|
| GET | /api/prospects | `index()` |
| POST | /api/prospects | `store()` |
| POST | /api/prospects/bulk | `bulkImport()` |
| GET | /api/prospects/stats | `stats()` |
| GET | /api/prospects/{id} | `show()` |
| PUT | /api/prospects/{id} | `update()` |
| DELETE | /api/prospects/{id} | `destroy()` |
| POST | /api/prospects/{id}/tags | `attachTags()` |
| DELETE | /api/prospects/{id}/tags/{tagId} | `detachTag()` |

**Controller Pattern:**

```php
public function store(StoreProspectRequest $request): JsonResponse
{
    // 1. Validation already done by StoreProspectRequest
    // 2. Delegate to service
    $prospect = $this->prospectService->createProspect(
        $request->user(),
        $request->validated()
    );

    // 3. Transform with resource
    // 4. Return JSON response
    return response()->json([
        'message' => 'Prospect created successfully',
        'prospect' => new ProspectResource($prospect->load('tags')),
    ], 201);
}
```

**Why this is clean:**
- ✅ Controller has ONE job: Handle HTTP request/response
- ✅ Validation is automatic (FormRequest)
- ✅ Business logic is in service
- ✅ Response format is consistent (Resource)

---

#### 2. TagController
**File:** `backend/app/Http/Controllers/Tag/TagController.php`

**5 endpoints:**

| Method | Endpoint | Controller Method |
|--------|----------|-------------------|
| GET | /api/tags | `index()` |
| POST | /api/tags | `store()` |
| GET | /api/tags/{id} | `show()` |
| PUT | /api/tags/{id} | `update()` |
| DELETE | /api/tags/{id} | `destroy()` |

**Simpler than ProspectController:**
- No bulk operations
- No statistics
- No complex filtering
- Just basic CRUD

---

## Key Features Explained

### 1. Bulk Import with Deduplication

**How it works:**

```php
public function bulkImport(User $user, array $prospects): array
{
    $created = 0;
    $skipped = 0;
    $importedProspects = [];

    foreach ($prospects as $prospectData) {
        // Check if already exists by profile_url
        $existing = Prospect::where('user_id', $user->id)
            ->where('profile_url', $prospectData['profile_url'])
            ->first();

        if ($existing) {
            $skipped++;  // Skip duplicates
            continue;
        }

        // Create new prospect
        $prospect = $this->createProspect($user, $prospectData);
        $importedProspects[] = $prospect;
        $created++;
    }

    return [
        'created' => $created,
        'skipped' => $skipped,
        'prospects' => collect($importedProspects),
    ];
}
```

**Why this approach?**
- ✅ Prevents duplicates based on profile_url
- ✅ Tells user how many were created vs skipped
- ✅ Doesn't fail if some prospects already exist
- ✅ Idempotent: Running import twice doesn't create duplicates

**Use Case:**
Extension extracts 50 prospects → User clicks "Extract" again on same page → No duplicates created

---

### 2. Advanced Filtering

**ProspectService filtering:**

```php
public function getProspects(User $user, array $filters = [], int $perPage = 15)
{
    $query = Prospect::where('user_id', $user->id)
        ->with('tags'); // Eager load tags

    // Filter by connection status
    if (isset($filters['connection_status'])) {
        $query->where('connection_status', $filters['connection_status']);
    }

    // Filter by tag
    if (isset($filters['tag_id'])) {
        $query->whereHas('tags', function ($q) use ($filters) {
            $q->where('tags.id', $filters['tag_id']);
        });
    }

    // Search across multiple fields
    if (isset($filters['search']) && !empty($filters['search'])) {
        $search = $filters['search'];
        $query->where(function ($q) use ($search) {
            $q->where('full_name', 'LIKE', "%{$search}%")
              ->orWhere('company', 'LIKE', "%{$search}%")
              ->orWhere('headline', 'LIKE', "%{$search}%");
        });
    }

    return $query->orderBy('created_at', 'desc')->paginate($perPage);
}
```

**Why `whereHas` for tags?**
- Filters prospects that HAVE a specific tag
- SQL: `EXISTS (SELECT * FROM tags WHERE tags.id = ?)`
- Efficient for many-to-many relationships

**Why `orWhere` in nested closure?**
```sql
WHERE user_id = 1
  AND (
    full_name LIKE '%CEO%'
    OR company LIKE '%CEO%'
    OR headline LIKE '%CEO%'
  )
```

Without closure:
```sql
WHERE user_id = 1
  AND full_name LIKE '%CEO%'
  OR company LIKE '%CEO%'  -- Wrong! This OR applies to entire query
```

---

### 3. Tag Attachment Logic

**Why use `syncWithoutDetaching`?**

```php
public function attachTags(Prospect $prospect, array $tagIds): Prospect
{
    $prospect->tags()->syncWithoutDetaching($tagIds);
    return $prospect->fresh('tags');
}
```

**Laravel tag methods comparison:**

| Method | Behavior |
|--------|----------|
| `attach([1, 2])` | Add tags, but fails if already attached |
| `sync([1, 2])` | Replace ALL tags with these (removes others) |
| `syncWithoutDetaching([1, 2])` | Add tags, skip if already attached |

**We use `syncWithoutDetaching` because:**
- ✅ Idempotent: Can attach same tags multiple times
- ✅ Doesn't remove existing tags
- ✅ Perfect for "add tag" action in UI

**Example:**
```php
// Prospect has tags: [1, 2]
$prospect->tags()->syncWithoutDetaching([2, 3]);
// Result: [1, 2, 3]  <- Tag 2 not duplicated, Tag 3 added
```

---

### 4. Statistics Aggregation

**Getting prospect stats:**

```php
public function getStats(User $user): array
{
    $total = Prospect::where('user_id', $user->id)->count();

    $notConnected = Prospect::where('user_id', $user->id)
        ->where('connection_status', 'not_connected')->count();

    $pending = Prospect::where('user_id', $user->id)
        ->where('connection_status', 'pending')->count();

    $connected = Prospect::where('user_id', $user->id)
        ->where('connection_status', 'connected')->count();

    return [
        'total' => $total,
        'not_connected' => $notConnected,
        'pending' => $pending,
        'connected' => $connected,
    ];
}
```

**Could be optimized with one query:**

```php
$stats = Prospect::where('user_id', $user->id)
    ->selectRaw('
        COUNT(*) as total,
        SUM(CASE WHEN connection_status = "not_connected" THEN 1 ELSE 0 END) as not_connected,
        SUM(CASE WHEN connection_status = "pending" THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN connection_status = "connected" THEN 1 ELSE 0 END) as connected
    ')
    ->first();
```

**Why we didn't optimize yet?**
- ✅ KISS principle: Keep it simple for MVP
- ✅ Current approach is readable
- ✅ Performance is fine for <10,000 prospects
- ✅ Can optimize later if needed

---

## Design Decisions

### 1. Why Separate Prospect and Tag Controllers?

**We could have done:**
```php
class ProspectController {
    public function createTag() { ... }
    public function getTags() { ... }
}
```

**Why we didn't:**
- ❌ Violates Single Responsibility Principle
- ❌ ProspectController would be massive
- ❌ Hard to find tag-related code
- ❌ Difficult to test independently

**What we did:**
```php
class ProspectController { /* 9 prospect endpoints */ }
class TagController { /* 5 tag endpoints */ }
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to locate tag vs prospect logic
- ✅ Each controller focused on one resource
- ✅ Follows RESTful conventions

---

### 2. Why Profile URL for Deduplication (Not LinkedIn ID)?

**Options we considered:**

| Field | Pro | Con |
|-------|-----|-----|
| linkedin_id | Official LinkedIn ID | Not always available from scraping |
| email | Unique identifier | Not public on LinkedIn |
| profile_url | Always available | Could change if user updates vanity URL |

**We chose profile_url because:**
- ✅ Always available when scraping
- ✅ Stable enough for MVP
- ✅ Users recognize their prospects by URL
- ✅ Can add linkedin_id later as additional check

**Future improvement:**
```php
// Check both profile_url AND linkedin_id
$existing = Prospect::where('user_id', $user->id)
    ->where(function($q) use ($data) {
        $q->where('profile_url', $data['profile_url'])
          ->orWhere('linkedin_id', $data['linkedin_id'] ?? null);
    })->first();
```

---

### 3. Why Max 100 for Bulk Import?

**Too Low (e.g., 10):**
- ❌ Extension needs multiple requests for large extractions
- ❌ More API calls = slower
- ❌ More chances for network errors

**Too High (e.g., 1000):**
- ❌ Long request times (risk of timeout)
- ❌ Large payload size
- ❌ Memory usage on server
- ❌ Hard to debug if something fails

**Sweet spot: 100**
- ✅ LinkedIn search shows ~10-25 results per page
- ✅ Extension can extract 2-4 pages in one request
- ✅ Fast enough (< 1 second processing)
- ✅ Small enough payload (< 100KB)
- ✅ Easy to handle errors

---

### 4. Why Pagination Default 15?

**Common pagination sizes:**
- 10 (too small for prospect lists)
- 15 (good balance)
- 25 (good for data-heavy views)
- 50 (too many for prospect cards)
- 100 (only for exports)

**We chose 15 because:**
- ✅ Shows enough data without scrolling forever
- ✅ Fast loading (1-2 queries)
- ✅ Works well on mobile and desktop
- ✅ User can change via `per_page` parameter

---

## Data Flow Diagrams

### Bulk Import Flow

```
Extension (on LinkedIn)
    ↓
    Scrapes 50 profiles
    ↓
POST /api/prospects/bulk
    ↓
BulkImportProspectsRequest validates
    ↓
ProspectController->bulkImport()
    ↓
ProspectService->bulkImport()
    ├─→ Loop through prospects
    ├─→ Check if profile_url exists
    ├─→ Skip if duplicate
    └─→ Create if new
    ↓
Returns: {created: 45, skipped: 5}
    ↓
Extension shows: "45 new prospects imported!"
```

---

### Filtering Flow

```
Dashboard UI
    ↓
User selects: Status = "pending", Tag = "CEO"
    ↓
GET /api/prospects?connection_status=pending&tag_id=1
    ↓
ProspectController->index()
    ↓
ProspectService->getProspects($user, $filters)
    ↓
Eloquent Query Builder:
    WHERE user_id = 1
    AND connection_status = 'pending'
    AND EXISTS (
        SELECT * FROM prospect_tag
        WHERE prospect_tag.prospect_id = prospects.id
        AND prospect_tag.tag_id = 1
    )
    ↓
Returns paginated results
    ↓
ProspectResource transforms each prospect
    ↓
Dashboard displays filtered prospects
```

---

### Tag Attachment Flow

```
Dashboard UI
    ↓
User clicks "Add Tags" on prospect
    ↓
Selects tags: "Hot Lead" (ID 1), "CEO" (ID 2)
    ↓
POST /api/prospects/5/tags
Body: {tag_ids: [1, 2]}
    ↓
AttachTagsRequest validates tag_ids exist
    ↓
ProspectController->attachTags(5, $request)
    ↓
Service finds Prospect ID 5
    ↓
Service calls: syncWithoutDetaching([1, 2])
    ↓
Database inserts into prospect_tag:
    (prospect_id: 5, tag_id: 1)
    (prospect_id: 5, tag_id: 2)
    ↓
Returns updated prospect with tags loaded
    ↓
Dashboard shows tags on prospect card
```

---

## What We Learned from Phase 1

**Phase 1 patterns we reused:**

1. **Service Layer Pattern**
   - AuthService → ProspectService, TagService
   - Same benefits: Testable, reusable, clear

2. **Form Request Validation**
   - RegisterRequest → StoreProspectRequest, etc.
   - Validation separate from controllers

3. **API Resources**
   - UserResource → ProspectResource, TagResource
   - Consistent response format

4. **Clear Comments**
   - Every method explains what, why, how
   - Future developers (or us!) can understand quickly

**What we improved:**

1. **More Complex Queries**
   - Phase 1: Simple where clauses
   - Phase 2: `whereHas`, `orWhere`, pagination, filtering

2. **Relationship Handling**
   - Phase 1: Basic relationships defined
   - Phase 2: Actually using them (eager loading, `withCount`)

3. **Bulk Operations**
   - Phase 1: One-at-a-time operations
   - Phase 2: Bulk import with deduplication logic

---

## Testing Strategy

**Unit Testing (not implemented yet, but here's how):**

```php
// Test bulk import deduplication
public function test_bulk_import_skips_duplicates()
{
    $user = User::factory()->create();
    $service = new ProspectService();

    // Create existing prospect
    Prospect::factory()->create([
        'user_id' => $user->id,
        'profile_url' => 'https://linkedin.com/in/existing'
    ]);

    // Try to import duplicate + new
    $result = $service->bulkImport($user, [
        ['full_name' => 'Existing', 'profile_url' => 'https://linkedin.com/in/existing'],
        ['full_name' => 'New', 'profile_url' => 'https://linkedin.com/in/new'],
    ]);

    $this->assertEquals(1, $result['created']);
    $this->assertEquals(1, $result['skipped']);
}
```

**Integration Testing:**
- Use Postman collection we created
- Test all endpoints manually
- Verify error handling

---

## Security Considerations

### 1. User Isolation

**Every query includes user_id:**

```php
Prospect::where('user_id', $user->id)->get();
```

**Why?**
- User A cannot see User B's prospects
- Automatic through `auth()->user()` or `$request->user()`
- Middleware ensures user is authenticated

---

### 2. Mass Assignment Protection

**Only allowed fields can be filled:**

```php
// In Prospect model
protected $fillable = [
    'user_id',
    'full_name',
    'profile_url',
    // ... explicit list
];
```

**Prevents:**
```json
// Malicious request
{
    "full_name": "John",
    "is_admin": true  // ← Ignored! Not in $fillable
}
```

---

### 3. Validation on All Inputs

**Every create/update goes through FormRequest:**
- StoreProspectRequest validates before creating
- UpdateProspectRequest validates before updating
- No way to bypass validation

---

### 4. SQL Injection Prevention

**Laravel Eloquent uses prepared statements:**

```php
// Safe - uses parameter binding
Prospect::where('full_name', $request->input('search'))->get();

// Generates: SELECT * FROM prospects WHERE full_name = ?
// Parameters: ['search value']
```

**Never do this:**
```php
// UNSAFE - Direct concatenation
DB::select("SELECT * FROM prospects WHERE full_name = '{$search}'");
```

---

## What's Next?

Phase 2 is complete! Here's what we built:

✅ **Services:** ProspectService, TagService
✅ **Validators:** 6 FormRequest classes
✅ **Resources:** ProspectResource, TagResource
✅ **Controllers:** ProspectController (9 endpoints), TagController (5 endpoints)
✅ **Routes:** 14 new API endpoints
✅ **Features:** CRUD, filtering, search, bulk import, tag management, statistics

**Phase 3 will build:**
- Chrome Extension to extract LinkedIn profiles
- Use the `/api/prospects/bulk` endpoint we just created
- Automatic import to database (Option A flow confirmed)
- Extension UI for authentication and extraction status

---

**Last Updated:** 2025-11-29
**Phase:** 2 - Prospect Management API
**Status:** ✅ Complete
