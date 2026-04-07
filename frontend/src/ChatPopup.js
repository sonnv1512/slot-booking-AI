import { useState, useEffect, useRef } from 'react';
import API_BASE from './config';
import './ChatPopup.css';

// Date helper functions using local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextWeekDate = () => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const year = nextWeek.getFullYear();
  const month = String(nextWeek.getMonth() + 1).padStart(2, '0');
  const day = String(nextWeek.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Sample questions for quick actions
const sampleQuestions = [
  { label: "Available slots today", message: "What slots are available today?" },
  { label: "Available tomorrow", message: "What slots are available tomorrow?" },
  { label: "My bookings", message: "Show my bookings" },
  { label: "Book a slot", message: "I want to book a parking slot" }
];

function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! How can I help you with parking today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [staffId, setStaffId] = useState(null);
  const messagesEndRef = useRef(null);

  // Get staff_id from session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/check-auth`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setStaffId(data.user.id);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Check if message needs confirmation
  const needsConfirmation = (content) => {
    return content.includes('CONFIRM_ACTION:') ||
           content.includes('CONFIRM:') || 
           content.toLowerCase().includes('would you like me to proceed') ||
           content.toLowerCase().includes('should i go ahead');
  };

  // Extract confirmation details from message
  const parseConfirmation = (content) => {
    // Look for new CONFIRM_ACTION format: CONFIRM_ACTION:BOOK:slot=A1:date=2026-04-08:staff_id=123
    const confirmMatch = content.match(/CONFIRM_ACTION:(BOOK|CANCEL):(.+?)(?:\?|$)/i);
    if (confirmMatch) {
      const actionType = confirmMatch[1].toUpperCase();
      const params = confirmMatch[2];
      
      if (actionType === 'BOOK') {
        // Extract slot, date, staff_id - handle both "slot=A1" and "slot: A1" formats
        const slotMatch = params.match(/slot[=:]([A-Za-z0-9]+)/i);
        const dateMatch = params.match(/date[=:]([\d-]+)/i);
        const staffIdMatch = params.match(/staff[_-]?id[=:]([\d]+)/i);
        
        return { 
          type: 'booking', 
          slot: slotMatch ? slotMatch[1] : null,
          date: dateMatch ? dateMatch[1] : null,
          staffId: staffIdMatch ? parseInt(staffIdMatch[1]) : null,
          details: content 
        };
      } else if (actionType === 'CANCEL') {
        // Extract booking_id and staff_id - handle both "booking_id=123" and "bookingid=123" formats
        const bookingIdMatch = params.match(/(?:booking[_-]?id)[=:]([\d]+)/i);
        const staffIdMatch = params.match(/staff[_-]?id[=:]([\d]+)/i);
        
        return { 
          type: 'cancellation', 
          bookingId: bookingIdMatch ? parseInt(bookingIdMatch[1]) : null,
          staffId: staffIdMatch ? parseInt(staffIdMatch[1]) : null,
          details: content 
        };
      }
    }
    
    // Legacy format fallback
    const legacyConfirmMatch = content.match(/CONFIRM:\s*(.+?)(?:\?|$)/i);
    if (legacyConfirmMatch) {
      const actionText = legacyConfirmMatch[1].trim();
      
      if (actionText.toLowerCase().includes('book')) {
        const slotMatch = actionText.match(/slot\s+([A-Za-z0-9]+)/i);
        const dateMatch = actionText.match(/(?:for|on)\s+(\d{4}-\d{2}-\d{2}|tomorrow|today)/i);
        
        let bookingDate = dateMatch ? dateMatch[1] : null;
        if (bookingDate === 'tomorrow') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          bookingDate = tomorrow.toISOString().split('T')[0];
        } else if (bookingDate === 'today') {
          bookingDate = new Date().toISOString().split('T')[0];
        }
        
        return { 
          type: 'booking', 
          slot: slotMatch ? slotMatch[1] : null,
          date: bookingDate,
          details: actionText 
        };
      } else if (actionText.toLowerCase().includes('cancel')) {
        const bookingIdMatch = actionText.match(/(?:booking\s+(?:id\s+)?|ID\s*)\s*(\d+)/i);
        
        return { 
          type: 'cancellation', 
          bookingId: bookingIdMatch ? parseInt(bookingIdMatch[1]) : null,
          details: actionText 
        };
      }
    }
    return null;
  };

  // Handle sample question button click
  const handleSampleQuestion = (message) => {
    setInput(message);
    // Trigger form submission
    const form = document.querySelector('.chat-input-form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Build history (exclude the initial welcome message)
    const history = messages
      .filter((msg, idx) => idx !== 0 || msg.role !== 'assistant' || msg.content !== 'Hi! How can I help you with parking today?')
      .map(msg => ({ role: msg.role, content: msg.content }));

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: userMessage,
          history: history,
          date_context: {
            today: getTodayDate(),
            tomorrow: getTomorrowDate(),
            next_week: getNextWeekDate()
          }
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage = data.response || 'Sorry, I could not get a response.';
      
      // Add assistant response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: assistantMessage 
      }]);

      // Check if confirmation is needed
      if (needsConfirmation(assistantMessage)) {
        const confirmation = parseConfirmation(assistantMessage);
        setPendingConfirmation(confirmation);
      }

      // Check if we need to auto-fetch data (available slots, my bookings)
      checkAutoFetch(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, something went wrong. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingConfirmation || !staffId) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error: Not authenticated. Please log in first.' 
      }]);
      setPendingConfirmation(null);
      return;
    }
    
    setLoading(true);
    const confirmMsg = pendingConfirmation.type === 'booking' 
      ? 'Confirming your booking...'
      : 'Confirming cancellation...';
    
    // Add system message
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: confirmMsg 
    }]);

    try {
      let resultMessage = '';
      
      if (pendingConfirmation.type === 'booking') {
        // Call POST /api/bookings
        if (!pendingConfirmation.slot || !pendingConfirmation.date) {
          throw new Error('Missing slot or date information');
        }
        
        const response = await fetch(`${API_BASE}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: staffId,
            parking_slot_number: pendingConfirmation.slot,
            booking_date: pendingConfirmation.date
          }),
          credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create booking');
        }
        
        resultMessage = `Booking confirmed! Your booking ID is ${data.booking_id}. Slot ${pendingConfirmation.slot} is booked for ${pendingConfirmation.date}.`;
        
      } else if (pendingConfirmation.type === 'cancellation') {
        // Call DELETE /api/bookings/<booking_id>
        if (!pendingConfirmation.bookingId) {
          throw new Error('Missing booking ID');
        }
        
        const response = await fetch(`${API_BASE}/api/bookings/${pendingConfirmation.bookingId}?user_id=${staffId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to cancel booking');
        }
        
        resultMessage = `Booking ${pendingConfirmation.bookingId} has been cancelled successfully.`;
      }
      
      // Add result message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: resultMessage 
      }]);
    } catch (error) {
      console.error('Confirmation error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, something went wrong: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
      setPendingConfirmation(null);
    }
  };

  const handleCancel = () => {
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Action cancelled. Is there anything else I can help you with?' 
    }]);
    setPendingConfirmation(null);
  };

  // Extract date from AI response (looks for YYYY-MM-DD pattern)
  const extractDateFromResponse = (content) => {
    const dateMatch = content.match(/\((\d{4}-\d{2}-\d{2})\)/);
    if (dateMatch) {
      return dateMatch[1];
    }
    // Also check for date mentioned in text like "for 2026-04-08"
    const directMatch = content.match(/\d{4}-\d{2}-\d{2}/);
    return directMatch ? directMatch[0] : null;
  };

  // Extract action details from AI response for non-confirm actions
  const parseAction = (content) => {
    const lowerContent = content.toLowerCase();
    
    // First, check for explicit ACTION: format (backwards compatibility)
    const listSlotsMatch = content.match(/ACTION:LIST_SLOTS:date=(\d{4}-\d{2}-\d{2})/i);
    if (listSlotsMatch) {
      return {
        action: 'LIST_SLOTS',
        date: listSlotsMatch[1]
      };
    }
    
    const myBookingsMatch = content.match(/ACTION:MY_BOOKINGS:staff_id=(\d+)/i);
    if (myBookingsMatch) {
      return {
        action: 'MY_BOOKINGS',
        staffId: parseInt(myBookingsMatch[1])
      };
    }
    
    // For LIST_SLOTS - detect from ANY text containing keywords
    // Look for patterns like "available slots for", "slots for tomorrow", etc.
    if (lowerContent.includes('available') || lowerContent.includes('slots')) {
      // Extract date from content - look for YYYY-MM-DD
      const dateMatch = content.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return { action: 'LIST_SLOTS', date: dateMatch[0] };
      }
      // Also check for "(YYYY-MM-DD)" pattern
      const parenMatch = content.match(/\((\d{4}-\d{2}-\d{2})\)/);
      if (parenMatch) {
        return { action: 'LIST_SLOTS', date: parenMatch[1] };
      }
      // Check for natural dates like "tomorrow" or "today"
      if (lowerContent.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { action: 'LIST_SLOTS', date: tomorrow.toISOString().split('T')[0] };
      }
      if (lowerContent.includes('today')) {
        return { action: 'LIST_SLOTS', date: new Date().toISOString().split('T')[0] };
      }
    }
    
    // For MY_BOOKINGS - detect from any text containing "my booking"
    if (lowerContent.includes('my booking')) {
      return { action: 'MY_BOOKINGS' };
    }
    
    return null;
  };

  // Check if AI response contains an action that needs to be handled via backend
  const checkAutoFetch = async (content) => {
    const action = parseAction(content);
    
    if (!action) return;
    
    const { action: actionType, date, staffId: actionStaffId } = action;
    
    // Use either the extracted staff_id or the current session staff_id
    const currentStaffId = actionStaffId || staffId;
    
    if (actionType === 'MY_BOOKINGS') {
      if (!currentStaffId) return;
      
      // Add loading message
      const loadingMsgId = Date.now();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Loading your bookings...',
        isLoading: true,
        loadingId: loadingMsgId
      }]);
      
      try {
        // Call the new /api/ai/action endpoint instead of direct API
        const response = await fetch(`${API_BASE}/api/ai/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'MY_BOOKINGS',
            staff_id: currentStaffId
          }),
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          let resultText = 'Your bookings:\n';
          
          if (data.bookings && data.bookings.length > 0) {
            data.bookings.forEach(booking => {
              resultText += `- Booking #${booking.booking_id}: Slot ${booking.parking_slot_number} on ${booking.booking_date}\n`;
            });
          } else {
            resultText = 'You have no bookings.';
          }
          
          // Replace loading message with result
          setMessages(prev => prev.map(msg => 
            msg.loadingId === loadingMsgId 
              ? { role: 'assistant', content: resultText, isLoading: false }
              : msg
          ));
        }
      } catch (error) {
        console.error('Failed to fetch bookings:', error);
        setMessages(prev => prev.map(msg => 
          msg.loadingId === loadingMsgId 
            ? { role: 'assistant', content: 'Failed to load bookings. Please try again.', isLoading: false }
            : msg
        ));
      }
      return;
    }
    
    if (actionType === 'LIST_SLOTS') {
      if (!date) return;
      
      // Add loading message
      const loadingMsgId = Date.now();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Loading available slots for ${date}...`,
        isLoading: true,
        loadingId: loadingMsgId
      }]);
      
      try {
        // Call the new /api/ai/action endpoint instead of direct API
        const response = await fetch(`${API_BASE}/api/ai/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'LIST_SLOTS',
            date: date
          }),
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          let resultText = `Available slots for ${date}:\n`;
          
          if (data.available_spaces && data.available_spaces.length > 0) {
            resultText += data.available_spaces.map(s => s.parking_slot_number).join(', ');
          } else {
            resultText = `No available slots for ${date}.`;
          }
          
          // Replace loading message with result
          setMessages(prev => prev.map(msg => 
            msg.loadingId === loadingMsgId 
              ? { role: 'assistant', content: resultText, isLoading: false }
              : msg
          ));
        }
      } catch (error) {
        console.error('Failed to fetch available slots:', error);
        setMessages(prev => prev.map(msg => 
          msg.loadingId === loadingMsgId 
            ? { role: 'assistant', content: 'Failed to load available slots. Please try again.', isLoading: false }
            : msg
        ));
      }
    }
  };

  return (
    <>
      {/* Floating button */}
      <button 
        className="chat-floating-btn" 
        onClick={toggleChat}
        aria-label="Open chat"
      >
        💬
      </button>

      {/* Chat popup */}
      {isOpen && (
        <div className="chat-popup">
          <div className="chat-header">
            <h3>AI Parking Assistant</h3>
            <button className="chat-close-btn" onClick={toggleChat}>
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-message ${msg.role}`}
              >
                {msg.isLoading ? (
                  <span className="chat-loading">{msg.content}</span>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <span className="chat-loading">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sample question buttons */}
          {!loading && (
            <div className="sample-questions">
              {sampleQuestions.map((q, idx) => (
                <button 
                  key={idx} 
                  onClick={() => handleSampleQuestion(q.message)}
                  disabled={loading}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Confirmation buttons */}
          {pendingConfirmation && !loading && (
            <div className="chat-confirmation">
              <button 
                className="chat-confirm-btn" 
                onClick={handleConfirm}
              >
                Confirm
              </button>
              <button 
                className="chat-cancel-btn" 
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          )}

          <form className="chat-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="chat-send-btn"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatPopup;