# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**No external API integrations detected.**

This is a self-contained parking booking system with all functionality implemented locally.

## Data Storage

**Databases:**
- SQLite (local file-based)
  - Connection: Local file `database.db`
  - Client: Python built-in `sqlite3` module
  - No ORM in use - direct SQL queries in `app.py`

**File Storage:**
- Local filesystem only
  - `database.db` - SQLite database
  - `backend/flask_session/` - Session storage (file-based)
  - No cloud storage services

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom session-based authentication
  - Implementation: Flask sessions with `flask_bcrypt` for password hashing
  - Session storage: Server-side file-based (Flask sessions)
  - No external identity provider (e.g., Auth0, Firebase Auth)

**Session Configuration:**
- `SECRET_KEY` - Used to sign session cookies
- `SESSION_COOKIE_HTTPONLY` - True (JavaScript cannot access session)
- `SESSION_COOKIE_SAMESITE` - Lax (CSRF protection)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar services

**Logs:**
- Basic console logging via Python `print()` statements
- No structured logging framework
- No log aggregation service

## CI/CD & Deployment

**Hosting:**
- Not detected - No Dockerfile, docker-compose.yml, or deployment configs

**CI Pipeline:**
- None detected - No GitHub Actions, CircleCI, Jenkins, or similar

## Environment Configuration

**Required env vars:**
- `SECRET_KEY` - Session encryption key (critical for production)
- `CORS_ORIGIN` - Frontend origin for CORS (defaults to `http://127.0.0.1:3000`)
- `FLASK_DEBUG` - Debug mode (optional)
- `PORT` - Server port (optional, defaults to 5000)

**Optional env vars:**
- `REACT_APP_API_URL` - Frontend only, to specify backend URL

**Secrets location:**
- Environment variables only
- No secret management service (e.g., AWS Secrets Manager, HashiCorp Vault)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints

**Outgoing:**
- None detected - No HTTP callbacks to external services

---

*Integration audit: 2026-04-06*
