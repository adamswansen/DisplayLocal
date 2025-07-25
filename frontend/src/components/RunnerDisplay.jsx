import React, { useState, useEffect, useRef, useCallback } from 'react';
import TemplateViewer from './TemplateViewer';
import './RunnerDisplay.css';
import 'animate.css';

export default function RunnerDisplay({ runner, template }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayRunner, setDisplayRunner] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [processedTemplate, setProcessedTemplate] = useState(null);
  const [messageCounter, setMessageCounter] = useState(0);
  const stageRef = useRef(null);
  const [stageTransform, setStageTransform] = useState('');
  const resizeTimeoutRef = useRef(null);
  const isResizingRef = useRef(false);
  const processingRef = useRef(false);

  // Plain shrinkToFit utility with logging and !important
  const shrinkToFit = (el, minFontSize = 8, step = 0.5) => {
    if (!el) return;
    
    // Store original font size on first run
    if (!el.dataset.originalFontSize) {
      const computed = window.getComputedStyle(el);
      el.dataset.originalFontSize = parseFloat(computed.fontSize);
    }
    
    // Always start with the original user-defined font size
    const originalFontSize = parseFloat(el.dataset.originalFontSize);
    let fontSize = originalFontSize;
    
    // Set a higher minimum font size to preserve the intended design
    const adjustedMinFontSize = Math.max(minFontSize, originalFontSize * 0.5); // Don't go below 50% of original
    
    // DON'T override width - preserve the element's actual constrained width
    el.style.setProperty('white-space', 'normal', 'important');
    el.style.setProperty('font-size', fontSize + 'px', 'important');

    const getSingleLineHeight = (element, size) => {
      const clone = element.cloneNode(true);
      clone.style.visibility = 'hidden';
      clone.style.position = 'absolute';
      clone.style.height = 'auto';
      clone.style.width = element.clientWidth + 'px'; // Use the actual constrained width
      clone.style.whiteSpace = 'nowrap';
      clone.style.fontSize = size + 'px';
      element.parentNode.appendChild(clone);
      const height = clone.scrollHeight;
      clone.remove();
      return height;
    };

    let singleLineHeight = getSingleLineHeight(el, fontSize);
    console.log('[shrinkToFit] BEFORE:', {
      text: el.textContent,
      width: el.clientWidth,
      originalFontSize,
      fontSize,
      scrollHeight: el.scrollHeight,
      singleLineHeight
    });
    
    // Only shrink if text is significantly overflowing and we're not already at the minimum
    if (el.scrollHeight > singleLineHeight + 5 && fontSize > adjustedMinFontSize) {
      while (el.scrollHeight > singleLineHeight + 1 && fontSize > adjustedMinFontSize) {
        fontSize -= step;
        el.style.setProperty('font-size', fontSize + 'px', 'important');
        singleLineHeight = getSingleLineHeight(el, fontSize);
        console.log('[shrinkToFit] shrinking:', {
          fontSize,
          scrollHeight: el.scrollHeight,
          singleLineHeight
        });
      }
    } else {
      // If not significantly overflowing, keep the original font size
      fontSize = originalFontSize;
      el.style.setProperty('font-size', fontSize + 'px', 'important');
    }
    
    el.style.setProperty('white-space', 'nowrap', 'important');
    if (el.scrollHeight > singleLineHeight + 1) {
      el.style.setProperty('text-overflow', 'ellipsis', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    } else {
      el.style.setProperty('text-overflow', '', 'important');
      el.style.setProperty('overflow', '', 'important');
    }
    console.log('[shrinkToFit] AFTER:', {
      text: el.textContent,
      width: el.clientWidth,
      originalFontSize,
      finalFontSize: fontSize,
      scrollHeight: el.scrollHeight,
      singleLineHeight
    });
  };

  // Pre-process template with runner data and prepare animations
  const preprocessTemplate = useCallback((runnerData, templateData, currentMessageIndex) => {
    if (!templateData) return null;

    console.log('[RunnerDisplay] Pre-processing template:', {
      hasRunnerData: !!runnerData,
      runnerName: runnerData?.first_name || runnerData?.name,
      messageIndex: currentMessageIndex
    });
    
    // Create a temporary DOM element to process the template
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = templateData.html;
    
    // Add the template CSS to the temp div for proper sizing calculations
    const styleElement = document.createElement('style');
    styleElement.textContent = templateData.css || '';
    tempDiv.appendChild(styleElement);
    
    // Add the temp div to the document temporarily for sizing calculations
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.top = '-9999px';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '100%';
    tempDiv.style.height = '100%';
    
    // Set up proper canvas dimensions for sizing calculations
    const canvasWidth = templateData.canvasWidth || 1920;
    const canvasHeight = templateData.canvasHeight || 1080;
    tempDiv.style.width = `${canvasWidth}px`;
    tempDiv.style.height = `${canvasHeight}px`;
    
    document.body.appendChild(tempDiv);
    
    // Force a reflow to ensure CSS is applied
    tempDiv.offsetHeight;
    
    // Find and process all placeholders
    const placeholders = tempDiv.querySelectorAll('[data-placeholder]');
    
    placeholders.forEach((node) => {
      const key = node.getAttribute('data-placeholder');
      let value = runnerData ? runnerData[key] : undefined;
      
      if (key === 'custom_message') {
        const msgs = node.getAttribute('data-messages') || '';
        const messages = msgs.split(',').map(m => m.trim()).filter(m => m);
        if (messages.length) {
          // Use the passed message index instead of storing it on the DOM element
          value = messages[currentMessageIndex % messages.length];
        } else {
          value = '';
        }
      }
      
      if (value !== undefined) {
        if (node.tagName === 'IMG') {
          node.src = value;
        } else {
          node.textContent = value || '';
        }
      } else if (runnerData) {
        // If we have runner data but no value for this placeholder, clear it
        if (node.tagName === 'IMG') {
          node.src = '';
        } else {
          node.textContent = '';
        }
      }
      // If no runner data, leave placeholders as-is for resting state

      // Pre-calculate text sizing for text elements (only if we have content)
      if (node.tagName !== 'IMG' && (value !== undefined || !runnerData)) {
        const preCalculatedFontSize = preCalculateTextSize(node, 6, 0.5);
        if (preCalculatedFontSize) {
          node.style.setProperty('font-size', `${preCalculatedFontSize}px`, 'important');
          node.style.setProperty('white-space', 'nowrap', 'important');
          if (preCalculatedFontSize < parseFloat(node.dataset.originalFontSize || '16')) {
            node.style.setProperty('text-overflow', 'ellipsis', 'important');
            node.style.setProperty('overflow', 'hidden', 'important');
          }
        }
      }

      // Pre-apply animation classes and styles to the HTML
      const anim = node.getAttribute('data-anim');
      if (anim && anim.trim() !== '') {
        const duration = parseInt(node.getAttribute('data-anim-dur')) || 1000;
        const delay = parseInt(node.getAttribute('data-anim-delay')) || 0;
        
        // Sanitize the animation name to remove whitespace for CSS class compatibility
        const sanitizedAnim = anim.trim().replace(/\s+/g, '');
        
        // Add animation classes directly to the HTML
        node.classList.add('animate__animated', `animate__${sanitizedAnim}`);
        
        // Add animation styles directly to the element
        node.style.setProperty('--animate-duration', `${duration}ms`);
        node.style.setProperty('--animate-delay', `${delay}ms`);
      }
    });

    // Get the processed HTML
    const processedHtml = tempDiv.innerHTML;
    
    // Clean up the temporary element
    document.body.removeChild(tempDiv);

    // Return the processed HTML
    return processedHtml;
  }, []);

  // Pre-calculate text size without DOM manipulation
  const preCalculateTextSize = (element, minFontSize = 8, step = 0.5) => {
    if (!element) return null;
    
    // Store original font size on first run
    if (!element.dataset.originalFontSize) {
      const computed = window.getComputedStyle(element);
      element.dataset.originalFontSize = parseFloat(computed.fontSize);
    }
    
    const originalFontSize = parseFloat(element.dataset.originalFontSize);
    let fontSize = originalFontSize;
    
    // Set a higher minimum font size to preserve the intended design
    const adjustedMinFontSize = Math.max(minFontSize, originalFontSize * 0.5); // Don't go below 50% of original
    
    // Set initial font size
    element.style.setProperty('white-space', 'normal', 'important');
    element.style.setProperty('font-size', fontSize + 'px', 'important');

    // Calculate single line height
    const getSingleLineHeight = (el, size) => {
      const clone = el.cloneNode(true);
      clone.style.visibility = 'hidden';
      clone.style.position = 'absolute';
      clone.style.height = 'auto';
      clone.style.width = el.clientWidth + 'px';
      clone.style.whiteSpace = 'nowrap';
      clone.style.fontSize = size + 'px';
      el.parentNode.appendChild(clone);
      const height = clone.scrollHeight;
      clone.remove();
      return height;
    };

    let singleLineHeight = getSingleLineHeight(element, fontSize);
    
    // Only shrink if text is significantly overflowing and we're not already at the minimum
    if (element.scrollHeight > singleLineHeight + 5 && fontSize > adjustedMinFontSize) {
      // Shrink font size until text fits
      while (element.scrollHeight > singleLineHeight + 1 && fontSize > adjustedMinFontSize) {
        fontSize -= step;
        element.style.setProperty('font-size', fontSize + 'px', 'important');
        singleLineHeight = getSingleLineHeight(element, fontSize);
      }
    } else {
      // If not significantly overflowing, keep the original font size
      fontSize = originalFontSize;
      element.style.setProperty('font-size', fontSize + 'px', 'important');
    }
    
    return fontSize;
  };

  // Handle new runner data with seamless transition
  useEffect(() => {
    if (!template) return;

    console.log('[RunnerDisplay] Template or runner data changed:', {
      hasRunner: !!runner,
      runnerName: runner?.first_name || runner?.name,
      hasTemplate: !!template
    });
    
    // If we're already processing, skip this update
    if (processingRef.current) {
      console.log('[RunnerDisplay] Already processing, skipping update');
      return;
    }

    // Start processing
    processingRef.current = true;
    setIsReady(false);
    
    // If we have runner data, pre-process the template with it
    if (runner) {
      // Increment message counter for each new runner
      const newMessageIndex = messageCounter + 1;
      setMessageCounter(newMessageIndex);
      
      const processedHtml = preprocessTemplate(runner, template, newMessageIndex);
      
      if (processedHtml) {
        // Create processed template object (don't modify original)
        const newProcessedTemplate = {
          ...template,
          html: processedHtml
        };
        
        // Update the processed template
        setProcessedTemplate(newProcessedTemplate);
        setDisplayRunner(runner);
        
        // Mark as ready after a small delay to ensure DOM is ready
        setTimeout(() => {
          setIsReady(true);
          processingRef.current = false;
        }, 50);
      } else {
        processingRef.current = false;
      }
    } else {
      // No runner data - use template as-is for resting state
      console.log('[RunnerDisplay] No runner data, using template as-is for resting state');
      setProcessedTemplate(template);
      setDisplayRunner(null);
      
      // Mark as ready after a small delay to ensure DOM is ready
      setTimeout(() => {
        setIsReady(true);
        processingRef.current = false;
      }, 50);
    }
  }, [runner, template, preprocessTemplate, messageCounter]);

  // Apply text resizing to the displayed runner (only after template is ready)
  useEffect(() => {
    if (!isReady || !displayRunner || !processedTemplate) return;

    console.log('[RunnerDisplay] Template is ready for display:', displayRunner.first_name || displayRunner.name);

    // Text resizing is now handled during pre-processing, so we just need to ensure
    // the template is properly displayed. The animations and text sizing are already
    // applied in the processed HTML.
    
    // Optional: Add any additional post-display processing here if needed
    // For now, we just log that the template is ready
    console.log('[RunnerDisplay] Template ready for display with pre-processed content');
  }, [isReady, displayRunner, processedTemplate]);

  // Calculate stage transform
  const calculateStageTransform = useCallback(() => {
    const templateToUse = processedTemplate || template;
    if (!stageRef.current || !templateToUse?.html) return '';

    // Use the parent container (or window) dimensions, NOT the stage's own (which may already be scaled)
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    // Extract dimensions from template
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = templateToUse.html;
    
    // Try to find layout-root element
    const layoutRoot = tempDiv.querySelector('.layout-root');
    let designWidth = 1920;
    let designHeight = 1080;
    
    if (layoutRoot) {
      const width = parseInt(layoutRoot.getAttribute('data-design-w'));
      const height = parseInt(layoutRoot.getAttribute('data-design-h'));
      
      if (!isNaN(width) && !isNaN(height)) {
        designWidth = width;
        designHeight = height;
      }
    } else if (templateToUse.canvasWidth && templateToUse.canvasHeight) {
      designWidth = templateToUse.canvasWidth;
      designHeight = templateToUse.canvasHeight;
    }

    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = containerWidth / designWidth;
    const scaleY = containerHeight / designHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate centering position
    const translateX = (containerWidth - (designWidth * scale)) / 2;
    const translateY = (containerHeight - (designHeight * scale)) / 2;

    // Create transform string
    return `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }, [template, processedTemplate]);

  // Initial transform calculation
  useEffect(() => {
    const transform = calculateStageTransform();
    if (transform) {
      setStageTransform(transform);
    }
  }, [template, processedTemplate, calculateStageTransform]);

  // Handle window resize with freeze policy
  useEffect(() => {
    const handleResizeStart = () => {
      isResizingRef.current = true;
    };

    const handleResizeEnd = () => {
      isResizingRef.current = false;
      // Clear any pending timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      // Calculate final transform after resize ends
      const transform = calculateStageTransform();
      if (transform) {
        setStageTransform(transform);
      }
    };

    const handleResize = () => {
      // If we're already resizing, don't update
      if (isResizingRef.current) return;

      // Clear any pending timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Set a timeout to update after resize ends
      resizeTimeoutRef.current = setTimeout(() => {
        const transform = calculateStageTransform();
        if (transform) {
          setStageTransform(transform);
        }
      }, 150); // 150ms debounce
    };

    // Add resize listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('resizestart', handleResizeStart);
    window.addEventListener('resizeend', handleResizeEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resizestart', handleResizeStart);
      window.removeEventListener('resizeend', handleResizeEnd);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [calculateStageTransform]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Recalculate transform after fullscreen change
      const transform = calculateStageTransform();
      if (transform) {
        setStageTransform(transform);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [calculateStageTransform]);

  return (
    <div className={`runner-display-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <div 
        ref={stageRef}
        className={`runner-stage ${!isReady ? 'processing' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000',
          transform: stageTransform,
          transformOrigin: 'top left',
          willChange: 'transform',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
      >
        {(() => {
          // Use processed template if available, otherwise fall back to original
          const templateToUse = processedTemplate || template;
          if (!templateToUse?.html) return null;
          
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = templateToUse.html;
          const layoutRoot = tempDiv.querySelector('.layout-root');
          
          let canvasWidth = 1920;
          let canvasHeight = 1080;
          
          if (layoutRoot) {
            const width = parseInt(layoutRoot.getAttribute('data-design-w'));
            const height = parseInt(layoutRoot.getAttribute('data-design-h'));
            
            if (!isNaN(width) && !isNaN(height)) {
              canvasWidth = width;
              canvasHeight = height;
            }
          } else if (templateToUse.canvasWidth && templateToUse.canvasHeight) {
            canvasWidth = templateToUse.canvasWidth;
            canvasHeight = templateToUse.canvasHeight;
          }
          
          return (
            <TemplateViewer
              className="runner-template"
              html={templateToUse.html}
              css={templateToUse.css}
              data={displayRunner}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
          );
        })()}
      </div>
    </div>
  );
}
