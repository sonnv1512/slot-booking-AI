import { useState } from 'react';
import API_BASE from './config';
import './ChatPopup.css';

function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! How can I help you with parking today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Check if message needs confirmation
  const needsConfirmation = (content) => {
    return content.includes('CONFIRM:') || 
           content.toLowerCase().includes('would you like me to proceed') ||
           content.toLowerCase().includes('should i go ahead');
  };

  // Extract confirmation details from message
  const parseConfirmation = (content) => {
    // Look for CONFIRM: pattern
    const confirmMatch = content.match(/CONFIRM:\s*(.+?)(?:\?|$)/i);
    if (confirmMatch) {
      const actionText = confirmMatch[1].trim();
      
      // Determine action type
      if (actionText.toLowerCase().includes('book')) {
        return { type: 'booking', details: actionText };
      } else if (actionText.toLowerCase().includes('cancel')) {
        return { type: 'cancellation', details: actionText };
      }
    }
    return null;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
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
          history: history
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
    if (!pendingConfirmation) return;
    
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
      // For now, we'll add a message to the AI to execute the action
      const executeMessage = `CONFIRMED: ${pendingConfirmation.details}`;
      
      const history = messages
        .filter((msg, idx) => idx !== 0 || msg.role !== 'assistant' || msg.content !== 'Hi! How can I help you with parking today?')
        .map(msg => ({ role: msg.role, content: msg.content }));

      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: executeMessage,
          history: history
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to execute action');
      }

      const data = await response.json();
      const resultMessage = data.response || 'Action completed successfully.';
      
      // Add result message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: resultMessage 
      }]);
    } catch (error) {
      console.error('Confirmation error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, something went wrong. Please try again.' 
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
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <span className="chat-loading">Thinking...</span>
              </div>
            )}
          </div>

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