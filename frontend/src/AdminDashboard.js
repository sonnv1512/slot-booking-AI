import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

function AdminDashboard() {
    // auth states
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // data stuff
    const [gridData, setGridData] = useState({});
    const [loading, setLoading] = useState(true);
    const [daysToShow, setDaysToShow] = useState(14);  // how many days we show in the grid

    // modal states to diplsay detailed booking info
    const [selectedBooking, setSelectedBooking] = useState(null);  // whichever booking the admin clicked on
    const [showModal, setShowModal] = useState(false);  // whether the modal is visble or not

    // check auth on page load
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/check-auth', {
                    credentials: 'include'  // send the session cookie along
                });

                const data = await response.json();

                if (data.authenticated) {
                    if (data.user.role === 'admin') {
                        setUser(data.user);
                    } else {
                        // theyre logged in but not admin, send em to staff
                        navigate('/staff-dashboard');
                    }
                } else {
                    // not authenticated, redirect to admin login page lmao
                    navigate('/admin-login');
                }

            } catch (error) {
                console.error('Auth check failed:', error);
                navigate('/admin-login');
            } finally {
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);

    // grab grid data whenever user or daysToShow changes
    useEffect(() => {
        if (!user) return;  // dont fetch if user isnt authed yet

        fetch(`http://localhost:5000/api/admin/grid-view?days=${daysToShow}`, {
            credentials: 'include'  // send session cookie
        })
            .then(response => response.json())
            .then(data => {
                setGridData(data);  // store it
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching grid:', error);
                setLoading(false);
            });
    }, [user, daysToShow]);  // re-run when these change

    // handle clicking on a booked cell
    const handleCellClick = (booking, date, space) => {
        if (booking) {  // only open modal if theres actually a booking there
            // stick the date and space onto the booking data
            setSelectedBooking({
                ...booking,  // spread existing booking stuff
                date,
                space
            });
            setShowModal(true);  // show it
        }
        // if its availble (booking is null) just do nothing
    };

    // close the modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedBooking(null);  // clear it out
    };

    // logout
    const handleLogout = async () => {
        try {
            await fetch('http://localhost:5000/api/logout', {
                method: 'POST',
                credentials: 'include'  // send cookie so backend knows which session to kill
            });
            navigate('/');  // back to landing page
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // format date nice like "Mon, Jan 15"
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');  // add time to avoid timezone weirdness
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    // loading stuff
    if (authLoading) {
        return <div className="loading">Checking authentication...</div>;
    }

    if (!user) {
        return null;  // dont render anyhting, will redirect
    }

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    return (
        <div className="admin-dashboard">
            {/* header */}
            <div className="dashboard-header">
                <h1>Administrator Dashboard</h1>
                <div className="user-info">
                    <span>Welcome, {user.email}!</span>
                    <button onClick={handleLogout} className="logout-btn">
                        Logout
                    </button>
                </div>
            </div>


            {/* management button */}
            <div className="section">
                <button
                    className="management-btn"
                    onClick={() => navigate('/management')}
                >
                    📋 Manage Assignment & Settings
                </button>
            </div>

            {/* the big grid view */}
            <div className="section">
                <div className="section-header">
                    <h2>At-a-Glance Overview</h2>
                    {/* dropdown to pick how many days to show */}
                    <select
                        value={daysToShow}
                        onChange={(e) => setDaysToShow(Number(e.target.value))}
                        className="days-selector"
                    >
                        <option value={7}>Next 7 Days</option>
                        <option value={14}>Next 14 Days</option>
                    </select>
                </div>

                <div className="grid-container">
                    <table className="grid-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Space 60</th>
                                <th>Space 61</th>
                                <th>Space 62</th>
                                <th>Space 63</th>
                                <th>Space 64</th>
                                <th>Space 65</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* loop thru each date */}
                            {Object.keys(gridData).sort().map(date => (
                                <tr key={date}>
                                    <td className="date-cell">{formatDate(date)}</td>
                                    {/* loop thru each parking space 60-65 */}
                                    {['60', '61', '62', '63', '64', '65'].map(space => {
                                        const booking = gridData[date][space];  // grab booking for this cell, null if availble
                                        return (
                                            <td
                                                key={space}
                                                className={booking ? 'cell-booked' : 'cell-available'}  // red if booked green if free
                                                onClick={() => handleCellClick(booking, date, space)}  // open modal on click
                                            >
                                                {/* show first name if booked, nothing if free */}
                                                {booking ? booking.user_name.split(' ')[0] : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* booking details modal, only shows when showModal is true */}
            {showModal && selectedBooking && (
                <div className="modal-overlay" onClick={closeModal}>
                    {/* stopPropagation so clicking inside the modal doesnt close it */}
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        {/* close button */}
                        <button className="modal-close" onClick={closeModal}>
                            ✕
                        </button>

                        <h2>Booking Details</h2>

                        {/* diplsay all the booking info */}
                        <div className="modal-info">
                            <div className="info-row">
                                <span className="info-label">Booking ID:</span>
                                <span className="info-value">{selectedBooking.booking_id}</span>
                            </div>

                            <div className="info-row">
                                <span className="info-label">Parking Space:</span>
                                <span className="info-value">Space {selectedBooking.space}</span>
                            </div>

                            <div className="info-row">
                                <span className="info-label">Date:</span>
                                <span className="info-value">{formatDate(selectedBooking.date)}</span>
                            </div>

                            <div className="info-row">
                                <span className="info-label">User Name:</span>
                                <span className="info-value">{selectedBooking.user_name}</span>
                            </div>

                            <div className="info-row">
                                <span className="info-label">Email:</span>
                                <span className="info-value">{selectedBooking.user_email}</span>
                            </div>
                        </div>

                        {/* buttons */}
                        <div className="modal-actions">
                            <button className="btn-close" onClick={closeModal}>
                                Close
                            </button>
                            {/* maybe add delete/edit buttons here later */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
