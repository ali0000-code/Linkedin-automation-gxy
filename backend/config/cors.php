<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // Only these URL paths will have CORS headers applied.
    // sanctum/csrf-cookie is needed for SPA cookie-based auth (not currently used).
    'paths' => ['api/*', 'auth/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Environment-based origins: In dev, defaults to localhost:3000 (Vite dev server).
    // In production, set CORS_ALLOWED_ORIGINS to your domain(s), comma-separated.
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')),

    // Pattern-based origins for Chrome extension. The extension's origin is
    // chrome-extension://<extension-id>. Set EXTENSION_CORS_PATTERN in .env
    // to restrict to your specific extension ID in production.
    'allowed_origins_patterns' => [
        '#' . env('EXTENSION_CORS_PATTERN', 'chrome-extension://.*') . '#',
    ],

    // Minimal required headers. Authorization carries the Sanctum bearer token.
    'allowed_headers' => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],

    'exposed_headers' => [],

    // Browser caches preflight response for 1 hour (reduces OPTIONS requests).
    'max_age' => 3600,

    // Required for Sanctum cookie-based auth and for the browser to include
    // Authorization headers in cross-origin requests.
    'supports_credentials' => true,

];
