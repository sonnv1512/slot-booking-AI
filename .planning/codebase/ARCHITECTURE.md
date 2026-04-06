# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Monolithic Flask Backend + Single-Page Application Frontend

**Key Characteristics:**
- Backend: Single-file Flask application with raw SQLite queries
- Frontend: React SPA with client-side routing
- Communication: REST API over HTTP
- Authentication: Session-based with bcrypt password hashing
- No ORM or abstraction layer - direct SQL queries in routes

## Layers

**Backend (Flask Application):**
- Purpose: REST API server handling all business logic
- Location: `backend/app.py`
- Contains: 27 route handlers, session management, CORS config
- Depends on: Flask, Flask-Bcrypt, Flask-CORS, SQLite3

**Database Layer:**
- Purpose: Persistent data storage
- Location: `backend/database.db` (SQLite)
- Schema: `backend/database.py` (table definitions)
- Tables: users, parking_slots, bookings, settings, parking_space_status

**Frontend (React Application):**
- Purpose: UI rendering and user interaction
- Location: `frontend/src/`
- Contains: 6 page components, CSS styles, routing config
- Depends on: React 19, React Router 7

**API Client Layer:**
- Purpose: Backend communication
- Location: `frontend/src/config.js`
- Pattern: Relative URLs pointing to Flask server

## Data Flow

**User Booking Flow:**

1. User selects parking slot on frontend
2. Frontend sends POST to `/api/bookings` with JSON payload
3. Flask receives request, validates session
4. Flask executes raw SQL to check slot availability
5. If valid, inserts booking record
6. Returns JSON success/failure response
7. Frontend updates UI based on response

**Authentication Flow:**

1. User submits credentials to `/api/login`
2. Flask queries users table by email
3. Bcrypt validates password hash
4. Session stores user_id, email, role
5. Subsequent requests include session cookie
6. Role-based access control on admin routes

## Key Abstractions

**Route Groups (by prefix):**
- `/` - Public home
- `/api/spaces*` - Public parking space queries
- `/api/bookings*` - User booking operations
- `/api/login`, `/api/logout`, `/api/check-auth` - Authentication
- `/api/admin/*` - Admin-only operations

**Database Tables:**
- `users` - Staff and admin accounts with role
- `parking_slots` - Available parking spaces
- `bookings` - User booking records
- `settings` - System configuration (max_booking_days)
- `parking_space_status` - Space availability status

## Entry Points

**Backend Entry:**
- Location: `backend/app.py`
- Triggers: `python backend/app.py` or Flask dev server
- Responsibilities: HTTP server, route handling, database connections

**Frontend Entry:**
- Location: `frontend/src/index.js`
- Triggers: `npm start` (React dev server)
- Responsibilities: React app mounting, routing initialization

**Database Initialization:**
- Location: `backend/database.py`
- Trigger: Manual run or imported by app.py
- Responsibilities: Table creation, default data seeding

## Error Handling

**Strategy:** Simple JSON error responses with HTTP status codes

**Patterns:**
- 400: Missing fields, invalid date format, slot already booked
- 401: Not authenticated
- 403: Admin access required
- 404: Resource not found (e.g., empty date)

**Backend Example:**
```python
return jsonify({'error': 'Missing field: field_name'}), 400
return jsonify({'error': 'Not authenticated'}), 401
```

## Cross-Cutting Concerns

**Logging:** Minimal - print statements for database initialization only

**Validation:**
- Date format validation using datetime.strptime
- Required field checks in request handlers
- Email/password presence validation

**Authentication:**
- Flask session with user_id, email, role
- Session cookie with HttpOnly and Lax settings
- Role check on admin routes: `session['role'] != 'admin'`

**CORS:**
- Configurable origin via CORS_ORIGIN env var
- Supports credentials
- Allowed headers: Content-Type

---

*Architecture analysis: 2026-04-06*
