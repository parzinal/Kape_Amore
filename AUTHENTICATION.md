# Kape Amore Authentication

## Implemented

The Laravel 13 API in `backend/` now provides the cookie-based authentication contract used by the React app:

| Method | Path | Purpose |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Initialize the session CSRF cookie |
| POST | `/login` | Authenticate credentials and return the user |
| POST | `/register` | Create and sign in a customer account |
| POST | `/forgot-password` | Send a password-reset link without revealing whether an email exists |
| POST | `/reset-password` | Apply a valid, unexpired reset token |
| POST | `/logout` | Invalidate the current session and CSRF token |
| GET | `/api/user` | Return the authenticated user's minimal identity or 401 |
| GET | `/api/admin/me` | Example admin-only endpoint, protected on the server |

Login, registration, and current-user responses use this shape:

```json
{
  "user": {
    "id": 42,
    "name": "Example Customer",
    "email": "customer@example.com",
    "roles": ["customer"]
  }
}
```

Registration validates a minimum 12-character password, rejects submitted role/permission fields, hashes passwords through Laravel, and assigns only the `customer` role inside a database transaction. Roles are seeded without creating a default administrator. Create an administrator through the interactive `php artisan kape:create-admin` command after migrating and seeding; it prompts for the password without echoing it. Login and password-reset requests are rate-limited; login regenerates the session ID. Password resets use Laravel's password broker and send reset URLs to the React route.

## Local setup with Laragon

Requirements: PHP 8.3+, Composer, MySQL 8+, and Node/npm. Start Apache/MySQL from Laragon (only MySQL is required for these API commands), then create an empty MySQL database named `kape_amore` using HeidiSQL or phpMyAdmin.

From a terminal in the project:

```powershell
cd backend
Copy-Item .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

If `php` or `composer` is not recognized, open Laragon's Terminal so its PHP and Composer paths are available. The local `.env.example` assumes Laragon's default MySQL user (`root`) with no password; change `DB_USERNAME` and `DB_PASSWORD` in the untracked `backend/.env` if your local database differs. Never commit `.env`.

In a second terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

The frontend's `.env.example` points to `http://127.0.0.1:8000`. The backend allows Vite on ports 5173 and 5174 for local development. If Vite selects a different port, update `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `SANCTUM_STATEFUL_DOMAINS` in the untracked `backend/.env`; also update `VITE_API_URL` if the API origin changes.

For local password-reset testing, `MAIL_MAILER=log` writes the generated link to `backend/storage/logs/laravel.log`. Configure a real mail transport before using password resets outside local development.

Run the authentication feature tests using SQLite in memory:

```powershell
cd backend
php artisan test
```

## Security and deployment requirements

- Sanctum stateful SPA middleware, CSRF protection, credentialed CORS, and role middleware are configured. Keep allowed origins explicit; never use wildcard origins with credentials.
- Use HTTPS in production and set `SESSION_SECURE_COOKIE=true`. Keep session cookies HttpOnly and SameSite=Lax, and configure the production frontend/API domains in `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, and `FRONTEND_URL`.
- Public registration must remain customer-only. Provision administrators through a controlled, authenticated administrative process; do not add a public admin-registration path or ship a default admin password.
- Protect every future admin API route with `auth:sanctum` and `role:admin`. A frontend route guard is not an authorization boundary.
- Return only minimal identity and role names; never expose password hashes, reset tokens, or session secrets.
- Configure a production mail provider and verify reset-link expiry, CSRF rejection, rate limits, inactive-account denial, and authorization at the API boundary before launch.
