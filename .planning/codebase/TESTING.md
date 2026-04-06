# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Frontend (React):**
- Framework: Create React App built-in testing
- Test Library: `@testing-library/react` version 16.3.1
- DOM Testing: `@testing-library/dom` version 10.4.1
- User Events: `@testing-library/user-event` version 13.5.0

**Run Commands:**
```bash
npm test                    # Run tests in interactive watch mode
npm test -- --coverage     # Run with coverage report
```

**Backend (Python/Flask):**
- No test framework configured
- No pytest, unittest, or other Python testing found

## Test File Organization

**Location:**
- Tests co-located with source files
- Test file naming: `ComponentName.test.js` (e.g., `App.test.js`)
- Location: Same directory as component (e.g., `frontend/src/App.test.js`)

**Structure:**
```
frontend/src/
├── App.js
├── App.test.js       ← Test file alongside component
├── StaffDashboard.js
├── StaffDashboard.js (no test)
└── ...
```

## Test Structure

**App.test.js (only test in codebase):**
```javascript
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
```

**Patterns:**
- Single test case in example
- Uses `@testing-library/react` patterns
- `test()` function from Jest (built into CRA)
- `render()` from Testing Library
- `screen.getByText()` for element selection

## Mocking

**What is Mocked:**
- No custom mocks found in codebase
- Uses default Jest/Testing Library behavior
- No API mocking (tests hit real endpoints if configured)

**What NOT to Mock:**
- No mock patterns established
- No service layer mocking
- No database mocking

**Mocking Opportunities Not Used:**
- `fetch` could be mocked for API testing
- React Router could be mocked: `jest.mock('react-router-dom', ...)`
- Config/API_BASE could be mocked for different environments

## Fixtures and Factories

**Test Data:**
- No fixture files found
- No test data factories
- App.test.js uses only default CRA template data

**Location:**
- No `__fixtures__` or `__mocks__` directories
- No shared test utilities

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
npm test -- --coverage
```

**Current Status:**
- Only 1 test file exists (`App.test.js`)
- Coverage likely very low
- No coverage threshold configured in `package.json`

## Test Types

**Unit Tests:**
- Scope: Basic React component rendering
- Approach: Not established - only 1 auto-generated test

**Integration Tests:**
- Not implemented
- No tests for API calls, auth flow, or database interactions

**E2E Tests:**
- Not used
- No Cypress, Playwright, or Selenium configured

## Common Patterns

**Async Testing:**
- Not observed in codebase
- No async/await patterns in tests

**Error Testing:**
- Not implemented
- No tests for error boundaries or error states

**Component Testing:**
- Basic render test pattern only
- No tests for: user interactions, state changes, props, conditional rendering

## Test Gaps

**Backend Tests:**
- No Python/Flask tests at all
- No API endpoint tests
- No database tests
- No authentication tests

**Frontend Gaps:**
- No tests for:
  - Authentication flow (login, logout, session handling)
  - Booking creation/cancellation
  - Admin dashboard functionality
  - Staff dashboard functionality
  - API error handling
  - Loading states
  - Form validation

**Missing Testing Infrastructure:**
- No test setup files (`setupTests.js` exists but is minimal)
- No test utilities or helpers
- No mocking of external dependencies

---

*Testing analysis: 2026-04-06*