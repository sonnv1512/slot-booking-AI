import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManagementPage.css';

function ManagementPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users');

    //check if logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/check-auth', {
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

    //loading stuff
    if (authLoading) {
        return <div className="loading">Checking authentication...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="management-page">
            {/* header */}
            <div className="management-header">
                <div>
                    <h1>Management & Settings</h1>
                    <p className="subtitle">Manage users, bookings, and system configuration</p>
                </div>
                <button
                    className="back-btn"
                    onClick={() => navigate('/admin-dashboard')}
                >
                    ← Back to Dashboard
                </button>
            </div>

            {/* tab nav */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bookings')}
                >
                    🅿️ Bookings
                </button>
                <button
                    className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ Settings
                </button>
            </div>

            {/* tab content */}
            <div className="tab-content">
                {activeTab === 'users' && <UsersTab currentUserId={user.id} />}
                {activeTab === 'bookings' && <BookingsTab />}
                {activeTab === 'settings' && <SettingsTab />}
            </div>
        </div>
    );
}

// ----- users tab -----
function UsersTab({ currentUserId }) {
    //users data
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    //search
    const [searchQuery, setSearchQuery] = useState('');

    //modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalMode, setModalMode] = useState(''); // 'password' or 'role'

    //grab users on mount
    useEffect(() => {
        fetchUsers();
    }, []);

    //search filter stuff
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredUsers(users);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query)
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    //fetch all users from api
    const fetchUsers = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/admin/users', {
                credentials: 'include'
            });
            const data = await response.json();
            setUsers(data);
            setFilteredUsers(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            setLoading(false);
        }
    };

    //search input change
    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    //open edit modal
    const openEditModal = (user, mode) => {
        setSelectedUser(user);
        setModalMode(mode);
        setShowEditModal(true);
    };

    //delete a user
    const handleDeleteUser = async (userId) => {
        if (userId === currentUserId) {
            alert('Cannot delete your own account!');
            return;
        }

        const confirmed = window.confirm('Are you sure you want to delete this user? This will also delete all their bookings.');

        if (confirmed) {
            try {
                const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.success) {
                    alert('User deleted successfully');
                    fetchUsers(); //refresh list
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Failed to delete user');
            }
        }
    };

    if (loading) {
        return <div className="loading">Loading users...</div>;
    }

    return (
        <div className="users-tab">
            {/* search and add user */}
            <div className="users-controls">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="search-input"
                />
                <button
                    className="add-user-btn"
                    onClick={() => setShowAddModal(true)}
                >
                    + Add User
                </button>
            </div>

            {/* users table */}
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.length === 0 ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                                {searchQuery ? 'No users found matching your search' : 'No users found'}
                            </td>
                        </tr>
                    ) : (
                        filteredUsers.map(user => (
                            <tr key={user.id}>
                                <td>{user.name}</td>
                                <td>{user.email}</td>
                                <td>
                                    <span className={`role-badge ${user.role}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="actions-cell">
                                    <button
                                        className="action-btn edit-btn"
                                        onClick={() => openEditModal(user, 'password')}
                                        title="Change Password"
                                    >
                                        🔑
                                    </button>
                                    <button
                                        className="action-btn role-btn"
                                        onClick={() => openEditModal(user, 'role')}
                                        title="Change Role"
                                        disabled={user.id === currentUserId}
                                    >
                                        👤
                                    </button>
                                    <button
                                        className="action-btn delete-btn"
                                        onClick={() => handleDeleteUser(user.id)}
                                        title="Delete User"
                                        disabled={user.id === currentUserId}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* add user modal */}
            {showAddModal && (
                <AddUserModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchUsers}
                />
            )}

            {/* edit user modal */}
            {showEditModal && selectedUser && (
                <EditUserModal
                    user={selectedUser}
                    mode={modalMode}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={fetchUsers}
                />
            )}
        </div>
    );
}

// ----- bookigns tab -----
function BookingsTab() {
    //booking form stuff
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedSpace, setSelectedSpace] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(false);

    //user search for manual booking
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);

    //users list
    const [users, setUsers] = useState([]);

    //bookings table
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);

    //bookings filters
    const [filterUserQuery, setFilterUserQuery] = useState('');
    const [filterUserResults, setFilterUserResults] = useState([]);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [selectedFilterUser, setSelectedFilterUser] = useState(null);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSpace, setFilterSpace] = useState('');

    //sorting
    const [sortField, setSortField] = useState('booking_date');
    const [sortDirection, setSortDirection] = useState('desc');

    //availbility check
    const [availableSpaces, setAvailableSpaces] = useState([]);

    //hover popup
    const [hoveredSpace, setHoveredSpace] = useState(null);
    const [hoverInfo, setHoverInfo] = useState(null);

    //parking spaces
    const spaces = [60, 61, 62, 63, 64, 65];

    //load users and bookigns on mount
    useEffect(() => {
        fetchUsers();
        fetchBookings();
    }, []);

    //filter user search results when typing (manual booking form)
    useEffect(() => {
        if (userSearchQuery.trim() === '') {
            setUserSearchResults([]);
            setShowUserDropdown(false);
            setUserDropdownOpen(false);
        } else {
            const query = userSearchQuery.toLowerCase();
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query)
            );
            setUserSearchResults(filtered);
            setShowUserDropdown(filtered.length > 0);
            if (!selectedUser) {
                setUserDropdownOpen(filtered.length > 0);
            }
        }
    }, [userSearchQuery, users, selectedUser]);

    //filter user search for the bookings filter
    useEffect(() => {
        if (filterUserQuery.trim() === '') {
            setFilterUserResults([]);
            setShowFilterDropdown(false);
            setFilterDropdownOpen(false);
        } else {
            const query = filterUserQuery.toLowerCase();
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query)
            );
            setFilterUserResults(filtered);
            setShowFilterDropdown(filtered.length > 0);
            if (!selectedFilterUser) {
                setFilterDropdownOpen(filtered.length > 0);
            }
        }
    }, [filterUserQuery, users, selectedFilterUser]);

    //filter and sort bookings
    useEffect(() => {
        let filtered = [...bookings];

        //filter by user
        if (selectedFilterUser) {
            filtered = filtered.filter(booking =>
                booking.user_name === selectedFilterUser.name
            );
        }

        //filter by date range
        if (filterStartDate) {
            filtered = filtered.filter(booking =>
                booking.booking_date >= filterStartDate
            );
        }
        if (filterEndDate) {
            filtered = filtered.filter(booking =>
                booking.booking_date <= filterEndDate
            );
        }

        //filter by space
        if (filterSpace) {
            filtered = filtered.filter(booking =>
                booking.parking_slot_number === parseInt(filterSpace)
            );
        }

        //sort em
        filtered.sort((a, b) => {
            let aValue, bValue;

            if (sortField === 'booking_date' || sortField === 'created_at') {
                aValue = new Date(a[sortField]);
                bValue = new Date(b[sortField]);
            } else if (sortField === 'parking_slot_number' || sortField === 'booking_id') {
                aValue = a[sortField];
                bValue = b[sortField];
            } else if (sortField === 'user_name') {
                aValue = a.user_name.toLowerCase();
                bValue = b.user_name.toLowerCase();
            }

            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredBookings(filtered);
    }, [selectedFilterUser, filterStartDate, filterEndDate, filterSpace, sortField, sortDirection, bookings]);

    //check availble spaces when date changes
    useEffect(() => {
        if (selectedDate) {
            checkAvailability(selectedDate);
        } else {
            setAvailableSpaces([]);
        }
    }, [selectedDate]);

    //fetch all users
    const fetchUsers = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/admin/users', {
                credentials: 'include'
            });
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    //fetch all bookigns
    const fetchBookings = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/admin/all-bookings', {
                credentials: 'include'
            });
            const data = await response.json();
            setBookings(data);
            setFilteredBookings(data);
            setBookingsLoading(false);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            setBookingsLoading(false);
        }
    };

    //check which spaces are availble for the date
    const checkAvailability = async (date) => {
        try {
            const response = await fetch(`http://localhost:5000/api/spaces/available?date=${date}`, {
                credentials: 'include'
            });
            const data = await response.json();
            setAvailableSpaces(data.map(s => s.parking_slot_number));
        } catch (error) {
            console.error('Error checking availability:', error);
        }
    };

    //pick a user from search results
    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setUserSearchQuery(user.name);
        setUserDropdownOpen(false);
    };

    //pick a user for filter
    const handleFilterUserSelect = (user) => {
        setSelectedFilterUser(user);
        setFilterUserQuery(user.name);
        setFilterDropdownOpen(false);
    };

    //pick a space
    const handleSpaceSelect = (space) => {
        setSelectedSpace(space);
    };

    //hover on occupied space to see who booked it
    const handleSpaceHover = async (space) => {
        if (!selectedDate) return;

        const isAvailable = availableSpaces.includes(space);
        if (isAvailable) return;

        setHoveredSpace(space);

        //get booking info
        try {
            const response = await fetch(
                `http://localhost:5000/api/admin/booking-info?space=${space}&date=${selectedDate}`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                setHoverInfo(data);
            } else {
                //space is unavailble but no booking (prob out of service)
                setHoverInfo({
                    out_of_service: true,
                    message: 'This space is currently out of service'
                });
            }
        } catch (error) {
            console.error('Error fetching hover info:', error);
            setHoverInfo({
                out_of_service: true,
                message: 'This space is currently out of service'
            });
        }
    };

    //mouse left the space
    const handleSpaceLeave = () => {
        setHoveredSpace(null);
        setHoverInfo(null);
    };

    //sort columns
    const handleSort = (field) => {
        if (sortField === field) {
            //toggle direction
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            //new field, default desc
            setSortField(field);
            setSortDirection('desc');
        }
    };

    //format date nicely
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    //export to csv
    const handleExportCSV = () => {
        if (filteredBookings.length === 0) {
            alert('No bookings to export');
            return;
        }

        //csv headers
        const headers = ['Booking ID', 'User Name', 'User Email', 'Space', 'Booking Date', 'Created At'];

        //csv rows
        const rows = filteredBookings.map(booking => [
            booking.booking_id,
            booking.user_name,
            booking.user_email,
            booking.parking_slot_number,
            booking.booking_date,
            booking.created_at
        ]);

        //combine and build csv
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        //download it
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    //create a manual booking
    const handleCreateBooking = async () => {
        if (!selectedUser) {
            alert('Please select a user');
            return;
        }
        if (!selectedSpace) {
            alert('Please select a parking space');
            return;
        }
        if (!selectedDate) {
            alert('Please select a date');
            return;
        }

        const isAvailable = availableSpaces.includes(selectedSpace);

        if (!isAvailable) {
            const override = window.confirm(
                `Space ${selectedSpace} is already booked for ${selectedDate}.\n\nDo you want to OVERRIDE the existing booking?`
            );

            if (!override) {
                return;
            }

            await createBookingAPI(true);
        } else {
            await createBookingAPI(false);
        }
    };

    //actual api call to create booking
    const createBookingAPI = async (override) => {
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/admin/bookings/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: selectedUser.id,
                    parking_slot_number: selectedSpace,
                    booking_date: selectedDate,
                    override: override
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);

                setSelectedUser(null);
                setUserSearchQuery('');
                setSelectedSpace('');
                setSelectedDate('');

                fetchBookings();
                checkAvailability(selectedDate);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            alert('Failed to create booking');
        } finally {
            setLoading(false);
        }
    };

    //cancel a booking
    const handleCancelBooking = async (bookingId) => {
        const confirmed = window.confirm('Are you sure you want to cancel this booking?');

        if (confirmed) {
            try {
                const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}?user_id=1`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.success) {
                    alert('Booking cancelled successfully');
                    fetchBookings();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                console.error('Error cancelling booking:', error);
                alert('Failed to cancel booking');
            }
        }
    };

    //clear all filters
    const handleClearFilters = () => {
        setSelectedFilterUser(null);
        setFilterUserQuery('');
        setFilterStartDate('');
        setFilterEndDate('');
        setFilterSpace('');
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="bookings-tab">
            <h3>Manual Booking Interface</h3>
            <p className="tab-description">
                Create bookings on behalf of users. You can override existing bookings if needed.
            </p>

            <div className="booking-form-container">
                {/* user search */}
                <div className="form-section">
                    <label className="form-label">Select User:</label>
                    <div className="user-search-container">
                        <input
                            type="text"
                            className="user-search-input"
                            placeholder="Search by name or email..."
                            value={userSearchQuery}
                            onChange={(e) => {
                                setUserSearchQuery(e.target.value);
                                setUserDropdownOpen(true);
                            }}
                            onFocus={() => {
                                if (userSearchQuery && userSearchResults.length > 0 && !selectedUser) {
                                    setUserDropdownOpen(true);
                                }
                            }}
                        />

                        {userDropdownOpen && userSearchResults.length > 0 && (
                            <div className="user-dropdown">
                                {userSearchResults.map(user => (
                                    <div
                                        key={user.id}
                                        className="user-dropdown-item"
                                        onClick={() => handleUserSelect(user)}
                                    >
                                        <div className="user-dropdown-name">{user.name}</div>
                                        <div className="user-dropdown-email">{user.email}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedUser && (
                            <div className="selected-user-display">
                                <span>✓ Selected: {selectedUser.name} ({selectedUser.email})</span>
                                <button
                                    className="clear-user-btn"
                                    onClick={() => {
                                        setSelectedUser(null);
                                        setUserSearchQuery('');
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* date picker */}
                <div className="form-section">
                    <label className="form-label">Select Date:</label>
                    <input
                        type="date"
                        className="date-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={today}
                    />
                </div>

                {/* space selection */}
                <div className="form-section">
                    <label className="form-label">
                        Select Parking Space:
                        {selectedDate && (
                            <span className="availability-hint">
                                (Green = Available, Red = Booked - Hover to see details)
                            </span>
                        )}
                    </label>
                    <div className="space-selector">
                        {spaces.map(space => {
                            const isAvailable = availableSpaces.includes(space);
                            const isSelected = selectedSpace === space;
                            const isHovered = hoveredSpace === space;

                            return (
                                <div key={space} className="space-wrapper">
                                    <button
                                        className={`space-btn ${isSelected ? 'selected' : ''} ${selectedDate ? (isAvailable ? 'available' : 'occupied') : 'neutral'
                                            }`}
                                        onClick={() => handleSpaceSelect(space)}
                                        onMouseEnter={() => handleSpaceHover(space)}
                                        onMouseLeave={handleSpaceLeave}
                                        disabled={!selectedDate}
                                    >
                                        {space}
                                    </button>

                                    {isHovered && hoverInfo && !isAvailable && (
                                        <div className="space-hover-popup">
                                            {hoverInfo.out_of_service ? (
                                                <>
                                                    <div className="hover-popup-header">⚠️ Out of Service</div>
                                                    <div className="hover-popup-message">{hoverInfo.message}</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="hover-popup-header">Booked by:</div>
                                                    <div className="hover-popup-name">{hoverInfo.user_name}</div>
                                                    <div className="hover-popup-email">{hoverInfo.user_email}</div>
                                                    <div className="hover-popup-role">Role: {hoverInfo.user_role}</div>
                                                    <div className="hover-popup-id">Booking ID: {hoverInfo.booking_id}</div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {!selectedDate && (
                        <p className="hint-text">Select a date to see availability</p>
                    )}
                </div>

                <button
                    className="create-booking-btn"
                    onClick={handleCreateBooking}
                    disabled={loading || !selectedUser || !selectedSpace || !selectedDate}
                >
                    {loading ? 'Creating...' : '📋 Create Booking'}
                </button>
            </div>

            {/* all bookings section */}
            <div className="current-bookings-section">
                <div className="bookings-header">
                    <h3>All Bookings</h3>
                    <button className="export-btn" onClick={handleExportCSV}>
                        📥 Export CSV
                    </button>
                </div>
                <p className="section-description">Search, filter, and manage all parking bookings</p>

                {/* filters */}
                <div className="booking-filters-advanced">
                    {/* user filter */}
                    <div className="filter-user-container">
                        <label className="filter-label">Filter by User:</label>
                        <input
                            type="text"
                            placeholder="Search name or email..."
                            value={filterUserQuery}
                            onChange={(e) => {
                                setFilterUserQuery(e.target.value);
                                setFilterDropdownOpen(true);
                            }}
                            onFocus={() => {
                                if (filterUserQuery && filterUserResults.length > 0 && !selectedFilterUser) {
                                    setFilterDropdownOpen(true);
                                }
                            }}
                            className="filter-input"
                        />

                        {filterDropdownOpen && filterUserResults.length > 0 && (
                            <div className="filter-dropdown">
                                {filterUserResults.map(user => (
                                    <div
                                        key={user.id}
                                        className="filter-dropdown-item"
                                        onClick={() => handleFilterUserSelect(user)}
                                    >
                                        <div className="filter-dropdown-name">{user.name}</div>
                                        <div className="filter-dropdown-email">{user.email}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedFilterUser && (
                            <div className="selected-filter-display">
                                <span>✓ {selectedFilterUser.name}</span>
                                <button
                                    className="clear-filter-user-btn"
                                    onClick={() => {
                                        setSelectedFilterUser(null);
                                        setFilterUserQuery('');
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {/* date range filter */}
                    <div className="filter-date-range">
                        <label className="filter-label">Date Range:</label>
                        <div className="date-range-inputs">
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="filter-date-input"
                                placeholder="Start date"
                            />
                            <span className="date-range-separator">→</span>
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                className="filter-date-input"
                                placeholder="End date"
                            />
                        </div>
                    </div>

                    {/* space filter */}
                    <div className="filter-space-container">
                        <label className="filter-label">Filter by Space:</label>
                        <select
                            value={filterSpace}
                            onChange={(e) => setFilterSpace(e.target.value)}
                            className="filter-space-select"
                        >
                            <option value="">All Spaces</option>
                            {spaces.map(space => (
                                <option key={space} value={space}>Space {space}</option>
                            ))}
                        </select>
                    </div>

                    {/* clear filters btn */}
                    {(selectedFilterUser || filterStartDate || filterEndDate || filterSpace) && (
                        <button
                            className="clear-filters-btn"
                            onClick={handleClearFilters}
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>

                {/* results count */}
                <div className="results-info">
                    Showing {filteredBookings.length} of {bookings.length} bookings
                </div>

                {bookingsLoading ? (
                    <div className="loading">Loading bookings...</div>
                ) : (
                    <table className="bookings-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('booking_id')} className="sortable">
                                    Booking ID {sortField === 'booking_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('user_name')} className="sortable">
                                    User {sortField === 'user_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('parking_slot_number')} className="sortable">
                                    Space {sortField === 'parking_slot_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('booking_date')} className="sortable">
                                    Date {sortField === 'booking_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('created_at')} className="sortable">
                                    Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                                        {(selectedFilterUser || filterStartDate || filterEndDate || filterSpace)
                                            ? 'No bookings matching filters'
                                            : 'No bookings found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map(booking => (
                                    <tr key={booking.booking_id}>
                                        <td>{booking.booking_id}</td>
                                        <td>
                                            {booking.user_name}
                                            <br />
                                            <span className="email-text">{booking.user_email}</span>
                                        </td>
                                        <td>Space {booking.parking_slot_number}</td>
                                        <td>{formatDate(booking.booking_date)}</td>
                                        <td>{booking.created_at}</td>
                                        <td>
                                            <button
                                                className="cancel-booking-btn"
                                                onClick={() => handleCancelBooking(booking.booking_id)}
                                            >
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ----- settings tab -----
function SettingsTab() {
    //settings data
    const [maxBookingDays, setMaxBookingDays] = useState(14);
    const [tempMaxDays, setTempMaxDays] = useState(14);
    const [spaceStatuses, setSpaceStatuses] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    //grab settings on mount
    useEffect(() => {
        fetchSettings();
    }, []);

    //fetch all settings from api
    const fetchSettings = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/admin/settings', {
                credentials: 'include'
            });
            const data = await response.json();

            setMaxBookingDays(data.max_booking_days);
            setTempMaxDays(data.max_booking_days);
            setSpaceStatuses(data.space_statuses);
            setStatistics(data.statistics);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching settings:', error);
            setLoading(false);
        }
    };

    //update max booking days
    const handleUpdateMaxDays = async () => {
        //validate
        const days = parseInt(tempMaxDays);
        if (isNaN(days) || days < 1 || days > 365) {
            alert('Please enter a valid number between 1 and 365');
            return;
        }

        setSaving(true);

        try {
            const response = await fetch('http://localhost:5000/api/admin/settings/max-days', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ max_days: days })
            });

            const data = await response.json();

            if (data.success) {
                setMaxBookingDays(days);
                alert(data.message);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error updating max days:', error);
            alert('Failed to update setting');
        } finally {
            setSaving(false);
        }
    };

    //update a space status (availble / out of service)
    const handleUpdateSpaceStatus = async (spaceNumber, newStatus) => {
        setSaving(true);

        try {
            const response = await fetch('http://localhost:5000/api/admin/settings/space-status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    parking_slot_number: spaceNumber,
                    status: newStatus
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                fetchSettings(); //refresh
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error updating space status:', error);
            alert('Failed to update space status');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading settings...</div>;
    }

    return (
        <div className="settings-tab">
            <h3>System Configuration</h3>
            <p className="tab-description">
                Manage booking rules, parking space availability, and view system statistics
            </p>

            {/* booking rules */}
            <div className="settings-card">
                <div className="settings-card-header">
                    <h4>Booking Rules</h4>
                </div>
                <div className="settings-card-body">
                    <div className="setting-row">
                        <div className="setting-info">
                            <label className="setting-label">Maximum Booking Days in Advance</label>
                            <p className="setting-description">
                                How far in advance can staff book parking spaces?
                            </p>
                        </div>
                        <div className="setting-control">
                            <input
                                type="number"
                                min="1"
                                max="365"
                                value={tempMaxDays}
                                onChange={(e) => setTempMaxDays(e.target.value)}
                                className="days-input"
                            />
                            <span className="days-label">days</span>
                            <button
                                className="update-btn"
                                onClick={handleUpdateMaxDays}
                                disabled={saving || tempMaxDays === maxBookingDays}
                            >
                                {saving ? 'Saving...' : 'Update'}
                            </button>
                        </div>
                    </div>
                    {tempMaxDays !== maxBookingDays && (
                        <div className="setting-warning">
                            ⚠️ You have unsaved changes. Click "Update" to save.
                        </div>
                    )}
                </div>
            </div>

            {/* parking space managment */}
            <div className="settings-card">
                <div className="settings-card-header">
                    <h4>Parking Space Management</h4>
                </div>
                <div className="settings-card-body">
                    <p className="setting-description">
                        Mark spaces as "Out of Service" to prevent bookings during maintenance or repairs.
                    </p>
                    <div className="space-status-grid">
                        {spaceStatuses.map(space => (
                            <div key={space.parking_slot_number} className="space-status-row">
                                <div className="space-status-label">
                                    <span className="space-number">Space {space.parking_slot_number}</span>
                                    <span className="space-updated">
                                        Updated: {new Date(space.updated_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="space-status-control">
                                    <select
                                        value={space.status}
                                        onChange={(e) => handleUpdateSpaceStatus(space.parking_slot_number, e.target.value)}
                                        className={`space-status-select ${space.status === 'out_of_service' ? 'status-disabled' : 'status-available'}`}
                                        disabled={saving}
                                    >
                                        <option value="available">✅ Available</option>
                                        <option value="out_of_service">🚫 Out of Service</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* system stats */}
            <div className="settings-card">
                <div className="settings-card-header">
                    <h4>System Statistics</h4>
                </div>
                <div className="settings-card-body">
                    <div className="stats-grid">
                        <div className="stat-box">
                            <div className="stat-value">{statistics?.total_users || 0}</div>
                            <div className="stat-label">Total Users</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{statistics?.total_bookings || 0}</div>
                            <div className="stat-label">Total Bookings</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{statistics?.active_bookings || 0}</div>
                            <div className="stat-label">Active Bookings</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">
                                {statistics?.most_booked_space ? `Space ${statistics.most_booked_space}` : 'N/A'}
                            </div>
                            <div className="stat-label">Most Booked Space</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ----- add user modal -----
function AddUserModal({ onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'staff'
    });
    const [loading, setLoading] = useState(false);

    //update form fields
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    //submit the form
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('User created successfully!');
                onSuccess(); //refresh user list
                onClose(); //close modal
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                <h2>Add New User</h2>

                <form onSubmit={handleSubmit} className="user-form">
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password:</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength="6"
                        />
                    </div>

                    <div className="form-group">
                        <label>Role:</label>
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="btn-cancel">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-submit">
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ----- edit user modal -----
function EditUserModal({ user, mode, onClose, onSuccess }) {
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(user.role);
    const [loading, setLoading] = useState(false);

    //change password
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                alert('Password updated successfully!');
                onSuccess();
                onClose();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error updating password:', error);
            alert('Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    //change role
    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role })
            });

            const data = await response.json();

            if (data.success) {
                alert('Role updated successfully!');
                onSuccess();
                onClose();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Failed to update role');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                <h2>{mode === 'password' ? 'Change Password' : 'Change Role'}</h2>
                <p className="modal-subtitle">User: {user.name} ({user.email})</p>

                {mode === 'password' ? (
                    <form onSubmit={handlePasswordSubmit} className="user-form">
                        <div className="form-group">
                            <label>New Password:</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                placeholder="At least 6 characters"
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="btn-submit">
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRoleSubmit} className="user-form">
                        <div className="form-group">
                            <label>Role:</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="btn-submit">
                                {loading ? 'Updating...' : 'Update Role'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ManagementPage;
