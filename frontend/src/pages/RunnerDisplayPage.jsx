import React, { useState, useEffect, useRef } from 'react';
import RunnerDisplay from '../components/RunnerDisplay';

export default function RunnerDisplayPage() {
  const [runner, setRunner] = useState(null);
  const [template, setTemplate] = useState(null);
  const [displayDuration, setDisplayDuration] = useState(5000); // Default 5 seconds
  const [currentDisplayState, setCurrentDisplayState] = useState('resting'); // 'active' or 'resting'
  const [lastRunnerTime, setLastRunnerTime] = useState(0);
  
  // Refs for managing timers and state
  const activeStateTimerRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const currentStateRef = useRef('resting'); // Track actual state synchronously
  const currentRunnerRef = useRef(null); // Track current runner synchronously

  // Load display duration from API
  useEffect(() => {
    const loadDisplayDuration = async () => {
      try {
        const response = await fetch('/api/display-settings');
        if (response.ok) {
          const data = await response.json();
          const newDuration = data.duration * 1000; // Convert to milliseconds
          console.log('[RunnerDisplayPage] Loaded display duration:', data.duration, 'seconds');
          setDisplayDuration(newDuration);
        } else {
          console.warn('[RunnerDisplayPage] Failed to load display duration, using default');
          setDisplayDuration(5000); // Default 5 seconds
        }
      } catch (error) {
        console.error('[RunnerDisplayPage] Failed to load display duration:', error);
        setDisplayDuration(5000); // Default 5 seconds
      }
    };

    loadDisplayDuration();
  }, []);

  // Load template from localStorage
  useEffect(() => {
    const savedTemplate = localStorage.getItem('currentDisplayTemplate');
    console.log('[RunnerDisplayPage] Checking localStorage for template...');
    
    if (savedTemplate) {
      try {
        const templateData = JSON.parse(savedTemplate);
        console.log('[RunnerDisplayPage] Loaded template from localStorage:', {
          hasActiveState: !!templateData.activeState,
          hasRestingState: !!templateData.restingState,
          activeStateHtml: templateData.activeState?.html ? 'present' : 'null',
          restingStateHtml: templateData.restingState?.html ? 'present' : 'null',
          legacyHtml: templateData.html ? 'present' : 'null',
          legacyCss: templateData.css ? 'present' : 'null'
        });
        
        // Handle new format with active/resting states
        if (templateData.activeState && templateData.restingState) {
          console.log('[RunnerDisplayPage] Using new format with active/resting states');
          setTemplate({
            activeState: templateData.activeState,
            restingState: templateData.restingState,
            canvasWidth: templateData.canvasWidth || 800,
            canvasHeight: templateData.canvasHeight || 600,
          });
        } else if (templateData.html) {
          // Handle legacy format
          console.log('[RunnerDisplayPage] Using legacy format');
          setTemplate({
            html: templateData.html,
            css: templateData.css,
            canvasWidth: templateData.canvasWidth || 800,
            canvasHeight: templateData.canvasHeight || 600,
            backgroundStyles: templateData.backgroundStyles || templateData.backgroundColor || 'transparent'
          });
        } else {
          console.error('[RunnerDisplayPage] Template data is invalid - no HTML content found');
        }
      } catch (error) {
        console.error('[RunnerDisplayPage] Failed to parse template data:', error);
      }
    } else {
      console.log('[RunnerDisplayPage] No template found in localStorage');
    }
  }, []);

  // Function to switch to resting state
  const switchToRestingState = async () => {
    console.log('[RunnerDisplayPage] Switching to resting state');
    
    // Clear any existing active state timer
    if (activeStateTimerRef.current) {
      clearTimeout(activeStateTimerRef.current);
      activeStateTimerRef.current = null;
    }
    
    // Mark the current runner as displayed to remove them from the queue
    if (currentRunnerRef.current) {
      console.log('[RunnerDisplayPage] Marking runner as displayed:', currentRunnerRef.current.bib);
      try {
        const response = await fetch('/api/runner-displayed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const result = await response.json();
          console.log('[RunnerDisplayPage] Runner marked as displayed:', result);
          
          // Debug: Check queue status after marking runner as displayed
          if (result.success) {
            console.log('[RunnerDisplayPage] Queue size after removal:', result.queue_size);
            console.log('[RunnerDisplayPage] Next runner in queue:', result.next_runner ? result.next_runner.bib : 'none');
            
            // If there's a next runner in the queue, switch to them immediately
            if (result.next_runner) {
              console.log('[RunnerDisplayPage] Next runner available, switching immediately:', result.next_runner.bib);
              switchToActiveState(result.next_runner);
              return; // Don't switch to resting state
            }
          }
        } else {
          console.error('[RunnerDisplayPage] Failed to mark runner as displayed - HTTP error:', response.status);
        }
      } catch (error) {
        console.error('[RunnerDisplayPage] Failed to mark runner as displayed:', error);
      }
    } else {
      console.log('[RunnerDisplayPage] No runner to mark as displayed');
    }
    
    // Only switch to resting state if no next runner is available
    console.log('[RunnerDisplayPage] No next runner available, switching to resting state');
    currentStateRef.current = 'resting';
    currentRunnerRef.current = null;
    setCurrentDisplayState('resting');
    setRunner(null);
    setLastRunnerTime(0);
  };

  // Function to switch to active state
  const switchToActiveState = (runnerData) => {
    const startTime = Date.now();
    const expectedEndTime = startTime + displayDuration;
    
    console.log('[RunnerDisplayPage] Switching to active state with runner:', runnerData.name || runnerData.bib, 'Duration:', displayDuration / 1000 + 's');
    console.log('[RunnerDisplayPage] Timer start time:', new Date(startTime).toLocaleTimeString());
    console.log('[RunnerDisplayPage] Expected end time:', new Date(expectedEndTime).toLocaleTimeString());
    
    // Clear any existing timer
    if (activeStateTimerRef.current) {
      clearTimeout(activeStateTimerRef.current);
    }
    
    // Update state synchronously
    currentStateRef.current = 'active';
    currentRunnerRef.current = runnerData;
    setCurrentDisplayState('active');
    setRunner(runnerData);
    setLastRunnerTime(startTime);
    
    // Set timer to switch back to resting state after duration
    activeStateTimerRef.current = setTimeout(async () => {
      console.log('[RunnerDisplayPage] Duration expired, switching to resting state');
      console.log('[RunnerDisplayPage] Actual end time:', new Date().toLocaleTimeString());
      console.log('[RunnerDisplayPage] Current runner at timer expiration:', currentRunnerRef.current?.bib);
      await switchToRestingState();
    }, displayDuration);
    
    console.log('[RunnerDisplayPage] Timer set for', displayDuration / 1000, 'seconds');
  };

  // Function to check for new runner data
  const loadRunnerData = async () => {
    try {
      console.log('[RunnerDisplayPage] Polling for runner data...');
      const response = await fetch('/api/current-runner');
      console.log('[RunnerDisplayPage] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[RunnerDisplayPage] API response data:', data);
        
        // New queuing system returns { runner: {...}, queue_size: X, max_queue_size: Y }
        const runnerData = data.runner;
        const queueSize = data.queue_size || 0;
        
        console.log('[RunnerDisplayPage] Queue status:', { queueSize, maxQueueSize: data.max_queue_size });
        console.log('[RunnerDisplayPage] Runner data:', runnerData);
        
        // If we have runner data with a bib number
        if (runnerData && runnerData.bib) {
          console.log('[RunnerDisplayPage] Found runner with bib:', runnerData.bib);
          
          // Check if this is a different runner than what we're currently displaying
          const isDifferentRunner = !currentRunnerRef.current || runnerData.bib !== currentRunnerRef.current.bib;
          const isInRestingState = currentStateRef.current === 'resting'; // Use ref for immediate state check
          
          console.log('[RunnerDisplayPage] State analysis:', {
            isDifferentRunner,
            isInRestingState,
            currentRunner: currentRunnerRef.current?.bib,
            newRunner: runnerData.bib,
            currentState: currentStateRef.current,
            hasActiveTimer: !!activeStateTimerRef.current
          });
          
          // Only switch to active state if we're in resting state
          if (isInRestingState) {
            console.log('[RunnerDisplayPage] In resting state, switching to new runner:', runnerData.bib);
            switchToActiveState(runnerData);
          } else {
            console.log('[RunnerDisplayPage] In active state, keeping current runner:', currentRunnerRef.current?.bib);
          }
        } else if (currentStateRef.current === 'active' && currentRunnerRef.current) {
          // If we're in active state but no runner in queue, stay in active state
          // (the timer will handle switching to resting state)
          console.log('[RunnerDisplayPage] No new runners in queue, keeping current runner');
        } else if (currentStateRef.current === 'resting' && queueSize === 0) {
          // If we're in resting state and no runners in queue, that's expected
          console.log('[RunnerDisplayPage] No runners in queue, staying in resting state');
        } else {
          console.log('[RunnerDisplayPage] No runner data available');
        }
        
        // Debug: Check queue details periodically
        if (currentStateRef.current === 'resting' && queueSize > 0) {
          console.log('[RunnerDisplayPage] DEBUG: In resting state with queue size > 0, checking queue details...');
          try {
            const debugResponse = await fetch('/api/queue-debug');
            if (debugResponse.ok) {
              const debugData = await debugResponse.json();
              console.log('[RunnerDisplayPage] Queue debug data:', debugData);
            }
          } catch (error) {
            console.error('[RunnerDisplayPage] Failed to get queue debug data:', error);
          }
        }
      } else {
        console.error('[RunnerDisplayPage] API request failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[RunnerDisplayPage] Failed to load runner data:', error);
    }
  };

  // Main polling effect
  useEffect(() => {
    // Initial load
    loadRunnerData();

    // Set up polling interval to check for new runner data
    pollingIntervalRef.current = setInterval(loadRunnerData, 1000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (activeStateTimerRef.current) {
        clearTimeout(activeStateTimerRef.current);
      }
    };
  }, []); // Empty dependency array - this effect should only run once

  // Effect to handle duration changes
  useEffect(() => {
    const handleDurationChange = async () => {
      console.log('[RunnerDisplayPage] Duration changed to:', displayDuration / 1000, 'seconds');
      
      // If we're currently in active state, update the timer with new duration
      if (currentStateRef.current === 'active' && lastRunnerTime > 0) {
        const timeElapsed = Date.now() - lastRunnerTime;
        const remainingTime = Math.max(0, displayDuration - timeElapsed);
        
        console.log('[RunnerDisplayPage] Duration change - time elapsed:', timeElapsed / 1000, 's, remaining:', remainingTime / 1000, 's');
        
        // Clear existing timer
        if (activeStateTimerRef.current) {
          clearTimeout(activeStateTimerRef.current);
        }
        
        // Set new timer with remaining time
        if (remainingTime > 0) {
          activeStateTimerRef.current = setTimeout(async () => {
            console.log('[RunnerDisplayPage] Duration expired (after change), switching to resting state');
            await switchToRestingState();
          }, remainingTime);
          console.log('[RunnerDisplayPage] Timer updated for', remainingTime / 1000, 'seconds');
        } else {
          // Duration already expired
          console.log('[RunnerDisplayPage] Duration already expired, switching to resting state');
          await switchToRestingState();
        }
      }
    };
    
    handleDurationChange();
  }, [displayDuration]); // Only depend on displayDuration, not currentDisplayState or lastRunnerTime

  // Get the appropriate template content for the current state
  const getCurrentTemplateContent = () => {
    if (!template) {
      console.log('[RunnerDisplayPage] No template available');
      return null;
    }
    
    // New format with states
    if (template.activeState && template.restingState) {
      const stateContent = currentDisplayState === 'active' ? template.activeState : template.restingState;
      console.log(`[RunnerDisplayPage] Using ${currentDisplayState} state template:`, stateContent ? 'present' : 'null');
      return stateContent;
    }
    
    // Legacy format - always use the same content
    console.log(`[RunnerDisplayPage] Using legacy template format`);
    return template;
  };

  const currentTemplateContent = getCurrentTemplateContent();

  // Debug logging
  useEffect(() => {
    console.log(`[RunnerDisplayPage] State update:`, {
      currentDisplayState,
      hasRunner: !!runner,
      hasTemplate: !!template,
      hasActiveState: !!(template?.activeState),
      hasRestingState: !!(template?.restingState),
      templateContent: currentTemplateContent ? 'present' : 'null',
      displayDuration: displayDuration / 1000 + 's',
      lastRunnerTime: lastRunnerTime ? new Date(lastRunnerTime).toLocaleTimeString() : 'none'
    });
  }, [currentDisplayState, runner, template, currentTemplateContent, displayDuration, lastRunnerTime]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
      {currentTemplateContent ? (
        <RunnerDisplay 
          runner={runner} 
          template={currentTemplateContent} 
          displayDuration={displayDuration}
        />
      ) : (
        <div className="no-template-message" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '24px',
          color: '#fff',
          backgroundColor: '#000'
        }}>
          <h2>No Template Loaded</h2>
          <p>Please create or select a template in the builder first.</p>
          <p>Current state: {currentDisplayState}</p>
          <p>Template available: {template ? 'Yes' : 'No'}</p>
          {template && (
            <div>
              <p>Active state: {template.activeState ? 'Yes' : 'No'}</p>
              <p>Resting state: {template.restingState ? 'Yes' : 'No'}</p>
            </div>
          )}
          <p>Duration: {displayDuration / 1000}s</p>
          <p>Last runner time: {lastRunnerTime ? new Date(lastRunnerTime).toLocaleTimeString() : 'None'}</p>
        </div>
      )}
    </div>
  );
} 