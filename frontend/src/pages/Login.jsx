import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModeSelectionModal from '../components/ModeSelectionModal';
import ChronoTrackLogin from '../components/ChronotrackLogin';
import PreRaceFlow from '../components/PreRaceFlow';

export default function Login() {
  const [showModeSelection, setShowModeSelection] = useState(true);
  const [showChronoLogin, setShowChronoLogin] = useState(false);
  const [showPreRaceFlow, setShowPreRaceFlow] = useState(false);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleModeSelect = (mode) => {
    setShowModeSelection(false);

    if (mode === 'results') {
      setShowChronoLogin(true);
    } else if (mode === 'pre-race') {
      setShowPreRaceFlow(true);
    }
  };

  const handleChronoCredentialsSubmit = async (creds) => {
    setStatus('Connecting...');

    const formData = new FormData();
    formData.append('user_id', creds.user_id);
    formData.append('password', creds.user_pass);
    formData.append('event_id', creds.event_id);

    try {
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        const modeRes = await fetch('/api/select-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'results', ...creds })
        });
        const modeData = await modeRes.json();

        if (modeData.success) {
          localStorage.setItem('raceDisplayMode', 'results');
          localStorage.setItem('raceDisplayData', JSON.stringify(modeData));
          navigate('/builder');
        } else {
          setStatus(modeData.error || 'Mode selection failed');
        }
      } else {
        setStatus(data.error || 'Login failed');
      }
    } catch (err) {
      setStatus('Network error');
    } finally {
      setShowChronoLogin(false);
    }
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
    setShowChronoLogin(false);
    setStatus('');
  };

  return (
    <>
      {status && <div className="rd-alert" style={{ textAlign: 'center' }}>{status}</div>}

      <ModeSelectionModal
        isOpen={showModeSelection}
        onModeSelect={handleModeSelect}
        manual
        onClose={handleCloseModal}
      />

      <ChronoTrackLogin
        isOpen={showChronoLogin}
        onCredentialsSubmit={handleChronoCredentialsSubmit}
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
