import React, { useState } from 'react';
import './ChronotrackLogin.css';

const ChronoTrackLogin = ({ isOpen, onCredentialsSubmit, onClose }) => {
  const [credentials, setCredentials] = useState({
    user_id: '',
    user_pass: '',
    event_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Testing ChronoTrack connection...');

    try {
      // Test the ChronoTrack credentials first
      const testResponse = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: credentials.user_id,
          password: credentials.user_pass,
          event_id: credentials.event_id
        }),
      });

      const testData = await testResponse.json();
      
      if (testData.success) {
        setStatus('Connection successful!');
        onCredentialsSubmit(credentials);
      } else {
        setStatus(`Connection failed: ${testData.error}`);
      }
    } catch (error) {
      console.error('ChronoTrack connection error:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCredentials({ user_id: '', user_pass: '', event_id: '' });
    setStatus('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="chronotrack-backdrop">
      <div className="chronotrack-modal">
        <h2>ChronoTrack Live - Results Mode</h2>
        <p>Enter your ChronoTrack credentials to access results data:</p>
        
        <form onSubmit={handleSubmit} className="credentials-form">
          <div className="rd-form-control">
            <label>User ID:</label>
            <input
              className="rd-input"
              type="text"
              value={credentials.user_id}
              onChange={(e) => handleInputChange('user_id', e.target.value)}
              required
              placeholder="Your ChronoTrack User ID"
            />
          </div>
          
          <div className="rd-form-control">
            <label>Password:</label>
            <input
              className="rd-input"
              type="password"
              value={credentials.user_pass}
              onChange={(e) => handleInputChange('user_pass', e.target.value)}
              required
              placeholder="Your ChronoTrack Password"
            />
          </div>
          
          <div className="rd-form-control">
            <label>Event ID:</label>
            <input
              className="rd-input"
              type="text"
              value={credentials.event_id}
              onChange={(e) => handleInputChange('event_id', e.target.value)}
              required
              placeholder="ChronoTrack Event ID"
            />
          </div>
          
          <div className="credentials-buttons">
            <button 
              type="submit" 
              className="rd-button" 
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect to ChronoTrack'}
            </button>
            <button 
              type="button" 
              className="mode-cancel-btn" 
              onClick={handleCancel}
            >
              Back to Mode Selection
            </button>
          </div>
        </form>
        
        {status && (
          <div className={`rd-alert ${status.includes('failed') || status.includes('Error') ? 'error' : ''}`}>
            {status}
          </div>
        )}
        
        <div className="credentials-help">
          <h4>ChronoTrack Live Credentials</h4>
          <ul>
            <li>Use your ChronoTrack Live login credentials</li>
            <li>Get the Event ID from your race administrator</li>
            <li>Ensure you have access permissions for the event</li>
            <li>Results mode provides real-time timing with finished results</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChronoTrackLogin; 