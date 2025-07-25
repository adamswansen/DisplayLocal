import React, { useState, useEffect } from 'react';
import './ProviderSelectionModal.css';
import { log } from '../utils/logger';

const ProviderSelectionModal = ({ isOpen, onProviderSelect, onClose, mode = 'pre-race' }) => {
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/providers');
      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }
      
      const data = await response.json();
      console.log('ProviderSelectionModal: Fetched data =', data);
      if (data.success) {
        console.log('ProviderSelectionModal: Setting providers =', data.providers);
        setProviders(data.providers);
      } else {
        throw new Error(data.error || 'Failed to fetch providers');
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderClick = (providerId, provider) => {
    log('ProviderSelectionModal: Provider clicked:', providerId, provider);
    onProviderSelect(providerId);
  };

  if (!isOpen) return null;

  console.log('ProviderSelectionModal: isOpen =', isOpen, 'mode =', mode);
  console.log('ProviderSelectionModal: providers =', providers);
  console.log('ProviderSelectionModal: loading =', loading, 'error =', error);

  const getAvailableProviders = () => {
    console.log('ProviderSelectionModal: getAvailableProviders called, mode =', mode);
    console.log('ProviderSelectionModal: providers =', providers);
    if (mode === 'pre-race') {
      // For pre-race mode, show providers that support pre-race
      const filtered = Object.entries(providers).filter(([id, provider]) => 
        provider.available && provider.supports_prerace
      );
      console.log('ProviderSelectionModal: pre-race filtered providers =', filtered);
      return filtered;
    } else {
      // For other modes, show all available providers
      const filtered = Object.entries(providers).filter(([id, provider]) => 
        provider.available
      );
      console.log('ProviderSelectionModal: other mode filtered providers =', filtered);
      return filtered;
    }
  };

  const availableProviders = getAvailableProviders();
  console.log('ProviderSelectionModal: availableProviders =', availableProviders);

  return (
    <div className="provider-selection-backdrop">
      <div className="provider-selection-modal">
        <div className="provider-selection-header">
          <h2>Select Registration Provider</h2>
          <p>Choose your race registration platform to load participant data</p>
          <button className="provider-close-btn" onClick={onClose}>×</button>
        </div>

        {loading && (
          <div className="provider-loading">
            <div className="loading-spinner"></div>
            <p>Loading available providers...</p>
          </div>
        )}

        {error && (
          <div className="provider-error">
            <p>Error: {error}</p>
            <button onClick={fetchProviders}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="provider-grid">
            {availableProviders.map(([id, provider]) => (
              <div
                key={id}
                className="provider-card"
                onClick={() => handleProviderClick(id, provider)}
              >
                <div className="provider-icon">
                  {id === 'chronotrack' && '⏱️'}
                  {id === 'runsignup' && '🏃‍♂️'}
                  {id === 'haku' && '🎯'}
                  {id === 'raceroster' && '📊'}
                  {id === 'letsdo' && '🚀'}
                </div>
                <div className="provider-info">
                  <h3>{provider.name}</h3>
                  <p className="provider-description">
                    {id === 'chronotrack' && 'ChronoTrack Live provides real-time race data and results.'}
                    {id === 'runsignup' && 'RunSignUp offers comprehensive race management and participant data.'}
                    {id === 'haku' && 'Haku race management platform (coming soon).'}
                    {id === 'raceroster' && 'Race Roster registration platform (coming soon).'}
                    {id === 'letsdo' && "Let's Do This event platform (coming soon)."}
                  </p>
                  <div className="provider-features">
                    {provider.supports_prerace && <span className="feature-tag">Pre-Race</span>}
                    {provider.supports_results && <span className="feature-tag">Results</span>}
                  </div>
                </div>
                <div className="provider-status">
                  {provider.available ? (
                    <span className="status-available">Available</span>
                  ) : (
                    <span className="status-coming-soon">Coming Soon</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && availableProviders.length === 0 && (
          <div className="provider-empty">
            <p>No providers available for {mode} mode.</p>
          </div>
        )}

        <div className="provider-selection-footer">
          <button className="provider-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderSelectionModal; 