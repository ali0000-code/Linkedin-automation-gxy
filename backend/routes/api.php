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
| Here is where you register API routes for the application.
| These routes are automatically prefixed with /api by Laravel.
| All routes return JSON responses.
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

/*
|--------------------------------------------------------------------------
| Protected Routes (Require Authentication)
|--------------------------------------------------------------------------
|
| These routes require a valid Sanctum access token.
| Clients must include: Authorization: Bearer {token}
|
*/

Route::middleware('auth:sanctum')->group(function () {
    /*
    |--------------------------------------------------------------------------
    | User Routes
    |--------------------------------------------------------------------------
    */
    // Get authenticated user info
    Route::get('/user', function (Illuminate\Http\Request $request) {
        return new \App\Http\Resources\UserResource($request->user());
    });

    // Logout (revoke current token)
    Route::post('/logout', LogoutController::class);

    // Verify LinkedIn account (for extension)
    Route::post('/auth/linkedin/verify', [LinkedInOAuthController::class, 'verifyLinkedInAccount']);

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
    // Prospect statistics
    Route::get('/prospects/stats', [ProspectController::class, 'stats']);

    // Bulk import prospects (for Chrome extension)
    Route::post('/prospects/bulk', [ProspectController::class, 'bulkImport']);

    // Bulk operations on prospects
    Route::post('/prospects/bulk-delete', [ProspectController::class, 'bulkDelete']);
    Route::post('/prospects/bulk-attach-tags', [ProspectController::class, 'bulkAttachTags']);

    // Standard CRUD for prospects
    Route::apiResource('prospects', ProspectController::class);

    // Prospect tag management
    Route::post('/prospects/{prospect}/tags', [ProspectController::class, 'attachTags']);
    Route::delete('/prospects/{prospect}/tags/{tag}', [ProspectController::class, 'detachTag']);

    /*
    |--------------------------------------------------------------------------
    | Tag Routes
    |--------------------------------------------------------------------------
    */
    // Standard CRUD for tags
    Route::apiResource('tags', TagController::class);

    /*
    |--------------------------------------------------------------------------
    | Message Template Routes
    |--------------------------------------------------------------------------
    */
    // Bulk delete templates
    Route::post('/templates/bulk-delete', [MessageTemplateController::class, 'bulkDelete']);

    // Standard CRUD for message templates
    // Query parameter: ?type=invitation or ?type=message to filter by type
    Route::apiResource('templates', MessageTemplateController::class);

    /*
    |--------------------------------------------------------------------------
    | Campaign Routes
    |--------------------------------------------------------------------------
    */
    // Campaign statistics
    Route::get('/campaigns/stats', [CampaignController::class, 'stats']);

    // Campaign actions (start, pause)
    Route::post('/campaigns/{id}/start', [CampaignController::class, 'start']);
    Route::post('/campaigns/{id}/pause', [CampaignController::class, 'pause']);

    // Prospect management
    Route::post('/campaigns/{id}/prospects/add', [CampaignController::class, 'addProspects']);
    Route::post('/campaigns/{id}/prospects/remove', [CampaignController::class, 'removeProspects']);

    // Standard CRUD for campaigns
    Route::apiResource('campaigns', CampaignController::class);

    /*
    |--------------------------------------------------------------------------
    | Campaign Action Routes
    |--------------------------------------------------------------------------
    */
    // Get available campaign action types
    Route::get('/campaign-actions', [CampaignActionController::class, 'index']);
    Route::get('/campaign-actions/{id}', [CampaignActionController::class, 'show']);

    /*
    |--------------------------------------------------------------------------
    | Settings Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('settings')->group(function () {
        // Gmail SMTP settings
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
    Route::post('/mail/queue-from-campaign', [SentEmailController::class, 'queueFromCampaign']);
    Route::post('/mail/send-bulk', [SentEmailController::class, 'sendBulk']);
    Route::delete('/mail/bulk-delete', [SentEmailController::class, 'bulkDelete']);
    Route::delete('/mail/discard-extraction/{campaignId}', [SentEmailController::class, 'discardExtraction']);
    Route::get('/mail/{id}', [SentEmailController::class, 'show']);
    Route::put('/mail/{id}', [SentEmailController::class, 'update']);
    Route::post('/mail/{id}/send', [SentEmailController::class, 'send']);
    Route::delete('/mail/{id}', [SentEmailController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Inbox Routes (LinkedIn Messages)
    |--------------------------------------------------------------------------
    */
    Route::get('/inbox', [InboxController::class, 'index']);
    Route::get('/inbox/stats', [InboxController::class, 'stats']);
    Route::post('/inbox/sync', [InboxController::class, 'sync']);
    Route::get('/inbox/pending-messages', [InboxController::class, 'pendingMessages']);
    Route::get('/inbox/scheduled', [InboxController::class, 'scheduledMessages']);
    Route::delete('/inbox/scheduled/{id}', [InboxController::class, 'cancelScheduledMessage']);
    Route::put('/inbox/scheduled/{id}', [InboxController::class, 'updateScheduledMessage']);
    Route::post('/inbox/conversations', [InboxController::class, 'createConversation']);
    Route::get('/inbox/{id}', [InboxController::class, 'show']);
    Route::post('/inbox/{id}/sync-messages', [InboxController::class, 'syncMessages']);
    Route::post('/inbox/{id}/send', [InboxController::class, 'sendMessage']);
    Route::post('/inbox/{id}/read', [InboxController::class, 'markAsRead']);
    Route::delete('/inbox/{id}', [InboxController::class, 'destroy']);
    Route::post('/inbox/messages/{id}/mark-sent', [InboxController::class, 'markMessageSent']);
    Route::post('/inbox/incoming-message', [InboxController::class, 'incomingMessage']);

    /*
    |--------------------------------------------------------------------------
    | Extension Routes
    |--------------------------------------------------------------------------
    |
    | These endpoints are specifically designed for the Chrome extension.
    | They handle action queue management and account verification.
    |
    */
    Route::prefix('extension')->group(function () {
        // Account verification - ensure LinkedIn account matches
        Route::post('/verify-account', [ExtensionController::class, 'verifyAccount']);

        // Action queue management
        Route::get('/actions/next', [ExtensionController::class, 'getNextAction']);
        Route::post('/actions/{id}/complete', [ExtensionController::class, 'completeAction']);
        Route::get('/actions/stats', [ExtensionController::class, 'getActionStats']);

        // Active campaigns for extension
        Route::get('/campaigns/active', [ExtensionController::class, 'getActiveCampaigns']);

        // Get email extraction results for a campaign
        Route::get('/campaigns/{id}/extraction-results', [ExtensionController::class, 'getExtractionResults']);

        // Update prospect email (after extraction) - uses LinkedIn ID string
        Route::patch('/prospects/{linkedinId}/email', [ExtensionController::class, 'updateProspectEmail']);
    });
});
