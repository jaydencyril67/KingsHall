# KingsHall Authentication API

This service is intentionally isolated under `backend/` in the KingsHall repository. It does not use the legacy CryBots/Kingshalls backend or its database.

## Deploy as a separate Render Web Service

- Repository: `jaydencyril67/KingsHall`
- Branch: `main`
- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Add these environment variables in the Render service settings; never commit real values:

- `NODE_ENV=production`
- `MONGODB_URI`: MongoDB connection string using a dedicated database name for KingsHall, e.g. `kingshall_auth`. Do not point this at a legacy application's database name.
- `JWT_SECRET`: at least 32 random characters.
- `RESEND_API_KEY`: API key from Resend.
- `EMAIL_FROM`: sender using a domain verified in Resend, e.g. `KingsHall <verify@your-verified-domain.example>`.
- `APP_BASE_URL`: the URL where the KingsHall frontend will live. Reserved for frontend-link integration.
- `CLIENT_ORIGINS`: comma-separated exact origins allowed to call the API, including the web origin and `https://localhost,capacitor://localhost,http://localhost:5173` for the Capacitor app/local development.
- Optional: `EMAIL_CODE_TTL_MINUTES=10`
- Optional: `EMAIL_RESEND_COOLDOWN_SECONDS=60`

After deployment, check `GET /health`. It should return `ok: true` and `database: "connected"`.

## API endpoints

- `GET /health` — process/database health.
- `POST /api/auth/signup` — JSON: `{ "name", "username", "email", "password" }`. Creates a pending account and sends a six-digit email verification code.
- `POST /api/auth/verify-email` — JSON: `{ "email", "code" }`. Verifies the code before login is allowed.
- `POST /api/auth/resend-verification` — JSON: `{ "email" }`. Resends after a cooldown.
- `POST /api/auth/login` — JSON: `{ "identity", "password" }`. Identity can be email or username. Returns a two-hour bearer token only after email verification.

Passwords are bcrypt-hashed; verification codes are stored as keyed hashes with an expiry; the API uses Helmet, exact-origin CORS, request limits, and failed-login cooldowns. Never log passwords, verification codes, JWTs, or provider secrets.

This is the backend implementation stage. The existing frontend is not connected to these endpoints yet. Verify deployment, database connection and real email delivery before wiring up the signup/verification/login UI.
