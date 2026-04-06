import API_BASE from './config';
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
                    📅 Bookings
                </button>
                <button
                    className={`tab-btn ${activeTab === 'parking-slots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('parking-slots')}
                >
                    🅿️ Parking Slots
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
                {activeTab === 'parking-slots' && <ParkingSlotsTab />}
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
    const [showImportModal, setShowImportModal] = useState(false);
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
            const response = await fetch(API_BASE + '/api/admin/users', {
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
                const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
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
                    className="import-csv-btn"
                    onClick={() => setShowImportModal(true)}
                >
                    📥 Import CSV
                </button>
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

            {/* import csv modal */}
            {showImportModal && (
                <ImportCSVModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={fetchUsers}
                />
            )}

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
    const [spaces, setSpaces] = useState([]);

    //load users and bookigns on mount
    useEffect(() => {
        fetchUsers();
        fetchBookings();
        fetchSpaces();
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
                String(booking.parking_slot_number) === String(filterSpace)
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
            const response = await fetch(API_BASE + '/api/admin/users', {
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
            const response = await fetch(API_BASE + '/api/admin/all-bookings', {
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

    //fetch all parking spaces from api
    const fetchSpaces = async () => {
        try {
            const response = await fetch(API_BASE + '/api/spaces', {
                credentials: 'include'
            });
            const data = await response.json();
            const sorted = data.sort((a, b) => {
                const aNum = parseInt(a.parking_slot_number);
                const bNum = parseInt(b.parking_slot_number);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return String(a.parking_slot_number).localeCompare(String(b.parking_slot_number));
            });
            setSpaces(sorted.map(s => String(s.parking_slot_number)));
        } catch (error) {
            console.error('Error fetching spaces:', error);
        }
    };

    //check which spaces are availble for the date
    const checkAvailability = async (date) => {
        try {
            const response = await fetch(`${API_BASE}/api/spaces/available?date=${date}`, {
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
                `${API_BASE}/api/admin/booking-info?space=${space}&date=${selectedDate}`,
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
            const response = await fetch(API_BASE + '/api/admin/bookings/manual', {
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
                const response = await fetch(`${API_BASE}/api/bookings/${bookingId}?user_id=1`, {
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

// ----- parking slots tab -----
function ParkingSlotsTab() {
    // parking slots data
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [newSlotInput, setNewSlotInput] = useState('');
    const [newSlotRestricted, setNewSlotRestricted] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addingSlot, setAddingSlot] = useState(false);

    // fetch slots on mount
    useEffect(() => {
        fetchSlots();
    }, []);

    // fetch all parking slots from admin API (includes restricted slots + is_restricted flag)
    const fetchSlots = async () => {
        try {
            const response = await fetch(API_BASE + '/api/admin/slots', {
                credentials: 'include'
            });
            const data = await response.json();
            const sorted = data.sort((a, b) => {
                const aNum = parseInt(a.parking_slot_number);
                const bNum = parseInt(b.parking_slot_number);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return String(a.parking_slot_number).localeCompare(String(b.parking_slot_number));
            });
            setSlots(sorted);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching parking slots:', error);
            setLoading(false);
        }
    };

    // delete a parking slot
    const handleDeleteSlot = async (slotNumber) => {
        const confirmed = window.confirm(
            `Delete parking space ${slotNumber}? This will delete all associated bookings.`
        );

        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE}/api/admin/parking-slots/${slotNumber}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.success) {
                    alert(`Space ${slotNumber} deleted successfully!`);
                    fetchSlots();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error deleting slot:', error);
                alert('Failed to delete slot');
            }
        }
    };

    // add a new parking slot
    const handleAddSlot = async (slotInput) => {
        if (!slotInput || !slotInput.trim()) {
            alert('Please enter a parking slot number');
            return;
        }

        // validate alphanumeric (letters and numbers only, no special chars)
        const slotStr = slotInput.trim();
        const alphanumericRegex = /^[a-zA-Z0-9\s]+$/;

        if (!alphanumericRegex.test(slotStr)) {
            alert('Parking slot can only contain letters and numbers');
            return;
        }

        if (slotStr.length > 20) {
            alert('Parking slot cannot exceed 20 characters');
            return;
        }

        // check if already exists
        if (slots.some(s => s.parking_slot_number.toString() === slotStr)) {
            alert(`Space "${slotStr}" already exists!`);
            return;
        }

        setAddingSlot(true);

        try {
            const response = await fetch(API_BASE + '/api/admin/parking-slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ parking_slot_number: slotStr, is_restricted: newSlotRestricted })
            });

            const data = await response.json();

            if (data.success) {
                setNewSlotInput('');
                setNewSlotRestricted(false);
                setShowAddForm(false);
                fetchSlots();
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating slot:', error);
            alert('Failed to create slot');
        } finally {
            setAddingSlot(false);
        }
    };

    // toggle restricted status on a slot
    const handleToggleRestricted = async (slotNumber, currentRestricted) => {
        try {
            const response = await fetch(`${API_BASE}/api/admin/parking-slots/${slotNumber}/restricted`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ is_restricted: !currentRestricted })
            });
            const data = await response.json();
            if (data.success) fetchSlots();
            else alert('Error: ' + (data.error || 'Unknown error'));
        } catch (error) {
            console.error('Error toggling restricted:', error);
        }
    };

    // split slots into rows of 3
    const getSlotRows = () => {
        const rows = [];
        for (let i = 0; i < slots.length; i += 3) {
            rows.push(slots.slice(i, i + 3));
        }
        return rows;
    };

    if (loading) {
        return <div className="loading">Loading parking slots...</div>;
    }

    const slotRows = getSlotRows();

    return (
        <div className="parking-slots-management">
            <div className="management-section">
                {editMode && (
                    <div className="edit-mode-info">
                        <p>🔒 = <strong>Restricted (admin-only)</strong> — staff users cannot see or book these slots. Only admins can assign them manually.</p>
                        <p style={{ marginTop: '6px' }}>Click 🔒/🔓 to toggle restriction, × to delete, + to add a new slot.</p>
                    </div>
                )}

                <div className="section-header">
                    <h3>Manage Parking Slots</h3>
                    <button
                        className={`btn-primary ${editMode ? 'editing' : ''}`}
                        onClick={() => setEditMode(!editMode)}
                    >
                        {editMode ? '✓ Done' : '✏️ Edit'}
                    </button>
                </div>

                {/* Slots Grid */}
                <div className="slots-grid">
                    {slotRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="slots-grid-row">
                            {row.map(slot => (
                                <div key={slot.parking_slot_number} className={`slot-block ${slot.is_restricted ? 'slot-restricted' : ''}`}>
                                    <div className="slot-number">
                                        {slot.parking_slot_number}
                                        {slot.is_restricted && <span className="restricted-badge">🔒</span>}
                                    </div>
                                    {editMode && (
                                        <div className="slot-edit-actions">
                                            <button
                                                className={`slot-restrict-btn ${slot.is_restricted ? 'is-restricted' : ''}`}
                                                onClick={() => handleToggleRestricted(slot.parking_slot_number, slot.is_restricted)}
                                                title={slot.is_restricted ? 'Make public' : 'Make restricted'}
                                            >
                                                {slot.is_restricted ? '🔓' : '🔒'}
                                            </button>
                                            <button
                                                className="slot-delete-btn"
                                                onClick={() => handleDeleteSlot(slot.parking_slot_number)}
                                                title={`Delete space ${slot.parking_slot_number}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Add slot — inline form in edit mode */}
                    {editMode && (
                        <div className="slots-grid-row">
                            {showAddForm ? (
                                <div className="slot-block add-slot-form">
                                    <input
                                        className="add-slot-input"
                                        type="text"
                                        placeholder="e.g. 15, A1"
                                        value={newSlotInput}
                                        onChange={e => setNewSlotInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSlot(newSlotInput)}
                                        autoFocus
                                    />
                                    <label className="add-slot-restricted-label">
                                        <input
                                            type="checkbox"
                                            checked={newSlotRestricted}
                                            onChange={e => setNewSlotRestricted(e.target.checked)}
                                        />
                                        Restricted
                                    </label>
                                    <div className="add-slot-form-btns">
                                        <button className="add-slot-confirm-btn" onClick={() => handleAddSlot(newSlotInput)} disabled={addingSlot}>
                                            {addingSlot ? '...' : '✓'}
                                        </button>
                                        <button className="add-slot-cancel-btn" onClick={() => { setShowAddForm(false); setNewSlotInput(''); setNewSlotRestricted(false); }}>
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="slot-block add-slot-block" onClick={() => setShowAddForm(true)}>
                                    <div className="add-slot-button">+</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {slots.length === 0 && (
                    <div className="empty-state">
                        <p>No parking slots configured.</p>
                        {editMode && <p>Click "+" to add your first space.</p>}
                    </div>
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
            const response = await fetch(API_BASE + '/api/admin/settings', {
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
            const response = await fetch(API_BASE + '/api/admin/settings/max-days', {
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
            const response = await fetch(API_BASE + '/api/admin/settings/space-status', {
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
                        Mark spaces as "Out of Service" (users can see can't book) to prevent bookings during maintenance or repairs.
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

// ----- import csv modal -----
function ImportCSVModal({ onClose, onSuccess }) {
    const [parsedRows, setParsedRows] = useState(null);   // null = no file yet
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);          // {created, skipped} after import

    // simple quoted-csv row parser
    const parseRow = (line) => {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        fields.push(current.trim());
        return fields;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setResults(null);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const lines = text.trim().split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l.length > 0);
            if (lines.length === 0) { setParsedRows([]); return; }

            // detect header row
            const firstFields = parseRow(lines[0]).map(f => f.toLowerCase());
            const isHeader = ['name', 'email', 'password', 'role'].some(col => firstFields.includes(col));

            let nameIdx = 0, emailIdx = 1, passwordIdx = 2, roleIdx = 3;
            if (isHeader) {
                nameIdx     = firstFields.indexOf('name')     !== -1 ? firstFields.indexOf('name')     : 0;
                emailIdx    = firstFields.indexOf('email')    !== -1 ? firstFields.indexOf('email')    : 1;
                passwordIdx = firstFields.indexOf('password') !== -1 ? firstFields.indexOf('password') : 2;
                roleIdx     = firstFields.indexOf('role')     !== -1 ? firstFields.indexOf('role')     : 3;
            }

            const dataLines = isHeader ? lines.slice(1) : lines;
            const rows = dataLines.map((line, idx) => {
                const f = parseRow(line);
                return {
                    rowNum: isHeader ? idx + 2 : idx + 1,
                    name:     f[nameIdx]     || '',
                    email:    f[emailIdx]    || '',
                    password: f[passwordIdx] || '',
                    role:     (f[roleIdx]    || 'staff').toLowerCase(),
                };
            });
            setParsedRows(rows);
        };
        reader.readAsText(file);
    };

    const rowError = (row) => {
        if (!row.name)                       return 'Missing name';
        if (!row.email || !row.email.includes('@')) return 'Invalid email';
        if (!row.password)                   return 'Missing password';
        if (!['staff', 'admin'].includes(row.role)) return `Bad role "${row.role}"`;
        return null;
    };

    const validRows = parsedRows ? parsedRows.filter(r => !rowError(r)) : [];

    const handleImport = async () => {
        if (validRows.length === 0) return;
        setImporting(true);
        try {
            const response = await fetch(API_BASE + '/api/admin/users/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ users: validRows })
            });
            const data = await response.json();
            if (data.success) {
                setResults(data);
                onSuccess();
            } else {
                alert('Import failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('Failed to import users');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content import-modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>✕</button>
                <h2 className="modal-title">Import Users from CSV</h2>

                {/* format guide */}
                <div className="import-format-box">
                    <div className="import-format-title">ℹ️ Required CSV format</div>
                    <p className="import-format-desc">
                        Your file must have these four columns (header row is optional):
                    </p>
                    <table className="import-format-table">
                        <thead>
                            <tr>
                                <th>name</th>
                                <th>email</th>
                                <th>password</th>
                                <th>role</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>John Smith</td>
                                <td>john@school.com</td>
                                <td>password123</td>
                                <td>staff</td>
                            </tr>
                            <tr>
                                <td>Jane Admin</td>
                                <td>jane@school.com</td>
                                <td>adminpass</td>
                                <td>admin</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="import-format-note">Role must be <strong>staff</strong> or <strong>admin</strong>. Rows with duplicate emails will be skipped.</p>
                </div>

                {/* file picker */}
                {!results && (
                    <div className="import-file-section">
                        <label className="import-file-label">
                            <span className="import-file-btn-text">📂 Choose CSV file</span>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleFileChange}
                                className="import-file-input"
                            />
                        </label>
                        {fileName && <span className="import-file-name">{fileName}</span>}
                    </div>
                )}

                {/* preview table */}
                {parsedRows && parsedRows.length > 0 && !results && (
                    <div className="import-preview">
                        <p className="import-preview-summary">
                            Found <strong>{parsedRows.length}</strong> row{parsedRows.length !== 1 ? 's' : ''} —{' '}
                            <span className="import-valid-count">{validRows.length} valid</span>
                            {parsedRows.length - validRows.length > 0 && (
                                <span className="import-invalid-count">, {parsedRows.length - validRows.length} with errors</span>
                            )}
                        </p>
                        <div className="import-preview-scroll">
                            <table className="import-preview-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedRows.map(row => {
                                        const err = rowError(row);
                                        return (
                                            <tr key={row.rowNum} className={err ? 'import-row-error' : 'import-row-ok'}>
                                                <td>{row.rowNum}</td>
                                                <td>{row.name || <em>—</em>}</td>
                                                <td>{row.email || <em>—</em>}</td>
                                                <td>{row.role}</td>
                                                <td>{err ? <span className="import-error-msg">⚠ {err}</span> : <span className="import-ok-msg">✓</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {parsedRows && parsedRows.length === 0 && !results && (
                    <p className="import-empty-msg">No data rows found in the file.</p>
                )}

                {/* results after import */}
                {results && (
                    <div className="import-results">
                        <p className="import-results-created">✅ {results.created} user{results.created !== 1 ? 's' : ''} created successfully.</p>
                        {results.skipped.length > 0 && (
                            <>
                                <p className="import-results-skipped-title">⚠️ {results.skipped.length} row{results.skipped.length !== 1 ? 's' : ''} skipped:</p>
                                <ul className="import-skipped-list">
                                    {results.skipped.map((s, i) => (
                                        <li key={i}><strong>{s.email}</strong> — {s.reason}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}

                <div className="modal-actions-row">
                    <button className="modal-cancel-btn" onClick={onClose}>
                        {results ? 'Close' : 'Cancel'}
                    </button>
                    {!results && (
                        <button
                            className="modal-submit-btn"
                            onClick={handleImport}
                            disabled={importing || !validRows.length}
                        >
                            {importing ? 'Importing...' : `Import ${validRows.length} User${validRows.length !== 1 ? 's' : ''}`}
                        </button>
                    )}
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
            const response = await fetch(API_BASE + '/api/admin/users', {
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
            const response = await fetch(`${API_BASE}/api/admin/users/${user.id}/password`, {
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
            const response = await fetch(`${API_BASE}/api/admin/users/${user.id}/role`, {
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
