import API_BASE from './config';
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
    const [maxBookingDays, setMaxBookingDays] = useState(14);
    const [daysToShow, setDaysToShow] = useState(14);

    // booking details modal (booked cell)
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // restricted slots toggle
    const [showRestricted, setShowRestricted] = useState(true);
    const [slotsMeta, setSlotsMeta] = useState({});  // {slotNumber: {is_restricted}}

    // create booking modal (available cell)
    const [showBookModal, setShowBookModal] = useState(false);
    const [bookingCell, setBookingCell] = useState(null);  // {date, space}
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);

    // user search combobox state
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

    // check auth on page load
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch(API_BASE + '/api/check-auth', {
                    credentials: 'include'
                });
                const data = await response.json();
                if (data.authenticated) {
                    if (data.user.role === 'admin') {
                        setUser(data.user);
                    } else {
                        navigate('/staff-dashboard');
                    }
                } else {
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

    // fetch grid data - extracted so we can refresh after create/delete
    const fetchGrid = () => {
        fetch(`${API_BASE}/api/admin/grid-view?days=${daysToShow}`, {
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => {
                setGridData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching grid:', error);
                setLoading(false);
            });
    };

    // fetch users for the booking dropdown
    const fetchUsers = async () => {
        try {
            const response = await fetch(API_BASE + '/api/admin/users', {
                credentials: 'include'
            });
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // fetch max booking days setting so the dropdown stays in sync
    const fetchMaxDays = async () => {
        try {
            const response = await fetch(API_BASE + '/api/admin/settings', {
                credentials: 'include'
            });
            const data = await response.json();
            setMaxBookingDays(data.max_booking_days);
            // if current daysToShow exceeds the new max, clamp it
            setDaysToShow(prev => Math.min(prev, data.max_booking_days));
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    // fetch slot metadata (includes is_restricted)
    const fetchSlotsMeta = async () => {
        try {
            const response = await fetch(API_BASE + '/api/admin/slots', {
                credentials: 'include'
            });
            const data = await response.json();
            const meta = {};
            data.forEach(s => { meta[s.parking_slot_number] = s; });
            setSlotsMeta(meta);
        } catch (error) {
            console.error('Error fetching slots meta:', error);
        }
    };

    // grab grid + users whenever user or daysToShow changes
    useEffect(() => {
        if (!user) return;
        fetchGrid();
        fetchUsers();
        fetchMaxDays();
        fetchSlotsMeta();
    }, [user, daysToShow]);  // eslint-disable-line react-hooks/exhaustive-deps

    // clicking any cell - available opens book modal, booked opens details modal
    const handleCellClick = (booking, date, space) => {
        if (booking) {
            setSelectedBooking({ ...booking, date, space });
            setShowModal(true);
        } else {
            setBookingCell({ date, space });
            setSelectedUserId('');
            setUserSearch('');
            setShowUserDropdown(false);
            setShowBookModal(true);
        }
    };

    // create a booking from the book modal
    const handleCreateBooking = async () => {
        if (!selectedUserId) {
            alert('Please select a user');
            return;
        }
        setBookingLoading(true);
        try {
            const response = await fetch(API_BASE + '/api/admin/bookings/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: parseInt(selectedUserId),
                    parking_slot_number: bookingCell.space,
                    booking_date: bookingCell.date,
                    override: false
                })
            });
            const data = await response.json();
            if (data.success) {
                setShowBookModal(false);
                fetchGrid();
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            alert('Failed to create booking');
        } finally {
            setBookingLoading(false);
        }
    };

    // delete a booking from the details modal
    const handleDeleteBooking = async () => {
        if (!window.confirm(`Delete booking for ${selectedBooking.user_name} on ${formatDate(selectedBooking.date)}?`)) return;
        setDeleteLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/bookings/${selectedBooking.booking_id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                closeModal();
                fetchGrid();
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Failed to delete booking');
        } finally {
            setDeleteLoading(false);
        }
    };

    // close the details modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedBooking(null);
    };

    // logout
    const handleLogout = async () => {
        try {
            await fetch(API_BASE + '/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            navigate('/');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // format date nice like "Mon, Jan 15"
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    if (authLoading) {
        return <div className="loading">Checking authentication...</div>;
    }

    if (!user) {
        return null;
    }

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    // derive slot list from gridData keys (sorted numerically where possible), filtered by showRestricted
    const slots = Object.keys(gridData).length > 0
        ? Object.keys(Object.values(gridData)[0])
            .filter(s => showRestricted || !slotsMeta[s]?.is_restricted)
            .sort((a, b) => {
                const aNum = parseInt(a);
                const bNum = parseInt(b);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return a.localeCompare(b);
            })
        : [];

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
            <div className="section section-fill">
                <div className="section-header">
                    <h2>At-a-Glance Overview</h2>
                    <div className="header-controls">
                        <select
                            value={daysToShow}
                            onChange={(e) => setDaysToShow(Number(e.target.value))}
                            className="days-selector"
                        >
                            <option value={7}>Next 7 Days</option>
                            <option value={maxBookingDays}>Next {maxBookingDays} Days</option>
                        </select>
                        {Object.values(slotsMeta).some(s => s.is_restricted) && (
                            <button
                                className={`restricted-toggle-btn ${showRestricted ? 'active' : ''}`}
                                onClick={() => setShowRestricted(prev => !prev)}
                                title={showRestricted ? 'Hide restricted slots' : 'Show restricted slots'}
                            >
                                {showRestricted ? '🔒 Hide Restricted' : '🔒 Show Restricted'}
                            </button>
                        )}
                    </div>
                </div>
                <p className="grid-hint">Click a green cell to book a space, or a red cell to view / delete the booking.</p>

                <div className="grid-container">
                    <table className="grid-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                {slots.map(space => (
                                    <th key={space} className={slotsMeta[space]?.is_restricted ? 'col-restricted' : ''}>
                                        Space {space}{slotsMeta[space]?.is_restricted ? ' 🔒' : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(gridData).sort().map(date => (
                                <tr key={date}>
                                    <td className="date-cell">{formatDate(date)}</td>
                                    {slots.map(space => {
                                        const booking = gridData[date][space];
                                        return (
                                            <td
                                                key={space}
                                                className={booking ? 'cell-booked' : 'cell-available'}
                                                onClick={() => handleCellClick(booking, date, space)}
                                            >
                                                {booking ? booking.user_name : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* booking details modal (booked cell) */}
            {showModal && selectedBooking && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>✕</button>

                        <h2>Booking Details</h2>

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

                        <div className="modal-actions">
                            <button className="btn-close" onClick={closeModal}>
                                Close
                            </button>
                            <button
                                className="btn-delete"
                                onClick={handleDeleteBooking}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* create booking modal (available cell) */}
            {showBookModal && bookingCell && (
                <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowBookModal(false)}>✕</button>

                        <h2>Book This Space</h2>

                        <div className="modal-info">
                            <div className="info-row">
                                <span className="info-label">Space:</span>
                                <span className="info-value">Space {bookingCell.space}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Date:</span>
                                <span className="info-value">{formatDate(bookingCell.date)}</span>
                            </div>
                        </div>

                        <div className="book-form">
                            <label className="book-form-label">Assign to User:</label>
                            <div className="user-search-wrapper">
                                <input
                                    type="text"
                                    className="user-search-input"
                                    placeholder="Search by name or email..."
                                    value={userSearch}
                                    onChange={(e) => {
                                        setUserSearch(e.target.value);
                                        setSelectedUserId('');
                                        setShowUserDropdown(true);
                                    }}
                                    onFocus={() => setShowUserDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
                                    autoComplete="off"
                                />
                                {showUserDropdown && (
                                    <div className="user-search-dropdown">
                                        {users
                                            .filter(u =>
                                                u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                u.email.toLowerCase().includes(userSearch.toLowerCase())
                                            )
                                            .slice(0, 50)
                                            .map(u => (
                                                <div
                                                    key={u.id}
                                                    className="user-search-option"
                                                    onMouseDown={() => {
                                                        setSelectedUserId(u.id);
                                                        setUserSearch(`${u.name} (${u.email})`);
                                                        setShowUserDropdown(false);
                                                    }}
                                                >
                                                    <span className="user-option-name">{u.name}</span>
                                                    <span className="user-option-email">{u.email}</span>
                                                </div>
                                            ))
                                        }
                                        {users.filter(u =>
                                            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                            u.email.toLowerCase().includes(userSearch.toLowerCase())
                                        ).length === 0 && (
                                            <div className="user-search-empty">No users found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-close" onClick={() => setShowBookModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn-book"
                                onClick={handleCreateBooking}
                                disabled={bookingLoading || !selectedUserId}
                            >
                                {bookingLoading ? 'Booking...' : 'Create Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
