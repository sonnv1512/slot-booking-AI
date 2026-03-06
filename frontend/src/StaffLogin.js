import { useState, useEffect } from 'react';  // need useEffect too
import { useNavigate } from 'react-router-dom';
import './StaffLogin.css';

function StaffLogin() {
    // state stuff
    const [email, setEmail] = useState('');      // email
    const [password, setPassword] = useState(''); // pasword
    const [error, setError] = useState('');       // error msg
    const [loading, setLoading] = useState(false); // loading flag
    const [authLoading, setAuthLoading] = useState(true); // checking auth flag
    const navigate = useNavigate();                // for navigation

    // check if already logged in
    // runs once on load
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // ask backend if user is logged in
                const response = await fetch('http://localhost:5000/api/check-auth', {
                    credentials: 'include'  // sends session cookie
                });

                const data = await response.json();

                // if logged in, redirect to dashboard
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
                // network error whatever just show login
                console.error('Auth check failed:', error);
            } finally {
                // done checking
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);  // runs once

    // handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();  // dont refresh page
        setError('');        // clear old errors
        setLoading(true);    // show loading

        try {
            // send login reuqest to backend
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',  // sending data

                headers: {       // tell server its json
                    'Content-Type': 'application/json'
                },

                credentials: 'include',  // need cookies for session

                body: JSON.stringify({   // the login data
                    email: email,        // convert to json string
                    password: password
                })
            });

            // parse the response
            const data = await response.json();

            // check if it worked
            if (data.success) {
                // worked, go to dashboard
                navigate('/staff-dashboard');
            } else {
                // didnt work, show error
                setError(data.error || 'Login failed');
            }

        } catch (err) {
            // network error or something
            console.error('Login error:', err);
            setError('Network error. Please try again.');
        } finally {
            // always stop loading
            setLoading(false);
        }
    };

    // show loading spinner while checking auth
    // dont wanna flash the login form if theyre already logged in
    if (authLoading) {
        return (
            <div className="staff-login-container">
                <div className="login-box">
                    <p style={{ textAlign: 'center', fontSize: '18px', color: '#666' }}>
                        Loading...
                    </p>
                </div>
            </div>
        );
    }

    // the actual login form
    // only shows if not already logged in
    return (
        <div className="staff-login-container">
            <div className="login-box">
                {/* header */}
                <div className="login-header">
                    <h2>Staff Login</h2>
                </div>

                {/* form triggers handleSubmit */}
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

                    {/* pasword input */}
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

                    {/* submit btn */}
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>

                    {/* error msg if theres one */}
                    {error && <div className="error-message">{error}</div>}
                </form>

                {/* back to home link */}
                <div
                    className="back-link"
                    onClick={() => navigate('/')}  // go home
                >
                    Back to Home
                </div>
            </div>
        </div>
    );
}

export default StaffLogin;
