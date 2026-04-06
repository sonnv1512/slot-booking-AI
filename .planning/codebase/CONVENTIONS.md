# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `StaffDashboard.js`, `AdminLogin.js`)
- CSS files: Component-name matching (e.g., `StaffDashboard.css`, `AdminDashboard.css`)
- Python backend: snake_case (e.g., `app.py`, `database.py`)

**Functions:**
- React components: PascalCase (function name matches file)
- Event handlers: camelCase with prefixes like `handle*`, `check*`, `fetch*` (e.g., `handleLogout`, `checkAvailability`, `fetchGrid`)
- Python functions: snake_case, descriptive (e.g., `get_parking_spaces`, `create_booking`)

**Variables:**
- React: camelCase (e.g., `user`, `authLoading`, `availableSpaces`)
- Python: snake_case (e.g., `db_conn`, `db_cursor`, `booking_request`)
- Boolean state: `is*`, `has*`, `show*`, `loading` patterns (e.g., `isRestricted`, `showModal`, `authLoading`)

**Types/Classes:**
- React components use default exports: `export default ComponentName`
- No explicit TypeScript type definitions found

## Code Style

**Formatting:**
- No Prettier or formatter config found
- EditorConfig or IDE defaults likely used
- JavaScript: 4-space indentation in React files
- Python: 4-space indentation

**Linting:**
- No ESLint config file found
- Uses React App default linting (from `package.json` `eslintConfig`)
- No custom ESLint rules defined

**JavaScript Style Observations:**
- Uses `function` declarations for React components
- Destructuring for imports: `import { useState, useEffect } from 'react'`
- Arrow functions for callbacks and effects: `() => {}`
- Template literals for string interpolation: `` `${API_BASE}/api/...` ``

**Python Style Observations:**
- Standard Flask patterns used
- No docstrings on functions
- Inline comments explaining sections (e.g., `# cors - reads allowed origin from env var`)
- Parameterized SQL queries with `?` placeholders

## Import Organization

**React (observed pattern):**
1. External libraries: `react`, `react-router-dom`
2. Internal config: `API_BASE from './config'`
3. Components: `import LandingPage from './LandingPage'`
4. CSS: `import './StaffDashboard.css'`

**Python:**
```python
from flask import Flask, jsonify, request, session
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta
```
Organized by: Flask extensions → standard library → third-party

**Path Aliases:**
- No path aliases configured (e.g., no `@/` shortcuts)
- Relative imports only: `./config`, `./LandingPage`

## Error Handling

**Backend (Flask):**
- Input validation with early returns:
```python
if field not in booking_request:
    return jsonify({'error': f'Missing field: {field}'}), 400
```
- Date parsing with try/except:
```python
try:
    datetime.strptime(requested_date, '%Y-%m-%d').date()
except ValueError:
    return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
```
- Database errors: Not explicitly caught - connections closed on error paths
- HTTP status codes: 400 for bad request, 401 for unauthenticated, 403 for forbidden, 404 for not found, 409 for conflict

**Frontend (React):**
- try/catch blocks for async API calls:
```javascript
try {
    const response = await fetch(API_BASE + '/api/check-auth', {
        credentials: 'include'
    });
    // ...
} catch (error) {
    console.error('Auth check failed:', error);
    navigate('/staff-login');
}
```
- User feedback via `alert()` for errors
- Loading states shown during async operations

**Logging:**
- Frontend: `console.error()` for API failures
- Backend: No logging framework - silent except on errors
- No structured logging (e.g., JSON logs)

## Comments

**When to Comment:**
- Section dividers in Python: `# ============= PUBLIC ENDPOINTS!!! ============================================`
- Inline explanations: `# opens connection to the database`
- TODO/FIXME: Not found in codebase
- Complex logic: Described in comments (e.g., `# grab the max booking days from settings table`)

**JSDoc/TSDoc:**
- Not used
- No type annotations in JavaScript
- No docstrings in Python functions

## Function Design

**Size:**
- Large Flask functions (500+ lines in `app.py`) - multiple endpoints in one file
- React components: 100-400 lines - reasonable size
- No strict line count rules observed

**Parameters:**
- React: Props passed explicitly, destructured in component signature
- Python Flask: `request` object accessed globally, path parameters via decorators

**Return Values:**
- Flask: Always `jsonify()` wrapped response
- React: Component JSX or `null` during redirects

## Module Design

**Exports:**
- React: Default exports only (e.g., `export default StaffDashboard`)
- No named exports observed

**Barrel Files:**
- Not used
- Direct imports from component files

## Special Patterns

**Authentication Check:**
```javascript
// In useEffect, check auth on mount
const checkAuth = async () => {
    const response = await fetch(API_BASE + '/api/check-auth', {
        credentials: 'include'
    });
    // handle response...
};
```

**Loading States:**
- Two-layer loading: `authLoading` then `loading` for data
- Conditional render based on loading states

**SQL Parameterization:**
- Always use parameterized queries: `db_cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))`
- Never string concatenation for SQL

---

*Convention analysis: 2026-04-06*