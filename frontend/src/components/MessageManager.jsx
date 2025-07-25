import React, { useState, useEffect } from 'react';
import './MessageManager.css';

const MessageManager = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch messages on mount
  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen]);

  const fetchMessages = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text: newMessage.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const updatedMessages = await response.json();
      setMessages(updatedMessages);
      setNewMessage('');
    } catch (err) {
      setError('Failed to add message');
      console.error('Error adding message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (index) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/messages/${index}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const updatedMessages = await response.json();
      setMessages(updatedMessages);
    } catch (err) {
      setError('Failed to delete message');
      console.error('Error deleting message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="message-manager-modal">
      <div className="message-manager-content">
        <div className="message-manager-header">
          <h2>Custom Messages</h2>
          <div className="header-buttons">
            <button 
              className="exit-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Exit to Builder
            </button>
            <button 
              className="close-button" 
              onClick={onClose}
              disabled={isLoading}
            >
              &times;
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleAddMessage} className="add-message-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Enter new message..."
            className="message-input"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="add-button"
            disabled={isLoading}
          >
            {isLoading ? 'Adding...' : 'Add Message'}
          </button>
        </form>

        <div className="messages-list">
          {isLoading && messages.length === 0 ? (
            <div className="loading-message">Loading messages...</div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className="message-item">
                <span className="message-text">{message}</span>
                <button
                  onClick={() => handleDeleteMessage(index)}
                  className="delete-button"
                  title="Delete message"
                  disabled={isLoading}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageManager; 