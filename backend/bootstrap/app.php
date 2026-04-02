<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

/**
 * Application Bootstrap
 *
 * Configures routing, middleware, and exception handling for the Laravel app.
 *
 * Key customizations:
 * 1. Guest redirect: API routes return null (no redirect) so the exception handler
 *    can return a JSON 401 instead of redirecting to a login page.
 * 2. AuthenticationException: Returns a clean JSON 401 for API/JSON requests
 *    instead of Laravel's default HTML redirect.
 * 3. Production error sanitization: All unhandled exceptions on API routes return
 *    a generic "An internal error occurred." message for 500 errors, preventing
 *    stack traces, SQL queries, and internal paths from leaking to clients.
 *    Non-500 errors (404, 422, etc.) still return the original message.
 */
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Override Laravel's default behavior of redirecting unauthenticated users
        // to a login page. For API routes, we want a JSON response instead.
        $middleware->redirectGuestsTo(function (Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return null; // Don't redirect -- let the exception handler return JSON 401
            }
            return '/';
        });
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Return a clean JSON 401 for unauthenticated API requests
        // (missing or invalid Sanctum token)
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                    'error' => 'Please provide a valid authentication token.'
                ], 401);
            }
        });

        // Production-only: sanitize unhandled exceptions for API routes.
        // Prevents leaking internal details (stack traces, SQL, file paths).
        // In development (APP_ENV=local), returns null to show full error details.
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (!app()->isProduction()) return null;
            if (!$request->expectsJson() && !$request->is('api/*')) return null;

            $status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;

            return response()->json([
                // Only sanitize 500 errors; 404, 422, etc. keep their original messages
                'message' => $status === 500 ? 'An internal error occurred.' : $e->getMessage(),
            ], $status);
        });
    })->create();
