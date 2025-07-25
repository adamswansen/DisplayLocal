import React, { useState } from 'react';
import ProviderSelectionModal from './ProviderSelectionModal';
import CredentialsModal from './CredentialsModal';
import EventSelectionModal from './EventSelectionModal';
import { log } from '../utils/logger';

const PreRaceFlow = ({ isOpen, onComplete, onClose }) => {
  const [currentStep, setCurrentStep] = useState('provider');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleProviderSelect = (provider) => {
    log('PreRaceFlow: Provider selected:', provider);
    setSelectedProvider(provider);
    setCurrentStep('credentials');
  };

  const handleCredentialsSubmit = (providerCredentials) => {
    log('PreRaceFlow: Credentials submitted for provider:', selectedProvider);
    setCredentials(providerCredentials);
    setCurrentStep('events');
  };

  const handleEventSelect = async (eventData) => {
    log('PreRaceFlow: Event selected:', eventData);
    
    try {
      setIsLoading(true);
      
      // Make API call to select event and load roster data
      const response = await fetch('/api/select-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventData.event,
          provider: selectedProvider,
          credentials: credentials,
          selectedEvents: eventData.selectedEvents || [eventData.event]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        log('PreRaceFlow: Event selection successful:', result);
        
        // Complete the flow and pass data to parent
        onComplete('pre-race', {
          success: true,
          mode: 'pre-race',
          provider: selectedProvider,
          event: eventData.event,
          selectedEvents: eventData.selectedEvents,
          credentials: credentials,
          rosterData: result,
          status: 'Ready to receive timing data',
          race_name: result.race_name,
          runners_loaded: result.unique_participants_loaded || result.participants_loaded,
          background_refresh: result.background_refresh,
          tcp_listener: result.tcp_listener
        });
      } else {
        throw new Error(result.error || 'Event selection failed');
      }
      
    } catch (error) {
      console.error('PreRaceFlow: Event selection error:', error);
      alert(`Event selection failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'events') {
      setCurrentStep('credentials');
    } else if (currentStep === 'credentials') {
      setCurrentStep('provider');
    }
  };

  const handleClose = () => {
    // Reset state
    setCurrentStep('provider');
    setSelectedProvider(null);
    setCredentials({});
    setIsLoading(false);
    onClose();
  };

  return (
    <>
      {/* Provider Selection */}
      <ProviderSelectionModal
        isOpen={currentStep === 'provider'}
        onProviderSelect={handleProviderSelect}
        onClose={handleClose}
        mode="pre-race"
      />

      {/* Credentials Entry */}
      <CredentialsModal
        isOpen={currentStep === 'credentials'}
        provider={selectedProvider}
        onCredentialsSubmit={handleCredentialsSubmit}
        onBack={handleBack}
        onClose={handleClose}
      />

      {/* Event Selection */}
      <EventSelectionModal
        isOpen={currentStep === 'events'}
        provider={selectedProvider}
        credentials={credentials}
        onEventSelect={handleEventSelect}
        onBack={handleBack}
        onClose={handleClose}
        isLoading={isLoading}
      />
    </>
  );
};

export default PreRaceFlow; 