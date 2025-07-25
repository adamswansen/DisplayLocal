import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RunnerDisplayPage from './RunnerDisplayPage';
import './FullscreenDisplay.css';

export default function FullscreenDisplay() {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);

  const [showControls, setShowControls] = useState(false);
  const hideTimeout = useRef(null);

  useEffect(() => {
    // Load template info for debugging
    const savedTemplate = localStorage.getItem('currentDisplayTemplate');
    if (savedTemplate) {
      try {
        const templateData = JSON.parse(savedTemplate);
        setTemplateInfo(templateData);
      } catch (error) {
        console.error('Failed to parse template data:', error);
      }
    }
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  const handleExit = () => {
    window.close();
  };

  const handleClearQueue = async () => {
    try {
      const response = await fetch('/api/queue-clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Queue cleared successfully:', result);
        // You could add a visual feedback here if desired
      } else {
        console.error('Failed to clear queue:', response.statusText);
      }
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  };

  // Handle escape key to exit
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      // reset hide-timer
      clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    hideTimeout.current = setTimeout(() => setShowControls(false), 3000);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimeout.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          handleExit();
        }
      }
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(!showDebug);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showDebug]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="fullscreen-display">
      {showControls && (
      <div className="fullscreen-display__controls">
        <button 
          className="control-btn"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
        >
          ⛶
        </button>
        <button 
          className="control-btn"
          onClick={() => setShowDebug(!showDebug)}
          title="Toggle Debug Info (or press D)"
        >
          🐛
        </button>
        <button 
          className="control-btn"
          onClick={handleClearQueue}
          title="Clear Runner Queue"
        >
          🗑️
        </button>
        <button 
          className="control-btn exit-btn"
          onClick={handleExit}
          title="Exit Display Mode"
        >
          ✕
        </button>
      </div>
      )}
      {showDebug && templateInfo && (
        <div className="debug-overlay">
          <h3>Template Debug Info</h3>
          <p><strong>Original Canvas:</strong> {templateInfo.canvasWidth} x {templateInfo.canvasHeight}</p>
          <p><strong>Screen Dimensions:</strong> {window.innerWidth} x {window.innerHeight}</p>
          <p><strong>Scale X:</strong> {(window.innerWidth / templateInfo.canvasWidth).toFixed(3)}</p>
          <p><strong>Scale Y:</strong> {(window.innerHeight / templateInfo.canvasHeight).toFixed(3)}</p>
          <p><strong>HTML Length:</strong> {templateInfo.html?.length || 0} chars</p>
          <p><strong>CSS Length:</strong> {templateInfo.css?.length || 0} chars</p>
          <p><strong>Timestamp:</strong> {new Date(templateInfo.timestamp).toLocaleString()}</p>
          <p><strong>Background Styles:</strong> {templateInfo.backgroundStyles ? Object.keys(templateInfo.backgroundStyles).join(', ') : 'None'}</p>
          <p><strong>Layout Check:</strong> {templateInfo.html?.includes('layout-root') ? '✅ Structure OK' : '❌ Missing layout-root'}</p>
          <p><strong>Scaling Mode:</strong> 🖥️ Fullscreen Fill</p>
          <details>
            <summary>HTML Preview</summary>
            <pre>{templateInfo.html?.substring(0, 500)}...</pre>
          </details>
          <details>
            <summary>CSS Preview</summary>
            <pre>{templateInfo.css?.substring(0, 300)}...</pre>
          </details>
        </div>
      )}
      
      <RunnerDisplayPage />
    </div>
  );
} 