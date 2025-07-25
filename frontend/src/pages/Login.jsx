import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModeSelectionModal from '../components/ModeSelectionModal';
import PreRaceFlow from '../components/PreRaceFlow';

export default function Login() {
  const [showModeSelection, setShowModeSelection] = useState(true);
  const [showPreRaceFlow, setShowPreRaceFlow] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleModeSelect = (mode) => {
    console.log('Login: handleModeSelect called with mode:', mode);
    setShowModeSelection(false);
    setSelectedMode(mode);
    setShowPreRaceFlow(true);
    console.log('Login: Set showPreRaceFlow to true');
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

      <PreRaceFlow
        isOpen={showPreRaceFlow}
        onComplete={handlePreRaceComplete}
        onClose={handleCloseModal}
      />
    </>
  );
}
