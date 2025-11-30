<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Prospect\ProspectController;
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
| Public Authentication Routes
|--------------------------------------------------------------------------
|
| These routes do not require authentication.
| Anyone can register or login to get an access token.
|
*/

Route::post('/register', RegisterController::class);
Route::post('/login', LoginController::class);

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

    /*
    |--------------------------------------------------------------------------
    | Prospect Routes
    |--------------------------------------------------------------------------
    */
    // Prospect statistics
    Route::get('/prospects/stats', [ProspectController::class, 'stats']);

    // Bulk import prospects (for Chrome extension)
    Route::post('/prospects/bulk', [ProspectController::class, 'bulkImport']);

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
});
