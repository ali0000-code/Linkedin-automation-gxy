<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\GmailSettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GmailSettingController
 *
 * Handles Gmail SMTP settings for email sending.
 */
class GmailSettingController extends Controller
{
    protected GmailSettingService $gmailSettingService;

    public function __construct(GmailSettingService $gmailSettingService)
    {
        $this->gmailSettingService = $gmailSettingService;
    }

    /**
     * Get current Gmail settings.
     *
     * GET /api/settings/gmail
     */
    public function show(Request $request): JsonResponse
    {
        $setting = $this->gmailSettingService->getSettings($request->user());

        if (!$setting) {
            return response()->json([
                'connected' => false,
                'email' => null,
                'is_verified' => false,
                'last_verified_at' => null,
            ]);
        }

        return response()->json([
            'connected' => true,
            'email' => $setting->email,
            'is_verified' => $setting->is_verified,
            'last_verified_at' => $setting->last_verified_at?->toISOString(),
        ]);
    }

    /**
     * Save Gmail settings.
     *
     * POST /api/settings/gmail
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'app_password' => 'required|string|min:8|max:255',
        ], [
            'email.required' => 'Gmail email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'app_password.required' => 'App Password is required.',
            'app_password.min' => 'App Password must be at least 8 characters.',
        ]);

        $setting = $this->gmailSettingService->saveSettings(
            $request->user(),
            $validated['email'],
            $validated['app_password']
        );

        return response()->json([
            'message' => 'Gmail settings saved. Please verify the connection.',
            'connected' => true,
            'email' => $setting->email,
            'is_verified' => $setting->is_verified,
        ]);
    }

    /**
     * Verify Gmail connection.
     *
     * POST /api/settings/gmail/verify
     */
    public function verify(Request $request): JsonResponse
    {
        $result = $this->gmailSettingService->verifyConnection($request->user());

        return response()->json([
            'success' => $result['success'],
            'message' => $result['message'],
            'is_verified' => $result['success'],
        ], $result['success'] ? 200 : 400);
    }

    /**
     * Disconnect Gmail.
     *
     * DELETE /api/settings/gmail
     */
    public function destroy(Request $request): JsonResponse
    {
        $deleted = $this->gmailSettingService->deleteSettings($request->user());

        if (!$deleted) {
            return response()->json([
                'message' => 'Gmail settings not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Gmail disconnected successfully.',
            'connected' => false,
        ]);
    }
}
