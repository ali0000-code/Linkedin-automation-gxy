<?php

use App\Http\Controllers\Auth\LinkedInOAuthController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Campaign\CampaignActionController;
use App\Http\Controllers\Campaign\CampaignController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Extension\ExtensionController;
use App\Http\Controllers\Inbox\InboxController;
use App\Http\Controllers\Mail\SentEmailController;
use App\Http\Controllers\MessageTemplate\MessageTemplateController;
use App\Http\Controllers\Prospect\ProspectController;
use App\Http\Controllers\Settings\GmailSettingController;
use App\Http\Controllers\Tag\TagController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| All routes are automatically prefixed with /api by Laravel.
| All routes return JSON responses.
|
| Rate limiting tiers (requests per minute):
|   - Public OAuth routes:     10/min  (prevents brute-force on auth endpoints)
|   - Standard authenticated:  120/min (normal API usage)
|   - Bulk operations:         20/min  (heavy DB writes: imports, bulk deletes)
|   - Inbox sync:              10/min  (heavy operation with many DB writes)
|   - Bulk mail:               10/min  (expensive: each email opens SMTP connection)
|   - Extension polling:       60/min  (extension polls every few seconds)
|
*/

/*
|--------------------------------------------------------------------------
| OAuth Authentication Routes (Public)
|--------------------------------------------------------------------------
|
| LinkedIn OAuth 2.0 authentication flow.
| Requires 'web' middleware for session support (OAuth state parameter).
| Rate-limited to prevent abuse.
|
*/

Route::middleware(['web', 'throttle:10,1'])->group(function () {
    // Get OAuth authorization URL (for frontend SPAs)
    Route::get('/auth/linkedin/url', [LinkedInOAuthController::class, 'getAuthUrl']);

    // Redirect to LinkedIn OAuth (for direct browser navigation)
    Route::get('/auth/linkedin', [LinkedInOAuthController::class, 'redirect']);

    // OAuth callback (LinkedIn redirects here after user authorizes)
    Route::get('/auth/linkedin/callback', [LinkedInOAuthController::class, 'callback']);
});

// Extension authentication via auth key (public, no Sanctum required).
// Rate limited to 10/min to prevent brute-force guessing of 22-char auth keys.
Route::middleware('throttle:10,1')->post('/auth/extension', [LinkedInOAuthController::class, 'extensionAuth']);

