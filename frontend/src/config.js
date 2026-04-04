// API base URL — set REACT_APP_API_URL in .env to point at the Flask server.
// In production (Flask serving the built React files on the same server),
// leave it empty so all /api/... calls are relative to the same host.
const API_BASE = process.env.REACT_APP_API_URL || '';

export default API_BASE;
