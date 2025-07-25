import React, { useState, useEffect } from 'react';
import './EventSelectionModal.css';
import { log } from '../utils/logger';

const EventSelectionModal = ({ isOpen, provider, credentials, onEventSelect, onBack, onClose, isLoading: externalLoading }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && provider && credentials) {
      fetchEvents();
    }
  }, [isOpen, provider, credentials]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      setEvents([]);
      setSelectedEvents([]);
      
      log('EventSelectionModal: Fetching events for provider:', provider);
      log('EventSelectionModal: Using credentials:', credentials);
      
      const response = await fetch('/api/fetch-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          credentials
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        log('EventSelectionModal: Events fetched successfully:', data.events);
        setEvents(data.events || []);
      } else {
        throw new Error(data.error || 'Failed to fetch events');
      }
    } catch (err) {
      console.error('EventSelectionModal: Error fetching events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEventToggle = (event) => {
    const eventKey = `${event.race_id}-${event.event_id}`;
    setSelectedEvents(prev => {
      const isSelected = prev.some(e => `${e.race_id}-${e.event_id}` === eventKey);
      if (isSelected) {
        return prev.filter(e => `${e.race_id}-${e.event_id}` !== eventKey);
      } else {
        return [...prev, event];
      }
    });
  };

  const handleSelectEvents = () => {
    if (selectedEvents.length === 0) {
      alert('Please select at least one event.');
      return;
    }

    // For single event selection, use the first selected event
    const primaryEvent = selectedEvents[0];
    
    log('EventSelectionModal: Selected events:', selectedEvents);
    log('EventSelectionModal: Primary event:', primaryEvent);
    
    onEventSelect({
      event: primaryEvent,
      selectedEvents: selectedEvents
    });
  };

  const filteredEvents = events.filter(event => {
    const searchLower = searchTerm.toLowerCase();
    return (
      event.race_name?.toLowerCase().includes(searchLower) ||
      event.event_name?.toLowerCase().includes(searchLower) ||
      event.location?.toLowerCase().includes(searchLower) ||
      event.event_date?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    
    try {
      // Try different date formats
      const dateFormats = [
        '6/28/2025 07:30',
        '2025-06-27T08:00:00',
        '2025-06-27 08:00:00',
        '6/28/2025',
        '2025-06-27'
      ];
      
      let parsedDate = null;
      for (const format of dateFormats) {
        try {
          // This is a simplified approach - in production you'd use a proper date library
          if (dateStr.includes('/')) {
            const [month, day, year] = dateStr.split('/');
            parsedDate = new Date(year, month - 1, day);
          } else if (dateStr.includes('T')) {
            parsedDate = new Date(dateStr);
          } else if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            parsedDate = new Date(year, month - 1, day);
          }
          if (parsedDate && !isNaN(parsedDate.getTime())) break;
        } catch (e) {
          continue;
        }
      }
      
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getProviderIcon = () => {
    return provider === 'chronotrack' ? '⏱️' : '🏃‍♂️';
  };

  const getProviderName = () => {
    return provider === 'chronotrack' ? 'ChronoTrack Live' : 'RunSignUp';
  };

  if (!isOpen) return null;

  return (
    <div className="event-selection-backdrop">
      <div className="event-selection-modal">
        <div className="event-selection-header">
          <div className="event-selection-provider-info">
            <span className="event-selection-icon">{getProviderIcon()}</span>
            <div>
              <h2>Select Event</h2>
              <p>Choose events from {getProviderName()}</p>
            </div>
          </div>
          <button className="event-selection-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="event-selection-content">
          {loading && (
            <div className="event-selection-loading">
              <div className="loading-spinner"></div>
              <p>Fetching events from {getProviderName()}...</p>
            </div>
          )}

          {error && (
            <div className="event-selection-error">
              <p>Error: {error}</p>
              <button onClick={fetchEvents}>Retry</button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="event-selection-empty">
              <p>No events found for the selected provider.</p>
              <p>Make sure your credentials have access to event data.</p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <>
              <div className="event-selection-search">
                <input
                  type="text"
                  placeholder="Search events by name, location, or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="event-search-input"
                />
              </div>

              <div className="event-selection-info">
                <p>
                  Found {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
                {selectedEvents.length > 0 && (
                  <p className="selected-count">
                    {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="event-list">
                {filteredEvents.map((event, index) => {
                  const eventKey = `${event.race_id}-${event.event_id}`;
                  const isSelected = selectedEvents.some(e => `${e.race_id}-${e.event_id}` === eventKey);
                  
                  return (
                    <div
                      key={eventKey}
                      className={`event-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleEventToggle(event)}
                    >
                      <div className="event-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleEventToggle(event)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="event-details">
                        <h3>{event.event_name || 'Unnamed Event'}</h3>
                        <p className="event-race">{event.race_name}</p>
                        <div className="event-meta">
                          <span className="event-date">{formatDate(event.event_date)}</span>
                          {event.location && <span className="event-location">📍 {event.location}</span>}
                          {event.distance && <span className="event-distance">{event.distance} {event.units || 'miles'}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredEvents.length === 0 && searchTerm && (
                <div className="event-selection-empty">
                  <p>No events match your search.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="event-selection-footer">
          <button
            onClick={onBack}
            className="event-selection-back-btn"
            disabled={externalLoading}
          >
            ← Back
          </button>
          
          {!loading && !error && events.length > 0 && (
            <button
              onClick={handleSelectEvents}
              className="event-selection-continue-btn"
              disabled={selectedEvents.length === 0 || externalLoading}
            >
              {externalLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Loading...
                </>
              ) : (
                `Continue with ${selectedEvents.length} Event${selectedEvents.length !== 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventSelectionModal; 