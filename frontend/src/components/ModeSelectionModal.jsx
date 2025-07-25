import React, { useState } from 'react';
import './ModeSelectionModal.css';

const ModeSelectionModal = ({ isOpen, onModeSelect, credentials, onClose, manual = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState('');

  if (!isOpen) return null;

  const handleModeSelect = async (mode) => {
    if (manual) {
      onModeSelect(mode);
      return;
    }

    try {
      // Set loading state
      setIsLoading(true);
      setLoadingMode(mode);
      
      if (mode === 'results') {
        // Results mode - direct to ChronoTrack
        const controller = new AbortController();
        const timeoutDuration = 45000; // 45s for results (backend needs up to 30s)
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
        
        const response = await fetch('/api/select-mode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode,
            ...credentials
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          onModeSelect(mode, result);
        } else {
          throw new Error(result.error || 'Mode selection failed');
        }
      } else if (mode === 'pre-race') {
        // Pre-race mode - go to provider selection flow
        // Don't make API call here, just pass the mode to parent
        onModeSelect(mode, {
          success: true,
          mode: 'pre-race',
          status: 'Ready for provider selection',
          credentials: credentials
        });
      }
      
    } catch (error) {
      let errorMessage = 'Mode selection failed';
      
      if (error.name === 'AbortError') {
        errorMessage = `Request timed out after 45 seconds. Please try again.`;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingMode('');
    }
  };

  return (
    <div className="mode-selection-backdrop">
      <div className="mode-selection-modal">
        <h2>Choose Display Mode</h2>
        <p>Select how you want to display race information:</p>
        
        {isLoading && (
          <div className="mode-loading">
            <div className="loading-spinner"></div>
            <p>Loading {loadingMode} data... This may take a moment for large events.</p>
          </div>
        )}
        
        <div className="mode-options">
          <div 
            className={`mode-option ${isLoading ? 'disabled' : ''}`} 
            onClick={() => !isLoading && handleModeSelect('pre-race')}
          >
            <div className="mode-icon">🏃‍♂️</div>
            <h3>Pre-Race Mode</h3>
            <p>Display real-time runner information during the race with pre-race roster data.</p>
            <ul>
              <li>Real-time timing data</li>
              <li>Pre-race roster information</li>
              <li>Live runner updates</li>
              <li>Current pace and chip times</li>
              <li>Overall ranking during race</li>
            </ul>
            <div className="mode-note">
              <small>💡 Choose your registration provider (ChronoTrack Live or RunSignUp)</small>
            </div>
          </div>
          
          <div 
            className={`mode-option ${isLoading ? 'disabled' : ''}`} 
            onClick={() => !isLoading && handleModeSelect('results')}
          >
            <div className="mode-icon">🏆</div>
            <h3>Results Mode</h3>
            <p>Display real-time timing data enriched with final race results and performance metrics.</p>
            <ul>
              <li>Real-time timing data</li>
              <li>Final finish times and rankings</li>
              <li>Division rankings</li>
              <li>Pace per mile calculations</li>
              <li>Penalty time handling</li>
            </ul>
            <div className="mode-note">
              <small>💡 Uses ChronoTrack Live for results data</small>
            </div>
          </div>
        </div>
        
        <button className="mode-cancel-btn" onClick={onClose} disabled={isLoading}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ModeSelectionModal; 