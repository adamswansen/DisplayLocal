import React, { useEffect, useRef, useState } from 'react';

export default function TemplateViewer({ className, html, css, data, canvasWidth = 800, canvasHeight = 600 }) {
  const containerRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Substitute variables in the template HTML
  const substituteVariables = (htmlContent, runnerData) => {
    if (!htmlContent) return htmlContent;
    if (!runnerData) return htmlContent;
    
    console.log('[TemplateViewer] Variable substitution:', {
      runnerData,
      runnerDataKeys: Object.keys(runnerData),
      htmlSnippet: htmlContent.substring(0, 200) + '...'
    });
    
    const variablePattern = /\{\{(\w+)\}\}/g;
    return htmlContent.replace(variablePattern, (match, variableName) => {
      const value = runnerData[variableName];
      console.log(`[TemplateViewer] Substituting ${match} with:`, value);
      return value !== undefined ? value : match;
    });
  };

  // No more block unwrapping or cleaning
  const processedHtml = substituteVariables(html, data);

  useEffect(() => {
    const savedTemplate = localStorage.getItem('currentDisplayTemplate');
    if (savedTemplate) {
      setTemplate(JSON.parse(savedTemplate));
    }
  }, []);

  // Calculate scale and position when template or container changes (but NOT when data changes)
  useEffect(() => {
    if (!template || !containerRef.current) return;
    const container = containerRef.current;
    const templateCanvasWidth = template.canvasWidth || canvasWidth;
    const templateCanvasHeight = template.canvasHeight || canvasHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Check if the HTML contains inline styles (indicating new preservation method)
    const hasInlineStyles = processedHtml && processedHtml.includes('style=');
    
    console.log('[TemplateViewer] HTML content analysis:', {
      htmlLength: processedHtml?.length || 0,
      hasInlineStyles,
      templateCanvasWidth,
      templateCanvasHeight,
      containerWidth,
      containerHeight,
      htmlSample: processedHtml?.substring(0, 500) + '...'
    });
    
    let newScale = 1;
    
    if (hasInlineStyles) {
      // For content with inline styles (new preservation method), use 1:1 scaling
      // to preserve exact positioning and sizing
      newScale = 1;
      console.log('[TemplateViewer] Using 1:1 scaling for inline-styled content');
    } else {
      // For legacy content, use the original scaling logic
      const scaleX = containerWidth / templateCanvasWidth;
      const scaleY = containerHeight / templateCanvasHeight;
      
      if (containerWidth < templateCanvasWidth) {
        newScale = scaleX;
      } else if (containerHeight < templateCanvasHeight) {
        newScale = 1;
      } else {
        newScale = 1;
      }
      console.log('[TemplateViewer] Using legacy scaling logic, scale:', newScale);
    }
    
    const scaledWidth = templateCanvasWidth * newScale;
    const scaledHeight = templateCanvasHeight * newScale;
    const newX = (containerWidth - scaledWidth) / 2;
    const newY = (containerHeight - scaledHeight) / 2;
    
    console.log('[TemplateViewer] Scale calculation:', {
      templateCanvasWidth,
      templateCanvasHeight,
      containerWidth,
      containerHeight,
      hasInlineStyles,
      newScale,
      position: { x: newX, y: newY }
    });
    
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  }, [template, canvasWidth, canvasHeight, processedHtml]);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      if (!template || !containerRef.current) return;
      const container = containerRef.current;
      const templateCanvasWidth = template.canvasWidth || canvasWidth;
      const templateCanvasHeight = template.canvasHeight || canvasHeight;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Check if the HTML contains inline styles (indicating new preservation method)
      const hasInlineStyles = processedHtml && processedHtml.includes('style=');
      
      let newScale = 1;
      
      if (hasInlineStyles) {
        // For content with inline styles (new preservation method), use 1:1 scaling
        newScale = 1;
      } else {
        // For legacy content, use the original scaling logic
        const scaleX = containerWidth / templateCanvasWidth;
        const scaleY = containerHeight / templateCanvasHeight;
        
        if (containerWidth < templateCanvasWidth) {
          newScale = scaleX;
        } else if (containerHeight < templateCanvasHeight) {
          newScale = 1;
        } else {
          newScale = 1;
        }
      }
      
      const scaledWidth = templateCanvasWidth * newScale;
      const scaledHeight = templateCanvasHeight * newScale;
      const newX = (containerWidth - scaledWidth) / 2;
      const newY = (containerHeight - scaledHeight) / 2;
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [template, canvasWidth, canvasHeight, processedHtml]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Move this check AFTER all hooks
  // if (!template) return null;

  const backgroundColor = template?.backgroundStyles?.['background-color'] || 'transparent';
  const templateCanvasWidth = template?.canvasWidth || canvasWidth;
  const templateCanvasHeight = template?.canvasHeight || canvasHeight;

  // Font size adjustment for overflowing text placeholders
  useEffect(() => {
    // Wait for DOM to update
    setTimeout(() => {
      if (!containerRef.current) return;
      // Find all text placeholders (not images)
      const nodes = containerRef.current.querySelectorAll('[data-placeholder]:not(img)');
      nodes.forEach(node => {
        // Store the original font size if not already stored
        if (!node.dataset.originalFontSize) {
          const computedStyle = window.getComputedStyle(node);
          node.dataset.originalFontSize = parseFloat(computedStyle.fontSize);
        }
        
        // Get the original font size from the template
        const originalFontSize = parseFloat(node.dataset.originalFontSize);
        let fontSize = originalFontSize;
        const minFontSize = Math.max(8, originalFontSize * 0.3); // Don't go below 30% of original size
        const step = 0.5;
        
        // Only adjust if text is overflowing AND we're not already at the minimum
        if ((node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight) && fontSize > minFontSize) {
          // Shrink font size until text fits or minFontSize is reached
          while ((node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight) && fontSize > minFontSize) {
            fontSize -= step;
            node.style.fontSize = fontSize + 'px';
          }
          
          // If still overflowing after minimum font size, allow text to wrap naturally
          // DON'T use ellipsis - let text scale and wrap as needed
          if (node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight) {
            console.log('[TemplateViewer] Text still overflowing at minimum font size, allowing natural wrap:', {
              text: node.textContent?.substring(0, 50) + '...',
              fontSize: fontSize,
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth
            });
            
            // Allow text to wrap naturally instead of truncating
            node.style.whiteSpace = 'normal';
            node.style.wordWrap = 'break-word';
            node.style.overflow = 'visible';
            node.style.textOverflow = '';
          }
        } else {
          // If not overflowing, ensure we use the original font size and clear any truncation
          node.style.fontSize = originalFontSize + 'px';
          node.style.textOverflow = '';
          node.style.overflow = 'visible';
          node.style.whiteSpace = 'normal';
        }
      });
    }, 50);
  }, [processedHtml, template, data]);

  if (!template) return null;

  return (
    <div
      ref={containerRef}
      className={className || 'template-viewer'}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: backgroundColor || 'transparent'
      }}
    >
      <div
        style={{
          position: 'absolute',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'top left',
          width: templateCanvasWidth,
          height: templateCanvasHeight,
          backgroundColor: backgroundColor || 'transparent'
        }}
        dangerouslySetInnerHTML={{
          __html: `
            <style>${css || ''}</style>
            ${processedHtml || ''}
          `
        }}
      />
    </div>
  );
}
