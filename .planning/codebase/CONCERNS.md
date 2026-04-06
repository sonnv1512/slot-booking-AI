# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

### Hardcoded Development Secret Key
- **Issue:** Default secret key `'parking-booking-dev-key-change-in-production'` is hardcoded in `backend/app.py` line 19
- **Files:** `backend/app.py`
- **Impact:** If `SECRET_KEY` env var is not set in production, sessions can be forged
- **Fix approach:** Remove default value, fail fast if not set in production

### SQLite Database in Source Tree
- **Issue:** `database.db` is stored in `backend/` directory alongside code
- **Files:** `backend/database.db`
- **Impact:** May be accidentally committed to git, exposes all user data and bookings
- **Fix approach:** Add to `.gitignore`, move to separate data directory outside source tree

### No Password Reset Mechanism
- **Issue:** Users cannot reset forgotten passwords - only admins can change passwords
- **Files:** `backend/app.py`
- **Impact:** Locked out users require admin intervention; no self-service recovery
- **Fix approach:** Implement email-based password reset flow

### No Proper Transaction Handling
- **Issue:** Multi-step database operations (e.g., user deletion deletes bookings then user) don't use explicit transactions
- **Files:** `backend/app.py` lines 691-697, 1047-1056
- **Impact:** If operation fails mid-way, database can be left in inconsistent state
- **Fix approach:** Use SQLite transactions with BEGIN/COMMIT/ROLLBACK

### Outdated React Scripts
- **Issue:** Using `react-scripts` 5.0.1 which is no longer maintained
- **Files:** `frontend/package.json`
- **Impact:** Security vulnerabilities, missing features, no longer receives updates
- **Fix approach:** Migrate to Vite or modern React tooling

### No Input Rate Limiting
- **Issue:** No rate limiting on login endpoint - vulnerable to brute force
- **Files:** `backend/app.py`
- **Impact:** Attackers can try unlimited password combinations
- **Fix approach:** Implement Flask-Limiter or similar for login endpoint

## Security Considerations

### Missing CSRF Protection
- **Risk:** State-changing operations (booking creation, cancellation, user management) have no CSRF tokens
- **Files:** `backend/app.py`, `frontend/src/`
- **Current mitigation:** Same-origin CORS policy partially mitigates
- **Recommendations:** Implement Flask-WTF CSRF protection or similar

### No HTTPS Enforcement
- **Risk:** Session cookies and credentials transmitted in cleartext
- **Files:** `backend/app.py` lines 20-21
- **Current mitigation:** None - `SESSION_COOKIE_SECURE` not set
- **Recommendations:** Set `SESSION_COOKIE_SECURE = True` and `SESSION_COOKIE_DOMAIN` for production

### Weak Password Requirements
- **Risk:** Only 6 character minimum enforced; no complexity requirements
- **Files:** `backend/app.py` line 724-725
- **Current mitigation:** None
- **Recommendations:** Require mixed case, numbers, special chars; minimum 8+ characters

### No Security Logging
- **Risk:** Failed logins, admin actions, and suspicious activity not logged
- **Files:** `backend/app.py`
- **Current mitigation:** None
- **Recommendations:** Add logging for auth failures, admin actions, bulk operations

### Default Users with Known Passwords
- **Risk:** Default staff/admin accounts created in database initialization with weak passwords
- **Files:** `backend/database.py` lines 85-96
- **Current mitigation:** Documented to change passwords immediately
- **Recommendations:** Remove default accounts or require password change on first login

## Known Bugs

### Past Booking Deletion Allowed
- **Symptoms:** Users can delete bookings that have already passed
- **Files:** `backend/app.py` line 263-309
- **Trigger:** Call DELETE on `/api/bookings/<booking_id>` with any date
- **Workaround:** None - no date validation on deletion

### User Can Access Others' Bookings Via ID Guessing
- **Symptoms:** No ownership verification on booking deletion beyond user_id parameter
- **Files:** `backend/app.py` line 293 - only checks `target_booking['user_id'] != int(requesting_staff_id)`
- **Trigger:** Pass any user_id in query parameter
- **Workaround:** None - requires authentication session, but parameter could be manipulated

### Date Picker Allows Past Dates in UI
- **Symptoms:** Staff dashboard date picker may allow selecting past dates
- **Files:** `frontend/src/StaffDashboard.js` line 164-169
- **Trigger:** Manually edit date input or use browser dev tools
- **Workaround:** Backend does validate (line 87-88 in app.py) - but user experience is confusing

## Performance Bottlenecks

### Repeated Database Connections
- **Problem:** Each API call opens a new SQLite connection; no connection pooling
- **Files:** `backend/app.py` - every endpoint opens `sqlite3.connect('database.db')`
- **Cause:** SQLite with file-based storage; Flask not using SQLAlchemy
- **Improvement path:** Use SQLAlchemy with connection pooling or switch to PostgreSQL for concurrent access

