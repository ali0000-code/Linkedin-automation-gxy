# Phase 1 Setup Guide

Complete installation and configuration guide for Phase 1: Backend Foundation.

## Prerequisites

Before starting, ensure you have:

- **XAMPP** installed with:
  - PHP 8.2 or higher
  - MySQL 8.0 or higher
  - Apache web server
- **Composer** (PHP dependency manager)
- **Postman** (for API testing)
- **Git** (optional, for version control)

## Step 1: Start XAMPP Services

1. Open XAMPP Control Panel
2. Start **Apache** (for web server)
3. Start **MySQL** (for database)
4. Verify both services are running (green status)

## Step 2: Verify PHP Version

Open terminal/command prompt and verify PHP version:

```bash
php -v
```

Should output: `PHP 8.2.x` or higher

## Step 3: Navigate to Project Directory

```bash
cd C:\Users\a2z\linkedin-automation\backend
```

## Step 4: Install Dependencies

The project already has Laravel 11 and Sanctum installed. If you need to reinstall:

```bash
composer install
```

This will install all required PHP packages defined in `composer.json`.

## Step 5: Environment Configuration

The `.env` file has already been configured with:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=linkedin_automation
DB_USERNAME=root
DB_PASSWORD=
```

**Important:** If your MySQL has a password, update `DB_PASSWORD` in the `.env` file.

## Step 6: Generate Application Key

Laravel requires an encryption key. Check if `APP_KEY` in `.env` has a value.

If empty, generate it:

```bash
php artisan key:generate
```

## Step 7: Create Database

The database has already been created. To verify:

1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Check if `linkedin_automation` database exists
3. If not, create it manually or run:

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS linkedin_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## Step 8: Run Database Migrations

All 8 database tables have been created. To verify or re-run migrations:

```bash
php artisan migrate
```

This will create the following tables:
- `users` - User accounts
- `linkedin_accounts` - Connected LinkedIn profiles
- `prospects` - Extracted leads
- `tags` - Prospect categorization
- `prospect_tag` - Many-to-many pivot
- `campaigns` - Automation campaigns
- `campaign_prospects` - Campaign status tracking
- `action_queue` - Scheduled LinkedIn actions

## Step 9: Start Laravel Development Server

```bash
php artisan serve
```

The API will be available at: `http://localhost:8000`

**Output should show:**
```
INFO  Server running on [http://127.0.0.1:8000].
```

## Step 10: Verify Installation

Test the API health endpoint:

```bash
curl http://localhost:8000/up
```

Should return: `{"status":"ok"}`

Or visit in browser: `http://localhost:8000/up`

## Troubleshooting

### MySQL Connection Failed

**Error:** `SQLSTATE[HY000] [2002] Connection refused`

**Solution:**
1. Make sure MySQL is running in XAMPP
2. Verify `DB_HOST=127.0.0.1` in `.env`
3. Check MySQL port (default: 3306)

### Class Not Found

**Error:** `Class 'App\...' not found`

**Solution:**
```bash
composer dump-autoload
```

### Migration Errors

**Error:** `SQLSTATE[42S01]: Base table or view already exists`

**Solution:** Tables already exist. To reset:
```bash
php artisan migrate:fresh
```

**Warning:** This will delete all data!

### Port Already in Use

**Error:** `Failed to listen on 127.0.0.1:8000`

**Solution:** Another process is using port 8000. Use a different port:
```bash
php artisan serve --port=8001
```

## Next Steps

After successful setup:

1. Import the Postman collection: `docs/phase-1/postman_collection.json`
2. Test the authentication endpoints (see `TESTING.md`)
3. Review the code architecture (see `CODE_GUIDE.md`)

## File Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Auth/      # Authentication controllers
│   │   ├── Requests/Auth/         # Form validation
│   │   └── Resources/             # API response transformers
│   ├── Models/                    # Database models
│   └── Services/                  # Business logic layer
├── database/
│   └── migrations/                # Database schema
├── routes/
│   └── api.php                    # API routes
└── .env                           # Environment configuration
```

## API Endpoints

All endpoints are prefixed with `/api`:

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/register | Create new user | No |
| POST | /api/login | Login user | No |
| GET | /api/user | Get authenticated user | Yes |
| POST | /api/logout | Logout user | Yes |

## Environment Variables

Key environment variables in `.env`:

| Variable | Value | Description |
|----------|-------|-------------|
| APP_NAME | Laravel | Application name |
| APP_ENV | local | Environment (local/production) |
| APP_DEBUG | true | Debug mode (true for development) |
| DB_CONNECTION | mysql | Database driver |
| DB_DATABASE | linkedin_automation | Database name |
| DB_USERNAME | root | MySQL username |
| DB_PASSWORD | (empty) | MySQL password |

## Support

For issues:
1. Check error logs: `storage/logs/laravel.log`
2. Review this setup guide
3. Verify XAMPP services are running
4. Check database connection settings

---

**Phase 1 Status:** ✅ Complete

**Next Phase:** Phase 2 - Prospect Management API
