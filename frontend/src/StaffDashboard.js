import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StaffDashboard.css';
import ParkingMap from './ParkingMap';

const API_BASE_URL = 'http://localhost:5000';

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

  //ai assistant states
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [assistantMessages, setAssistantMessages] = useState([
    {
      id: 'welcome-assistant',
      role: 'assistant',
      text: 'Hello! I can help you check availability, book slots, view your tickets, and cancel bookings.',
    }
  ]);

  const appendChatMessage = (role, text) => {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    setAssistantMessages((previousMessages) => [
      ...previousMessages,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        text: normalizedText
      }
    ]);
  };

  const applyAssistantPayload = (payload) => {
    if (Array.isArray(payload.bookings)) {
      setMyBookings(payload.bookings);
    }

    if (payload.date && Array.isArray(payload.available_spaces)) {
      setSelectedDate(payload.date);
      setAvailableSpaces(payload.available_spaces);
    }
  };

  async function fetchMyBookings(targetUserId) {
    const response = await fetch(`${API_BASE_URL}/api/my-bookings?user_id=${targetUserId}`, {
      credentials: 'include'
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch bookings');
    }

    setMyBookings(data);
  }

  async function fetchSpaces() {
    const response = await fetch(`${API_BASE_URL}/api/spaces`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch spaces');
    }

    setSpaces(data);
  }

  async function fetchAvailability(date) {
    const response = await fetch(`${API_BASE_URL}/api/spaces/available?date=${date}`, {
      credentials: 'include'
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check availability');
    }

    setAvailableSpaces(data);
  }

  //check if user is logged in when page loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
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

    const loadDashboardData = async () => {
      try {
        await Promise.all([
          fetchSpaces(),
          fetchMyBookings(user.id)
        ]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  //check which spaces are availble for a date
  const checkAvailability = async (date) => {
    setSelectedDate(date);

    if (!date) {
      setAvailableSpaces([]);
      return;
    }

    try {
      await fetchAvailability(date);
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  //cancel a booking
  const cancelBooking = (bookingId) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      fetch(`${API_BASE_URL}/api/bookings/${bookingId}?user_id=${user.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert(data.message);
            setMyBookings((previousBookings) =>
              previousBookings.filter((booking) => booking.booking_id !== bookingId)
            );
            if (selectedDate) {
              fetchAvailability(selectedDate).catch(() => {});
            }
          } else {
            alert(data.error || 'Failed to cancel booking');
          }
        })
        .catch(error => {
          console.error('Error cancelling booking:', error);
          alert('Failed to cancel booking');
        });
    }
  };

  const sendAssistantMessage = async (event) => {
    event.preventDefault();

    const trimmedMessage = assistantInput.trim();
    if (!trimmedMessage || assistantLoading) return;

    if (pendingConfirmation) {
      appendChatMessage('assistant', 'You have a pending action for confirmation. Please press Confirm or Reject.');
      return;
    }

    appendChatMessage('user', trimmedMessage);
    setAssistantInput('');
    setAssistantLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmedMessage })
      });

      const data = await response.json();

      if (response.status === 401) {
        navigate('/staff-login');
        return;
      }

      appendChatMessage('assistant', data.reply || 'I do not understand your request. Please try again.');

      if (data.requires_confirmation) {
        setPendingConfirmation({
          prompt: data.confirmation_prompt || data.reply || 'Are you sure you want to proceed with this action?'
        });
      } else {
        setPendingConfirmation(null);
      }

      applyAssistantPayload(data);
    } catch (error) {
      console.error('Assistant error:', error);
      appendChatMessage('assistant', 'There was an error calling the AI assistant. Please try again later.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleAssistantConfirmation = async (confirmValue) => {
    if (assistantLoading) return;

    appendChatMessage('user', confirmValue ? 'Confirm' : 'Reject');
    setAssistantLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/assistant/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: confirmValue })
      });

      const data = await response.json();

      if (response.status === 401) {
        navigate('/staff-login');
        return;
      }

      appendChatMessage('assistant', data.reply || 'Da xu ly xong.');
      applyAssistantPayload(data);
    } catch (error) {
      console.error('Assistant confirmation error:', error);
      appendChatMessage('assistant', 'Co loi khi xu ly xac nhan. Ban thu lai.');
    } finally {
      setPendingConfirmation(null);
      setAssistantLoading(false);
    }
  };

  //logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
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

      {/* ai chat assistant */}
      <div className="section assistant-section">
        <h2>AI Chat Assistant</h2>
        <p className="assistant-hint">
          Vi du: "Cho trong ngay 2026-03-10", "Dat cho 62 ngay mai", "Ve cua toi", "Huy ve 15"
        </p>

        <div className="assistant-chat-window">
          {assistantMessages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              {message.text}
            </div>
          ))}
          {assistantLoading && (
            <div className="chat-message assistant status-message">Thinking...</div>
          )}
        </div>

        {pendingConfirmation && (
          <div className="assistant-confirm-box">
            <p>{pendingConfirmation.prompt}</p>
            <div className="assistant-confirm-actions">
              <button
                onClick={() => handleAssistantConfirmation(true)}
                className="assistant-confirm-btn"
                type="button"
              >
                Xac nhan
              </button>
              <button
                onClick={() => handleAssistantConfirmation(false)}
                className="assistant-reject-btn"
                type="button"
              >
                Tu choi
              </button>
            </div>
          </div>
        )}

        <form className="assistant-form" onSubmit={sendAssistantMessage}>
          <input
            type="text"
            placeholder="Ask me..."
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            disabled={assistantLoading}
          />
          <button type="submit" disabled={assistantLoading || !assistantInput.trim()}>
            Gui
          </button>
        </form>
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