### Grid View Loads All Slots Then Filters
- **Problem:** Admin dashboard fetches all slots, then filters in JavaScript
- **Files:** `frontend/src/AdminDashboard.js` line 244-253
- **Cause:** Backend returns all slots, frontend does filtering
- **Improvement path:** Add backend query parameter to filter restricted slots

### No Pagination on User List
- **Problem:** Admin user list loads all users at once
- **Files:** `backend/app.py` line 506-535
- **Cause:** No LIMIT/OFFSET in SQL query
- **Improvement path:** Add pagination for large user bases

## Fragile Areas

### Session-Based Auth Without Token Refresh
- **Files:** `backend/app.py` session handling, `frontend/src/StaffLogin.js`
- **Why fragile:** Session expires but no clear indication to user; no refresh mechanism
- **Safe modification:** Add session timeout check on frontend; show warning before expiry
- **Test coverage:** None - no session expiry testing

### Grid View Date Range Logic
- **Files:** `backend/app.py` line 439-502, `frontend/src/AdminDashboard.js` line 14-16, 283-290
- **Why fragile:** Coupling between `max_booking_days` setting and `daysToShow` frontend state
- **Safe modification:** Validate on backend that requested days <= max_booking_days
- **Test coverage:** None - integration between settings and grid view not tested

### Manual Booking Override Logic
- **Files:** `backend/app.py` line 972-1066
- **Why fragile:** Complex logic for override vs. new booking; two-step delete+insert
- **Safe modification:** Use database transaction to ensure atomicity
- **Test coverage:** None - override scenarios not tested

## Scaling Limits

### SQLite Concurrent Writes
- **Current capacity:** Supports ~10-20 concurrent users comfortably
- **Limit:** SQLite locks entire database on write; multiple simultaneous bookings will fail
- **Scaling path:** Switch to PostgreSQL for proper concurrent access; implement write queuing

### Single Server Deployment
- **Current capacity:** Designed for single Flask instance
- **Limit:** No horizontal scaling; session state is server-local
- **Scaling path:** Use Redis for session storage; implement load balancer

### No API Rate Limiting
- **Current capacity:** Unlimited requests per user
- **Limit:** Single user could spam API and degrade service
- **Scaling path:** Add Flask-Limiter with per-IP and per-user limits

## Dependencies at Risk

### Flask-Bcrypt
- **Risk:** Last release 2020; may not receive security updates
- **Impact:** Password hashing uses bcrypt - still considered secure, but may have future CVEs
- **Migration plan:** Consider `passlib` with bcrypt or Argon2

### Flask-CORS
- **Risk:** Middleware package, may have security issues
- **Impact:** CORS misconfiguration could allow unauthorized access
- **Migration plan:** Use alternatives like `flask-cors` maintained fork or implement manually

### React 19
- **Risk:** Very new (released 2024), some packages may not be compatible
- **Impact:** `react-scripts` 5.0.1 may have issues with React 19
- **Migration plan:** Upgrade to Vite-based setup when possible

## Missing Critical Features

### Email Notifications
- **Problem:** No confirmation emails when booking is created/cancelled
- **Blocks:** Users have no record except in-app; admins cannot easily notify users

### Audit Trail
- **Problem:** No logging of who did what; admin actions not tracked
- **Blocks:** Investigating user complaints; compliance requirements

### Booking Modifications
- **Problem:** Users cannot change date or slot of existing booking - must cancel and rebook
- **Blocks:** User experience; forces unnecessary cancellation flow

### Mobile Responsiveness
- **Problem:** Dashboard grid view and tables not optimized for mobile
- **Blocks:** Staff accessing on phones; not usable on small screens

## Test Coverage Gaps

### Backend API Endpoints
- **What's not tested:** None - no test suite exists
- **Files:** `backend/app.py` (all 30+ endpoints)
- **Risk:** Logic errors in booking, user management, settings could go unnoticed
- **Priority:** High

### Authentication Flow
- **What's not tested:** Login, logout, session handling, role-based access
- **Files:** `backend/app.py` lines 312-434, `frontend/src/StaffLogin.js`, `frontend/src/AdminLogin.js`
- **Risk:** Auth bypasses, session fixation, role confusion
- **Priority:** High

### Booking Logic
- **What's not tested:** Double-booking prevention, date validation, slot availability
- **Files:** `backend/app.py` lines 55-164, 210-258
- **Risk:** Users could book same slot twice; past dates accepted
- **Priority:** High

### Frontend Components
- **What's not tested:** React components render correctly; API error handling
- **Files:** `frontend/src/*.js` (except `App.test.js` which is empty)
- **Risk:** UI broken for certain states; no user feedback on errors
- **Priority:** Medium

---

*Concerns audit: 2026-04-06*