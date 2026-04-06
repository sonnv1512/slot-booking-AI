# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- Python 3.x - Backend API (Flask)
- JavaScript - Frontend (React)

**Secondary:**
- SQL - Database queries in SQLite

## Runtime

**Environment:**
- Python - Flask development server
- Node.js - React development server

**Package Manager:**
- pip - Python dependencies (see `backend/requirements.txt`)
- npm - JavaScript dependencies (see `frontend/package.json`)
- Lockfile: `frontend/package-lock.json` (present)

## Frameworks

**Core (Backend):**
- Flask 3.1.2 - Web framework
- Flask-Bcrypt 1.0.1 - Password hashing
- Flask-CORS 6.0.2 - Cross-origin request handling

**Core (Frontend):**
- React 19.2.3 - UI framework
- React Router DOM 7.11.0 - Client-side routing
- React Scripts 5.0.1 - Build tooling (Create React App)

**Testing:**
- @testing-library/dom 10.4.1
- @testing-library/jest-dom 6.9.1
- @testing-library/react 16.3.1
- @testing-library/user-event 13.5.0
- web-vitals 2.1.4

## Key Dependencies

**Critical (Backend):**
- Flask 3.1.2 - Core web framework
- flask-bcrypt 1.0.1 - Password hashing (bcrypt)
- flask-cors 6.0.2 - CORS support
- sqlite3 - Built-in Python database (no install required)

**Critical (Frontend):**
- react 19.2.3 - Core UI library
- react-dom 19.2.3 - React DOM renderer
- react-router-dom 7.11.0 - Routing
- react-scripts 5.0.1 - Build and dev scripts

## Configuration

**Environment (Backend):**
- `CORS_ORIGIN` - Allowed frontend origin (default: `http://127.0.0.1:3000`)
- `SECRET_KEY` - Session secret key (default: `parking-booking-dev-key-change-in-production`)
- `FLASK_DEBUG` - Debug mode flag
- `PORT` - Server port (default: 5000)

**Environment (Frontend):**
- `REACT_APP_API_URL` - Backend API base URL (optional, defaults to relative path)

**Build:**
- `frontend/package.json` - npm scripts (start, build, test, eject)
- `frontend/browserslist` - Target browsers

## Platform Requirements

**Development:**
- Python 3.x with pip
- Node.js with npm
- SQLite (included in Python standard library)

**Production:**
- Python runtime with Flask
- Node.js (for building React frontend) or serve pre-built static files
- SQLite database file (`database.db`)

---

*Stack analysis: 2026-04-06*
