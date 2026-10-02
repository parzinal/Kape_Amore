# Kape Amore Authentication

## Current frontend behavior

The React app provides `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account`, and `/admin` routes.

- Public registration submits only a name, email, and password. It does not accept a role.
- Admins are sent to `/admin` only when the authenticated server response includes the `admin` role.
- Customers are sent to `/account`. The frontend redirects a non-admin away from `/admin` and redirects an admin away from `/account`.
- Protected routes fetch the current user from the server and fail closed if the server cannot verify the session.
- Session authentication uses cookies and the Sanctum CSRF endpoint; no bearer token or password is saved in browser storage.

The Laravel backend in this repository has not yet been scaffolded. Until its authentication endpoints and server-side authorization are implemented, the sign-in, registration, and password-reset forms cannot authenticate accounts, and the frontend route checks alone are not a security boundary.

## Required Laravel API contract

Set `VITE_API_URL` in `frontend/.env` to the Laravel origin (for local development, typically `http://127.0.0.1:8000`). The frontend expects these endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/sanctum/csrf-cookie` | Initialize the session CSRF cookie |
| POST | `/login` | Authenticate credentials and return the user |
| POST | `/register` | Create a customer account only |
| POST | `/forgot-password` | Request a password-reset email |
| POST | `/reset-password` | Apply a valid reset token |
| POST | `/logout` | Invalidate the current session |
| GET | `/api/user` | Return the current authenticated user or 401 |

Successful login, registration, and current-user responses must have this shape:

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

Use `roles: ["admin"]` for an admin account. Laravel validation failures should use the normal JSON `message` and `errors` response format. The password-reset request should return a generic confirmation whether or not the email exists.

## Server-side requirements (mandatory)

The Laravel API must be the authority for identity and access. A React route guard can improve navigation but cannot protect data or operations.

1. Configure Sanctum as a stateful SPA using HttpOnly, Secure-in-production, SameSite cookies, CSRF protection, credentialed CORS, and the correct stateful domains. Serve the frontend and API over HTTPS in production.
2. Rate-limit login and password-reset attempts. Use Laravel's password hashing and password broker, regenerate the session after login, and invalidate the session plus CSRF token on logout.
3. Public registration must assign the `customer` role server-side in a transaction, ignore/reject any submitted role or permission fields, and never create an administrator.
4. Provision admin accounts only through a controlled server-side seed/CLI process or an existing admin workflow. Do not ship a default admin password.
5. Protect every admin API route with both authentication and a server-side admin-role/permission check, for example `auth:sanctum` plus an `admin` authorization middleware/policy. Do not rely on `/admin` frontend routing for authorization.
6. Return only the minimal user identity and role names required by the frontend. Never return password hashes, reset tokens, or session secrets.
7. Test public registration privilege escalation, invalid credentials, session fixation, CSRF rejection, rate limits, password reset token expiry, unauthenticated API access, and customer access to admin endpoints.

Set the API origin without a trailing slash in `frontend/.env`; do not commit production secrets or environment files.
