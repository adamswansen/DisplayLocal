import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ModeSelectionModal from '../components/ModeSelectionModal';
import PreRaceFlow from '../components/PreRaceFlow';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showPreRaceFlow, setShowPreRaceFlow] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Connecting...');
    setProgress({ loaded: 0, total: 0 });

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('password', password);
    formData.append('event_id', eventId);

    try {
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        // Store credentials for mode selection
        setCredentials({
          user_id: userId,
          user_pass: password,
          event_id: eventId
        });
        
        // Show mode selection modal
        setShowModeSelection(true);
        setStatus('Authentication successful - Choose mode');
      } else {
        setStatus(data.error || 'Login failed');
      }
    } catch (err) {
      setStatus('Network error');
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  const handleModeSelect = (mode, data) => {
    console.log('Login: handleModeSelect called with mode:', mode);
    console.log('Login: handleModeSelect called with data:', data);
    
    setShowModeSelection(false);
    
    if (mode === 'results') {
      // Results mode - direct to builder with ChronoTrack data
      localStorage.setItem('raceDisplayMode', mode);
      localStorage.setItem('raceDisplayData', JSON.stringify(data));
      
      console.log('Login: Stored results mode in localStorage:', mode);
      console.log('Login: About to navigate to /builder');
      
      // Navigate to builder
      navigate('/builder');
    } else if (mode === 'pre-race') {
      // Pre-race mode - show provider selection flow
      setShowPreRaceFlow(true);
    }
    
    console.log('Login: Navigation called');
  };

  const handlePreRaceComplete = (mode, data) => {
    console.log('Login: Pre-race flow completed with data:', data);
    
    setShowPreRaceFlow(false);
    
    // Store mode and data for the builder
    localStorage.setItem('raceDisplayMode', mode);
    localStorage.setItem('raceDisplayData', JSON.stringify(data));
    
    console.log('Login: Stored pre-race mode in localStorage:', mode);
    console.log('Login: About to navigate to /builder');
    
    // Navigate to builder
    navigate('/builder');
  };

  const handleCloseModal = () => {
    setShowModeSelection(false);
    setShowPreRaceFlow(false);
    setCredentials(null);
    setStatus('');
  };

  return (
    <>
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <form onSubmit={handleSubmit} className="rd-form">
          <h2 className="mb-4">Race Display</h2>
          <div className="rd-form-control">
            <input
              className="rd-input"
              placeholder="User ID"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              required
            />
          </div>
          <div className="rd-form-control">
            <input
              className="rd-input"
              placeholder="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="rd-form-control">
            <input
              className="rd-input"
              placeholder="Event ID"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              required
            />
          </div>
          <div className="rd-button-group">
            <button className="rd-button" type="submit">Login</button>
          </div>
          {status && <div className="rd-alert">{status}</div>}
          {progress.total > 0 && (
            <div className="progress mt-2" style={{ width: '100%' }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
                aria-valuenow={progress.loaded}
                aria-valuemin="0"
                aria-valuemax={progress.total}
              >{`${progress.loaded}/${progress.total}`}</div>
            </div>
          )}
        </form>
      </div>
      
      <ModeSelectionModal
        isOpen={showModeSelection}
        onModeSelect={handleModeSelect}
        credentials={credentials}
        onClose={handleCloseModal}
      />
      
      <PreRaceFlow
        isOpen={showPreRaceFlow}
        onComplete={handlePreRaceComplete}
        onClose={handleCloseModal}
      />
    </>
  );
}
