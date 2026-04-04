import API_BASE from './config';
import { useState, useEffect } from 'react';  // added useEffect
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
    const navigate = useNavigate();
    const [clickCount, setClickCount] = useState(0);
    const [authLoading, setAuthLoading] = useState(true);  // checking auth or nah

    // see if the user is alredy logged in when this loads
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // hit the backend to see if theyre logged in
                const response = await fetch(API_BASE + '/api/check-auth', {
                    credentials: 'include'  // gotta send the session cookie
                });

                const data = await response.json();

                // if logged in, bounce em to the right dashboard
                if (data.authenticated) {
                    if (data.user.role === 'admin') {
                        // admin goes to admin dash
                        navigate('/admin-dashboard');
                    } else if (data.user.role === 'staff') {
                        // staff goes to staff dash
                        navigate('/staff-dashboard');
                    }
                }
                // not logged in? thats fine, just show the landing page

            } catch (error) {
                // somethng went wrong, whatever just show the page
                console.error('Auth check failed:', error);
            } finally {
                // done checking either way
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);  // runs once on mount

    // logo click handler, easter egg for admin login lol
    const handleLogoClick = () => {
        const newCount = clickCount + 1;  // bump the count
        setClickCount(newCount);           // save it

        // three clicks and ur in
        if (newCount === 3) {
            navigate('/admin-login');      // off to admin login
        }

        // reset after a sec
        setTimeout(() => {
            setClickCount(0);
        }, 1000);
    };

    // loading spinner-ish thing so it doesnt flash the page before redirect
    if (authLoading) {
        return (
            <div className="landing-container"
                style={{
                    backgroundImage: `url(${process.env.PUBLIC_URL}/images/school-background-image.jpg)`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <div className="landing-content">
                    <p style={{ fontSize: '20px', color: '#666' }}>Loading...</p>
                </div>
            </div>
        );
    }

    // the actual landing page, only shows if not logged in
    return (
        <div
            className="landing-container"
            style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/images/school-background-image.jpg)` }}
        >
            {/* credits section */}
            <div className="credits">
                <p>Created by Nam Khánh Aeter Vũ (Year 12 - 2026)</p>
            </div>
            {/* white card on top of the bg */}
            <div className="landing-content">
                {/* school logo, triple click for sneaky admin access */}
                <div className="school-logo" onClick={handleLogoClick}>
                    <img src="/images/bsssc-logo.png" alt="BSSSC Logo" />
                </div>

                {/* welcome msg */}
                <h1>Welcome to BSSSC Parking Booking Portal</h1>

                {/* staff login btn */}
                <button
                    className="staff-login-btn"
                    onClick={() => navigate('/staff-login')}
                >
                    Staff Login
                </button>
            </div>
        </div>
    );
}

export default LandingPage;
