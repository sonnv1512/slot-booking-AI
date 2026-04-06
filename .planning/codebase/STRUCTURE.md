# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
slot-booking-AI/
├── .gitignore
├── .opencode/
├── .planning/
├── DEPLOYMENT.md
├── BSSSC_Parking_User_Guide_Complete.docx
├── backend/
│   ├── app.py               # Main Flask application (1297 lines)
│   ├── database.py         # Database schema initialization
│   ├── database.db         # SQLite database file
│   ├── requirements.txt    # Python dependencies
│   └── flask_session/      # Flask session storage
└── frontend/
    ├── .env.development     # Environment variables
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    ├── README.md
    ├── public/
    │   ├── index.html       # HTML entry point
    │   ├── manifest.json
    │   ├── robots.txt
    │   ├── favicon.ico
    │   └── images/
    └── src/
        ├── index.js         # React entry point
        ├── index.css        # Global styles
        ├── App.js           # Router configuration
        ├── App.css
        ├── App.test.js
        ├── config.js        # API base URL
        ├── reportWebVitals.js
        ├── setupTests.js
        ├── logo.svg
        ├── LandingPage.js   # Landing page component
        ├── LandingPage.css
        ├── StaffLogin.js    # Staff login page
        ├── StaffLogin.css
        ├── AdminLogin.js    # Admin login page
        ├── AdminLogin.css
        ├── StaffDashboard.js # Staff dashboard
        ├── StaffDashboard.css
        ├── AdminDashboard.js # Admin dashboard
        ├── AdminDashboard.css
        ├── ParkingMap.js    # Parking space visualization
        └── ParkingMap.css
        └── ManagementPage.js # User/booking management
        └── ManagementPage.css
```

## Directory Purposes

**`backend/`:**
- Purpose: Server-side application and data layer
- Contains: Flask application, database schema, SQLite data
- Key files: `app.py`, `database.py`, `database.db`

**`frontend/`:**
- Purpose: Client-side React application
- Contains: React components, CSS styles, build config
- Key files: `src/index.js`, `src/App.js`, `package.json`

**`frontend/public/`:**
- Purpose: Static assets served by React
- Contains: HTML template, images, manifest
- Key files: `index.html`

**`frontend/src/`:**
- Purpose: React source code
- Contains: Components, styles, routing, configuration

## Key File Locations

**Entry Points:**
- `backend/app.py`: Flask server startup, all API routes
- `frontend/src/index.js`: React app mounting
- `frontend/public/index.html`: HTML container for React

**Configuration:**
- `frontend/src/config.js`: API base URL configuration
- `frontend/.env.development`: Environment variables (note: exists but values not exposed)
- `backend/requirements.txt`: Python dependencies

**Core Logic:**
- `backend/app.py`: All business logic (1297 lines) - routes, auth, booking validation
- `backend/database.py`: Database schema and initialization
- `frontend/src/App.js`: Client-side routing definitions

**Testing:**
- `frontend/src/App.test.js`: React default test file

## Naming Conventions

**Files:**
- React components: PascalCase (`StaffLogin.js`, `AdminDashboard.js`)
- CSS files: Component name in PascalCase with `.css` (`StaffLogin.css`)
- Config files: Lowercase (`config.js`, `requirements.txt`)
- Backend Python: snake_case (`app.py`, `database.py`)

**Directories:**
- Single word, lowercase: `backend/`, `frontend/`, `src/`, `public/`

**Functions/Variables (backend):**
- snake_case: `get_parking_spaces()`, `create_booking()`, `db_conn`

**Functions/Components (frontend):**
- PascalCase for React components: `LandingPage`, `StaffDashboard`
- camelCase for JS functions/variables: `API_BASE`, `root.render`

## Where to Add New Code

**New Feature (Backend):**
- Primary code: `backend/app.py` - add new route handlers
- Database changes: `backend/database.py` - add new tables/columns

**New Feature (Frontend):**
- Component: `frontend/src/NewFeature.js`
- Styles: `frontend/src/NewFeature.css`
- Route: Add to `frontend/src/App.js` routes array
- API calls: Use `config.js` API_BASE

**New Component/Module:**
- Implementation: Create new `.js` file in `frontend/src/`
- Colocate CSS in same directory

**Utilities:**
- Shared helpers: Add to relevant component file (no shared utils directory)
- API configuration: `frontend/src/config.js`

## Special Directories

**`.opencode/`:**
- Purpose: GSD planning/orchestration metadata
- Generated: Yes (by GSD framework)
- Committed: No

**`.planning/`:**
- Purpose: Architecture/planning documents
- Generated: Yes (by this analysis)
- Committed: No

**`backend/flask_session/`:**
- Purpose: Flask session storage
- Generated: Yes
- Committed: No (session data)

**`frontend/public/images/`:**
- Purpose: Static images
- Generated: No (created during build)
- Committed: Yes (if custom images exist)

---

*Structure analysis: 2026-04-06*
