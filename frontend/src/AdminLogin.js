import API_BASE from './config';
import { useState, useEffect } from 'react'; // need useEffect for auth check
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css'; // admin specific styles

function AdminLogin() {
    // same state stuff as staff login basically
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [authLoading, setAuthLoading] = useState(true); // checking if theyre already logged in
    const navigate = useNavigate();

    // check if already logged in when page loads
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // hit the backend to see if theres a session
                const response = await fetch(API_BASE + '/api/check-auth', {
                    credentials: 'include' // gotta send the cookie
                });

                const data = await response.json();

                // already logged in? send em to the right place
                if (data.authenticated) {
                    if (data.user.role === 'admin') {
                        // admin goes to admin dashboard
                        navigate('/admin-dashboard');
                    } else if (data.user.role === 'staff') {
                        // staff goes to staff dashboard
                        navigate('/staff-dashboard');
                    }
                }
                // not logged in, just show the form

            } catch (error) {
                // whatever, just show the login form
                console.error('Auth check failed:', error);
            } finally {
                // done checking
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, [navigate]); // runs once on mount

    // handle login form submit, pretty much same as staff login
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(API_BASE + '/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // go to admin dashboard instead of staff one
                navigate('/admin-dashboard');
            } else {
                setError(data.error || 'Login failed');
            }

        } catch (err) {
            console.error('Login error:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // show loading spinner thing while we check auth
    if (authLoading) {
        return (
            <div className="admin-login-container">
                <div className="login-box">
                    <p style={{ textAlign: 'center', fontSize: '18px', color: '#666' }}>
                        Loading...
                    </p>
                </div>
            </div>
        );
    }

    // actual login form, only shows if not already logged in
    return (
        <div className="admin-login-container">
            <div className="login-box">
                {/* title section */}
                <div className="login-header">
                    {/* says administrator instead of staff */}
                    <h2>Administrator Login</h2>
                </div>

                {/* the login form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {/* email input */}
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            required
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* password input */}
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* login button */}
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>

                    {/* show error if somethign went wrong */}
                    {error && <div className="error-message">{error}</div>}
                </form>

                {/* link back to home */}
                <div className="back-link" onClick={() => navigate('/')}>
                    Back to Home
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
