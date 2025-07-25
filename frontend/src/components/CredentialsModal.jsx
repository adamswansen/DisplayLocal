import React, { useState } from 'react';
import './CredentialsModal.css';

const CredentialsModal = ({ isOpen, provider, onCredentialsSubmit, onBack, onClose }) => {
  const [credentials, setCredentials] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTestConnection = async () => {
    if (!provider) return;

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-provider-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          credentials
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        // Auto-submit on successful test
        setTimeout(() => {
          onCredentialsSubmit(credentials);
        }, 1500);
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Network error: ' + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    onCredentialsSubmit(credentials);
  };

  const getProviderFields = () => {
    if (provider === 'chronotrack') {
      return [
        { key: 'user_id', label: 'User ID', type: 'text', required: true },
        { key: 'password', label: 'Password', type: 'password', required: true },
        { key: 'event_id', label: 'Event ID', type: 'text', required: true }
      ];
    } else if (provider === 'runsignup') {
      return [
        { key: 'api_key', label: 'API Key', type: 'text', required: true },
        { key: 'api_secret', label: 'API Secret', type: 'password', required: true }
      ];
    }
    return [];
  };

  const getProviderInfo = () => {
    if (provider === 'chronotrack') {
      return {
        name: 'ChronoTrack Live',
        description: 'Enter your ChronoTrack Live credentials to access event data.',
        icon: '⏱️',
        helpText: 'You can find these credentials in your ChronoTrack Live account settings.'
      };
    } else if (provider === 'runsignup') {
      return {
        name: 'RunSignUp',
        description: 'Enter your RunSignUp API credentials to access race data.',
        icon: '🏃‍♂️',
        helpText: 'You can find your API credentials in your RunSignUp account under API Settings.'
      };
    }
    return { name: 'Provider', description: '', icon: '❓' };
  };

  const providerInfo = getProviderInfo();
  const fields = getProviderFields();

  return (
    <div className="credentials-backdrop">
      <div className="credentials-modal">
        <div className="credentials-header">
          <div className="credentials-provider-info">
            <span className="credentials-icon">{providerInfo.icon}</span>
            <div>
              <h2>{providerInfo.name} Credentials</h2>
              <p>{providerInfo.description}</p>
            </div>
          </div>
          <button className="credentials-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="credentials-content">
          <form onSubmit={(e) => { e.preventDefault(); handleTestConnection(); }}>
            {fields.map(field => (
              <div key={field.key} className="credentials-field">
                <label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="required">*</span>}
                </label>
                    <input
                  id={field.key}
                  type={field.type}
                  value={credentials[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  required={field.required}
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  className="credentials-input"
                    />
                  </div>
            ))}

            <div className="credentials-help">
              <p>{providerInfo.helpText}</p>
                  </div>

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                <div className="test-result-icon">
                  {testResult.success ? '✅' : '❌'}
                  </div>
                <div className="test-result-content">
                  <h4>{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</h4>
                  <p>{testResult.message || testResult.error}</p>
                  {testResult.success && (
                    <p className="auto-proceed">Proceeding to event selection...</p>
                  )}
                  </div>
                  </div>
            )}

            <div className="credentials-actions">
              <button
                type="button"
                onClick={onBack}
                className="credentials-back-btn"
                disabled={isLoading}
              >
                ← Back
              </button>
                <button 
                  type="submit" 
                className="credentials-test-btn"
                disabled={isLoading || fields.some(f => f.required && !credentials[f.key])}
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
                </button>
              {testResult?.success && (
                <button 
                  type="button" 
                  onClick={handleSubmit}
                  className="credentials-continue-btn"
                >
                  Continue →
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CredentialsModal; 