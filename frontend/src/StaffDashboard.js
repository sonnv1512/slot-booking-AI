import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StaffDashboard.css';
import ParkingMap from './ParkingMap';

function StaffDashboard() {
  //auth stuff
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  //state variables for the dashboard data
  const [spaces, setSpaces] = useState([]);
  const [availableSpaces, setAvailableSpaces] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);

  //check if user is logged in when page loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/check-auth', {
          credentials: 'include'  //send session cookie
        });

        const data = await response.json();

        if (data.authenticated) {
          setUser(data.user);
        } else {
          //not logged in, send them to login
          navigate('/staff-login');
        }

      } catch (error) {
        console.error('Auth check failed:', error);
        navigate('/staff-login');
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  //fetch spaces and bookings once we know who the user is
  useEffect(() => {
    if (!user) return;

    //get all parking spaces
    fetch('http://127.0.0.1:5000/api/spaces')
      .then(response => response.json())
      .then(data => {
        setSpaces(data);
        setLoading(false);
      })
      .catch(error => console.error('Error fetching spaces:', error));

    //get this users bookings
    fetch(`http://127.0.0.1:5000/api/my-bookings?user_id=${user.id}`, {
      credentials: 'include'
    })
      .then(response => response.json())
      .then(data => {
        setMyBookings(data);
      })
      .catch(error => console.error('Error fetching bookings:', error));
  }, [user]);

  //check which spaces are availble for a date
  const checkAvailability = (date) => {
    setSelectedDate(date);

    if (!date) {
      setAvailableSpaces([]);
      return;
    }

    fetch(`http://127.0.0.1:5000/api/spaces/available?date=${date}`, {
      credentials: 'include'
    })
      .then(response => response.json())
      .then(data => {
        setAvailableSpaces(data);
      })
      .catch(error => console.error('Error checking availability:', error));
  };

  //cancel a booking
  const cancelBooking = (bookingId) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      fetch(`http://127.0.0.1:5000/api/bookings/${bookingId}?user_id=${user.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
          alert(data.message);
          setMyBookings(myBookings.filter(booking => booking.booking_id !== bookingId));
        })
        .catch(error => {
          console.error('Error cancelling booking:', error);
          alert('Failed to cancel booking');
        });
    }
  };

  //logout
  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:5000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  //loading screen while checking auth
  if (authLoading) {
    return (
      <div className="loading" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '20px'
      }}>
        Checking authentication...
      </div>
    );
  }

  //if not logged in dont render anyhting (redirect happens above)
  if (!user) {
    return null;
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="staff-dashboard">
      {/* header with welcom message and logout */}
      <div className="dashboard-header">
        <h1>Staff Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user.email}!</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* date picker for checking availibility */}
      <div className="date-picker-section">
        <label htmlFor="date-picker">Check Availability & Book:</label>
        <input
          id="date-picker"
          type="date"
          value={selectedDate}
          onChange={(e) => checkAvailability(e.target.value)}
        />
        <button
          className="reset-btn"
          onClick={() => checkAvailability('')}
        >
          Reset
        </button>
      </div>

      {/* parking map component */}
      <ParkingMap
        selectedDate={selectedDate}
        availableSpaces={availableSpaces}
        allSpaces={spaces}
        userId={user.id}
      />

      {/* my bookings table */}
      <div className="section">
        <h2>My Bookings</h2>

        {myBookings.length === 0 ? (
          <p>You have no bookings yet.</p>
        ) : (
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Space</th>
                <th>Date</th>
                <th>Booked At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myBookings.map(booking => (
                <tr key={booking.booking_id}>
                  <td>{booking.booking_id}</td>
                  <td>{booking.parking_slot_number}</td>
                  <td>{booking.booking_date}</td>
                  <td>{booking.created_at}</td>
                  <td>
                    <button
                      onClick={() => cancelBooking(booking.booking_id)}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default StaffDashboard;