/*
|--------------------------------------------------------------------------
| Protected Routes (Require Authentication)
|--------------------------------------------------------------------------
|
| These routes require a valid Sanctum access token.
| Clients must include: Authorization: Bearer {token}
|
*/

Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function () {
    /*
    |--------------------------------------------------------------------------
    | User Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/user', function (Illuminate\Http\Request $request) {
        return new \App\Http\Resources\UserResource($request->user());
    });

    Route::post('/logout', LogoutController::class);
    Route::post('/auth/linkedin/verify', [LinkedInOAuthController::class, 'verifyLinkedInAccount']);

    // Auth key management (for extension)
    Route::get('/auth/key', [LinkedInOAuthController::class, 'getAuthKey']);
    Route::post('/auth/key/regenerate', [LinkedInOAuthController::class, 'regenerateAuthKey']);

    /*
    |--------------------------------------------------------------------------
    | Dashboard Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/dashboard', [DashboardController::class, 'index']);

    /*
    |--------------------------------------------------------------------------
    | Prospect Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/prospects/stats', [ProspectController::class, 'stats']);
    Route::apiResource('prospects', ProspectController::class);
    Route::post('/prospects/{prospect}/tags', [ProspectController::class, 'attachTags']);
    Route::delete('/prospects/{prospect}/tags/{tag}', [ProspectController::class, 'detachTag']);

    // Bulk operations — stricter rate limit
    Route::middleware('throttle:20,1')->group(function () {
        Route::post('/prospects/bulk', [ProspectController::class, 'bulkImport']);
        Route::post('/prospects/bulk-delete', [ProspectController::class, 'bulkDelete']);
        Route::post('/prospects/bulk-attach-tags', [ProspectController::class, 'bulkAttachTags']);
    });

    /*
    |--------------------------------------------------------------------------
    | Tag Routes
    |--------------------------------------------------------------------------
    */
    Route::apiResource('tags', TagController::class);

    /*
    |--------------------------------------------------------------------------
    | Message Template Routes
    |--------------------------------------------------------------------------
    */
    Route::post('/templates/bulk-delete', [MessageTemplateController::class, 'bulkDelete']);
    Route::apiResource('templates', MessageTemplateController::class);

    /*
    |--------------------------------------------------------------------------
    | Campaign Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/campaigns/stats', [CampaignController::class, 'stats']);
    Route::post('/campaigns/{id}/start', [CampaignController::class, 'start']);
    Route::post('/campaigns/{id}/pause', [CampaignController::class, 'pause']);
    Route::post('/campaigns/{id}/prospects/add', [CampaignController::class, 'addProspects']);
    Route::post('/campaigns/{id}/prospects/remove', [CampaignController::class, 'removeProspects']);
    Route::apiResource('campaigns', CampaignController::class);

    /*
    |--------------------------------------------------------------------------
    | Campaign Action Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/campaign-actions', [CampaignActionController::class, 'index']);
    Route::get('/campaign-actions/{id}', [CampaignActionController::class, 'show']);

    /*
    |--------------------------------------------------------------------------
    | Settings Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('settings')->group(function () {
        Route::get('/gmail', [GmailSettingController::class, 'show']);
        Route::post('/gmail', [GmailSettingController::class, 'store']);
        Route::post('/gmail/verify', [GmailSettingController::class, 'verify']);
        Route::delete('/gmail', [GmailSettingController::class, 'destroy']);
    });

    /*
    |--------------------------------------------------------------------------
    | Mail Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/mail', [SentEmailController::class, 'index']);
    Route::post('/mail', [SentEmailController::class, 'store']);
    Route::get('/mail/stats', [SentEmailController::class, 'stats']);
    Route::get('/mail/pending-extractions', [SentEmailController::class, 'getPendingExtractions']);
    Route::get('/mail/{id}', [SentEmailController::class, 'show']);
    Route::put('/mail/{id}', [SentEmailController::class, 'update']);
    Route::post('/mail/{id}/send', [SentEmailController::class, 'send']);
    Route::delete('/mail/{id}', [SentEmailController::class, 'destroy']);

    // Bulk mail — stricter rate limit
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/mail/queue-from-campaign', [SentEmailController::class, 'queueFromCampaign']);
        Route::post('/mail/send-bulk', [SentEmailController::class, 'sendBulk']);
        Route::delete('/mail/bulk-delete', [SentEmailController::class, 'bulkDelete']);
        Route::delete('/mail/discard-extraction/{campaignId}', [SentEmailController::class, 'discardExtraction']);
    });

    /*
    |--------------------------------------------------------------------------
    | Inbox Routes (LinkedIn Messages)
    |--------------------------------------------------------------------------
    */
    Route::get('/inbox', [InboxController::class, 'index']);
    Route::get('/inbox/stats', [InboxController::class, 'stats']);
    Route::get('/inbox/pending-messages', [InboxController::class, 'pendingMessages']);
    Route::get('/inbox/scheduled', [InboxController::class, 'scheduledMessages']);
    Route::delete('/inbox/scheduled/{id}', [InboxController::class, 'cancelScheduledMessage']);
    Route::put('/inbox/scheduled/{id}', [InboxController::class, 'updateScheduledMessage']);
    Route::post('/inbox/conversations', [InboxController::class, 'createConversation']);
    Route::get('/inbox/{id}', [InboxController::class, 'show']);
    Route::get('/inbox/{id}/check', [InboxController::class, 'check']);
    Route::post('/inbox/{id}/sync-messages', [InboxController::class, 'syncMessages']);
    Route::post('/inbox/{id}/send', [InboxController::class, 'sendMessage']);
    Route::post('/inbox/{id}/read', [InboxController::class, 'markAsRead']);
    Route::delete('/inbox/{id}', [InboxController::class, 'destroy']);
    Route::post('/inbox/messages/{id}/mark-sent', [InboxController::class, 'markMessageSent']);
    Route::post('/inbox/incoming-message', [InboxController::class, 'incomingMessage']);

    // Inbox sync — limited (heavy operation)
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/inbox/sync', [InboxController::class, 'sync']);
    });

    /*
    |--------------------------------------------------------------------------
    | Extension Routes — rate limited for polling
    |--------------------------------------------------------------------------
    */
    Route::prefix('extension')->middleware('throttle:60,1')->group(function () {
        Route::post('/verify-account', [ExtensionController::class, 'verifyAccount']);
        Route::get('/actions/next', [ExtensionController::class, 'getNextAction']);
        Route::post('/actions/{id}/complete', [ExtensionController::class, 'completeAction']);
        Route::get('/actions/stats', [ExtensionController::class, 'getActionStats']);
        Route::get('/campaigns/active', [ExtensionController::class, 'getActiveCampaigns']);
        Route::get('/campaigns/{id}/extraction-results', [ExtensionController::class, 'getExtractionResults']);
        Route::patch('/prospects/{linkedinId}/email', [ExtensionController::class, 'updateProspectEmail']);
    });
});
