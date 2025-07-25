import React, { useState, useEffect } from 'react';
import ProviderSelectionModal from './ProviderSelectionModal';
import CredentialsModal from './CredentialsModal';
import EventSelectionModal from './EventSelectionModal';

const PreRaceFlow = ({ isOpen, onComplete, onClose }) => {
  const [currentStep, setCurrentStep] = useState('provider');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [providersFetched, setProvidersFetched] = useState(false);

  if (!isOpen) return null;

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch('/api/providers');
        if (!response.ok) {
          throw new Error('Failed to fetch providers');
        }
        const data = await response.json();
        if (data.success) {
          const availableProviders = Object.entries(data.providers).filter(
            ([, provider]) => provider.available && provider.supports_prerace
          );
          if (availableProviders.length === 1) {
            const [id] = availableProviders[0];
            handleProviderSelect(id);
          }
        }
      } catch (error) {
        console.error('PreRaceFlow: Error fetching providers:', error);
      } finally {
        setProvidersFetched(true);
      }
    };

    if (isOpen && currentStep === 'provider' && !providersFetched) {
      fetchProviders();
    }
  }, [isOpen, currentStep, providersFetched]);

  const handleProviderSelect = (provider) => {
    console.log('PreRaceFlow: Provider selected:', provider);
    setSelectedProvider(provider);
    setCurrentStep('credentials');
  };

  const handleCredentialsSubmit = (providerCredentials) => {
    console.log('PreRaceFlow: Credentials submitted for provider:', selectedProvider);
    setCredentials(providerCredentials);
    setCurrentStep('events');
  };

  const handleEventSelect = async (eventData) => {
    console.log('PreRaceFlow: Event selected:', eventData);
    
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
        console.log('PreRaceFlow: Event selection successful:', result);
        
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
    setProvidersFetched(false);
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