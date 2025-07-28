/* ──────────────────────────────────────────────────────────────
   templateUtils.js
   ------------------------------------------------------------------
   CRUD helpers for templates.
   All functions are pure (no direct React / DOM usage).
   The caller supplies an initialised `editor` instance and handles
   any UI / state updates.
   ------------------------------------------------------------------ */

import { forceAnimationAttributeSync } from '../../utils/animationSync';
import { log } from '../../utils/logger';

/* Small helper – walk every component in the canvas */
const walkComponents = (editor, cb) =>
  editor.getWrapper().find('*').forEach(cb);

/* Helper function to bake CSS styles into HTML as inline styles */
const bakeInlineStyles = (html, css) => {
  try {
    // Create a temporary container to work with the HTML
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = html;
    
    // Parse CSS rules to extract component-specific styles
    const cssRules = parseCSSRulesFromString(css);
    
    // Apply CSS rules as inline styles to preserve them
    cssRules.forEach(rule => {
      if (rule.selector && rule.styles) {
        try {
          // Find elements matching the selector
          const elements = tempContainer.querySelectorAll(rule.selector);
          elements.forEach(element => {
            // Apply each style as inline style
            Object.entries(rule.styles).forEach(([prop, value]) => {
              if (value && prop !== 'data-anim' && prop !== 'data-anim-dur' && prop !== 'data-anim-delay') {
                element.style.setProperty(prop, value, 'important');
              }
            });
          });
        } catch (e) {
          console.warn('Could not apply CSS rule:', rule.selector, e);
        }
      }
    });
    
    return tempContainer.innerHTML;
  } catch (error) {
    console.warn('Error baking inline styles:', error);
    return html; // Return original HTML if processing fails
  }
};

/* Helper function to parse CSS into rules */
const parseCSSRulesFromString = (css) => {
  const rules = [];
  
  try {
    // Simple CSS parser for our specific format
    const ruleMatches = css.match(/([^{]+)\{([^}]+)\}/g);
    
    if (ruleMatches) {
      ruleMatches.forEach(ruleText => {
        const match = ruleText.match(/([^{]+)\{([^}]+)\}/);
        if (match && match.length >= 3) {
          const selector = match[1].trim();
          const styleText = match[2].trim();
          
          const styles = {};
          const styleDeclarations = styleText.split(';').filter(d => d.trim());
          
          styleDeclarations.forEach(declaration => {
            const colonIndex = declaration.indexOf(':');
            if (colonIndex > 0) {
              const prop = declaration.substring(0, colonIndex).trim();
              const value = declaration.substring(colonIndex + 1).trim().replace(/!important/g, '');
              
              if (prop && value) {
                styles[prop] = value;
              }
            }
          });
          
          if (Object.keys(styles).length > 0) {
            rules.push({ selector, styles });
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error parsing CSS rules:', error);
  }
  
  return rules;
};

/* Build a single HTML/CSS string + metadata ready to POST */
function buildTemplateBundle(editor, {
  targetWidth  = 1920,
  targetHeight = 1080,
  state = 'active', // 'active' or 'resting'
} = {}) {
  log('🔧 buildTemplateBundle: Starting template build for state:', state);
  
  // Validate editor
  if (!editor || typeof editor.getWrapper !== 'function') {
    throw new Error('Invalid editor instance');
  }
  
  // ensure anim attributes are synced before export
  try {
    walkComponents(editor, forceAnimationAttributeSync);
  } catch (error) {
    console.warn('Error syncing animation attributes:', error);
  }

  const wrapper = editor.getWrapper();
  if (!wrapper) {
    throw new Error('Editor wrapper not found');
  }
  
  const wrapperStyle = wrapper.getStyle() || {};
  const bgColor      = wrapperStyle['background-color'] || wrapperStyle.background || 'transparent';

  log('🔧 Wrapper styles:', wrapperStyle);
  log('🔧 Background color extracted:', bgColor);

  // Extract all background properties from wrapper styles
  const backgroundStyles = {};
  ['background-image', 'background-repeat', 'background-position', 'background-size', 'background-attachment'].forEach(prop => {
    if (wrapperStyle[prop]) {
      backgroundStyles[prop] = wrapperStyle[prop];
      log(`🔧 Found background style: ${prop} = ${wrapperStyle[prop]}`);
    }
  });

  // Also check for background properties in different formats
  ['backgroundImage', 'backgroundRepeat', 'backgroundPosition', 'backgroundSize', 'backgroundAttachment'].forEach(prop => {
    if (wrapperStyle[prop]) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      backgroundStyles[kebabProp] = wrapperStyle[prop];
      log(`🔧 Found background style (camelCase): ${prop} = ${wrapperStyle[prop]} -> ${kebabProp}`);
    }
  });

  log('🔧 Background styles extracted:', backgroundStyles);

  // canvas dimensions stored in attributes (`data-design-w` / `h`)
  const wrapperAttrs = wrapper.getAttributes() || {};
  const {['data-design-w']: wAttr, ['data-design-h']: hAttr} = wrapperAttrs;
  const canvasWidth  = parseInt(wAttr) || targetWidth;
  const canvasHeight = parseInt(hAttr) || targetHeight;

  // complete HTML + CSS - use safe extraction methods
  let html = '';
  let css = '';
  
  try {
    // Get HTML safely
    html = editor.getHtml();
    if (typeof html !== 'string') {
      html = '';
    }
    
    // Get CSS safely
    css = editor.getCss();
    if (typeof css !== 'string') {
      css = '';
    }
    
    log('🔧 Raw HTML length:', html.length);
    log('🔧 Raw CSS length:', css.length);
    
    // IMPORTANT: Bake CSS styles into HTML as inline styles for positioning preservation
    if (html && css) {
      log('🔧 Baking CSS styles into HTML for positioning preservation...');
      html = bakeInlineStyles(html, css);
      log('🔧 Processed HTML length after inline style baking:', html.length);
    }
    
    // Walk through all components and collect their styles
    const componentStylesArray = [];
    const componentAttributes = [];
    const processedComponents = new Set(); // Track processed components to prevent duplication
    const fontSizes = new Map(); // Track font sizes for global CSS
    
    walkComponents(editor, (component) => {
      const componentId = component.getId();
      const componentType = component.get('type');
      
      // Skip if we've already processed this component
      if (processedComponents.has(componentId)) {
        log(`🔧 Skipping already processed component ${componentId}`);
        return;
      }
      
      // Skip layout components that shouldn't have their styles saved
      // These are typically wrapper components that shouldn't affect content styling
      const layoutComponentIds = ['i3dj', 'i1s7', 'i27k', 'igi7', 'i204', 'icmg'];
      const isLayoutComponent = componentType === '' || 
                               layoutComponentIds.includes(componentId) ||
                               component.getClasses().includes('layout-root') ||
                               component.getClasses().includes('safe-zone-overlay');
      
      if (isLayoutComponent) {
        log(`🔧 Skipping layout component ${componentId} (${componentType})`);
        processedComponents.add(componentId);
        return;
      }
      
      // Skip components without meaningful content
      if (!component.getStyle() || Object.keys(component.getStyle()).length === 0) {
        log(`🔧 Skipping component ${componentId} (${componentType}) - no styles`);
        processedComponents.add(componentId);
        return;
      }
      
      // Mark this component as processed
      processedComponents.add(componentId);
      
      // Get styles from different sources in GrapesJS
      const componentStyles = component.getStyle();
      const componentAttrs = component.getAttributes();
      const componentClasses = component.getClasses();
      const componentTraits = component.get('traits');
      
      // Also try to get styles from the component's view element
      let elementStyles = {};
      if (component.view && component.view.el) {
        const computedStyle = window.getComputedStyle(component.view.el);
        elementStyles = {
          'font-size': computedStyle.fontSize,
          'color': computedStyle.color,
          'background-color': computedStyle.backgroundColor,
          'width': computedStyle.width,
          'height': computedStyle.height,
          'position': computedStyle.position,
          'left': computedStyle.left,
          'top': computedStyle.top
        };
      }
      
      log(`🔧 Component ${componentId} (${componentType}):`, {
        styles: componentStyles,
        attributes: componentAttrs,
        classes: componentClasses,
        traits: componentTraits,
        elementStyles: elementStyles
      });
      
      // Generate CSS for this component - use both component styles and element styles
      const allStyles = { ...componentStyles, ...elementStyles };
      if (allStyles && Object.keys(allStyles).length > 0) {
        // Use specific ID-based selectors for complete component isolation
        // This ensures each component's styles are completely independent
        const idSelector = `[id="${componentId}"]`;
        const spanSelector = `[id="${componentId}"] span`;
        
        let componentCSS = '';
        
        // Create specific CSS for the component element itself
        let hasValidStyles = false;
        let elementRules = `${idSelector} {\n`;
        let spanRules = `${spanSelector} {\n`;
        
        Object.entries(allStyles).forEach(([prop, value]) => {
          // Skip animation properties - they should be HTML attributes, not CSS
          if (prop.startsWith('data-anim')) {
            return;
          }
          
          if (value !== undefined && value !== null && value !== '' && value !== 'auto' && value !== 'normal') {
            // Convert CSS property names from camelCase to kebab-case
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            
            // Add to both element and span rules for maximum compatibility
            elementRules += `  ${cssProp}: ${value} !important;\n`;
            spanRules += `  ${cssProp}: ${value} !important;\n`;
            hasValidStyles = true;
            
            // Track font sizes for individual component CSS
            if (cssProp === 'font-size') {
              fontSizes.set(componentId, value);
            }
          }
        });
        
        if (hasValidStyles) {
          elementRules += `}\n`;
          spanRules += `}\n`;
          componentCSS = elementRules + spanRules;
          componentStylesArray.push(componentCSS);
          
          log(`🔧 Generated isolated CSS for ${componentId}:`, componentCSS);
        }
      }
      
      // Store component attributes for later processing
      if (componentAttrs && Object.keys(componentAttrs).length > 0) {
        componentAttributes.push({
          id: componentId,
          type: componentType,
          attributes: componentAttrs
        });
      }
      
      // Also check if animation data is in styles and add to attributes
      const animationAttrs = {};
      if (componentStyles) {
        if (componentStyles['data-anim']) {
          animationAttrs['data-anim'] = componentStyles['data-anim'];
        }
        if (componentStyles['data-anim-dur']) {
          animationAttrs['data-anim-dur'] = componentStyles['data-anim-dur'];
        }
        if (componentStyles['data-anim-delay']) {
          animationAttrs['data-anim-delay'] = componentStyles['data-anim-delay'];
        }
      }
      
      // If we found animation data in styles, add it to attributes
      if (Object.keys(animationAttrs).length > 0) {
        const existingAttrIndex = componentAttributes.findIndex(attr => attr.id === componentId);
        if (existingAttrIndex >= 0) {
          componentAttributes[existingAttrIndex].attributes = {
            ...componentAttributes[existingAttrIndex].attributes,
            ...animationAttrs
          };
        } else {
          componentAttributes.push({
            id: componentId,
            type: componentType,
            attributes: animationAttrs
          });
        }
        log(`🔧 Added animation attributes for ${componentId}:`, animationAttrs);
      }
    });
    
    // Add component styles to CSS
    if (componentStylesArray.length > 0) {
      // Deduplicate CSS rules to prevent conflicts
      const uniqueCSS = [...new Set(componentStylesArray)];
      css += '\n/* Component styles */\n' + uniqueCSS.join('\n');
      log(`🔧 Added ${uniqueCSS.length} unique CSS rules (filtered from ${componentStylesArray.length} total)`);
    }
    
    // Add individual component font-size rules (no global bleeding)
    // Each component gets its own specific CSS rule to prevent style bleeding
    if (fontSizes.size > 0) {
      let individualFontCSS = '\n/* Individual component font-size rules */\n';
      fontSizes.forEach((fontSize, componentId) => {
        // Create component-specific CSS that doesn't affect other components
        // Use multiple selectors for maximum compatibility and isolation
        individualFontCSS += `
/* Font styles for component ${componentId} */
[id="${componentId}"] {
  font-size: ${fontSize} !important;
}

[id="${componentId}"] span {
  font-size: ${fontSize} !important;
}

[id="${componentId}"][data-placeholder] {
  font-size: ${fontSize} !important;
}

/* Additional selectors for maximum component isolation */
span[id="${componentId}"] {
  font-size: ${fontSize} !important;
}

[data-block-type][id="${componentId}"] {
  font-size: ${fontSize} !important;
}
`;
      });
      
      css += individualFontCSS;
      log(`🔧 Added individual font-size CSS for ${fontSizes.size} components`);
    }
    
    // Note: Animation data is now handled as HTML attributes, not CSS properties
    log('🔧 Final CSS length:', css.length);
    log('🔧 Animation data will be applied as HTML attributes');
    
  } catch (error) {
    console.warn('Error extracting HTML/CSS from editor:', error);
    html = '';
    css = '';
  }

  /* inject background + dimension attributes on layout-root */
  let processedHtml = html;
  try {
    log('🔧 Processing HTML with background styles:', backgroundStyles);
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const layoutRoot = temp.querySelector('.layout-root');
    if (layoutRoot) {
      layoutRoot.style.backgroundColor = bgColor;
      // Apply all background styles to layout root
      Object.entries(backgroundStyles).forEach(([prop, value]) => {
        layoutRoot.style[prop] = value;
        log(`🔧 Applied background style to layout root: ${prop} = ${value}`);
      });
      layoutRoot.setAttribute('data-design-w', canvasWidth);
      layoutRoot.setAttribute('data-design-h', canvasHeight);
    }
    
    // Ensure component styles and attributes are applied to HTML elements
    log('🔧 Processing component attributes:', componentAttributes.length, 'components');
    
    componentAttributes.forEach(({ id, type, attributes }) => {
      const element = temp.querySelector(`[id="${id}"]`);
      if (element) {
        log(`🔧 Processing element ${id}:`, { attributes });
        
        // Apply all attributes to the element
        if (attributes && Object.keys(attributes).length > 0) {
          Object.entries(attributes).forEach(([prop, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              if (prop.startsWith('data-')) {
                // Handle data attributes
                const stringValue = typeof value === 'object' ? value.toString() : String(value);
                element.setAttribute(prop, stringValue);
                log(`🔧 Applied data attribute to ${id}: ${prop} = ${stringValue}`);
              } else if (prop === 'class') {
                // Handle class attributes
                const classValue = typeof value === 'object' ? value.toString() : String(value);
                element.className = classValue;
                log(`🔧 Applied class to ${id}: ${classValue}`);
              } else {
                // Handle other attributes
                const stringValue = typeof value === 'object' ? value.toString() : String(value);
                element.setAttribute(prop, stringValue);
                log(`🔧 Applied attribute to ${id}: ${prop} = ${stringValue}`);
              }
            }
          });
        }
      }
    });

    // --- FIX: Remove .gjs-block class from elements, but keep the structure ---
    temp.querySelectorAll('.gjs-block').forEach(blockDiv => {
      blockDiv.classList.remove('gjs-block');
    });

    processedHtml = temp.innerHTML;
    log('🔧 Processed HTML length:', processedHtml.length);
  } catch (error) {
    console.warn('Error processing HTML:', error);
    processedHtml = html;
  }

  // Build background CSS for layout-root
  const backgroundCSS = Object.entries(backgroundStyles)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  const full = `
    <style>
      @import url('https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css');
      .layout-root {
        background-color: ${bgColor};
        width : ${canvasWidth}px;
        height: ${canvasHeight}px;
${backgroundCSS ? '\n' + backgroundCSS : ''}
      }
      ${css}
    </style>${processedHtml}`;

  return { html: full, canvasWidth, canvasHeight, state };
}

/* Build a complete template with both active and resting states */
function buildCompleteTemplate(editor, {
  targetWidth = 1920,
  targetHeight = 1080,
  activeState = null,
  restingState = null,
} = {}) {
  // Only build new states if they don't exist
  const active = activeState || buildTemplateBundle(editor, { targetWidth, targetHeight, state: 'active' });
  const resting = restingState || buildTemplateBundle(editor, { targetWidth, targetHeight, state: 'resting' });
  
  // Ensure we have both states
  if (!active || !resting) {
    throw new Error('Both active and resting states are required');
  }
  
  return {
    activeState: active,
    restingState: resting,
    canvasWidth: active.canvasWidth,
    canvasHeight: active.canvasHeight,
  };
}

/* ───────────── CRUD wrappers ───────────── */

/** GET /api/templates → [string] */
async function fetchTemplates() {
  const res  = await fetch('/api/templates');
  if (!res.ok) throw new Error('Failed to fetch template list');
  return res.json();                    // ['welcome', 'promo', …]
}

/** GET /api/templates/:name → {html, canvasWidth, canvasHeight, activeState, restingState, …} */
async function fetchTemplate(name) {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Template "${name}" not found`);
  return res.json();
}

/** POST /api/templates (create or overwrite) */
async function saveTemplate({
  editor,
  name,
  targetWidth,
  targetHeight,
  activeState = null,
  restingState = null,
}) {
  try {
    log('💾 saveTemplate: Starting save for template:', name);
    
    // Validate inputs
    if (!editor) {
      throw new Error('Editor is not initialized');
    }
    
    if (!name || typeof name !== 'string') {
      throw new Error('Template name is required');
    }
    
    if (!targetWidth || !targetHeight) {
      throw new Error('Target dimensions are required');
    }
    
    let completeTemplate;
    
    // If both states are provided, use them directly
    if (activeState && restingState) {
      log('💾 Using provided states');
      completeTemplate = {
        activeState: activeState,
        restingState: restingState,
        canvasWidth: activeState.canvasWidth,
        canvasHeight: activeState.canvasHeight,
      };
    } else {
      log('💾 Building complete template with both states');
      // Build complete template with both states (for new templates)
      completeTemplate = buildCompleteTemplate(editor, {
        targetWidth,
        targetHeight,
        activeState,
        restingState,
      });
    }
    
    // Ensure payload is serializable
    const serializablePayload = {
      name,
      ...completeTemplate
    };
    
    log('💾 Template payload structure:', {
      name: serializablePayload.name,
      hasActiveState: !!serializablePayload.activeState,
      hasRestingState: !!serializablePayload.restingState,
      activeStateHtmlLength: serializablePayload.activeState?.html?.length || 0,
      restingStateHtmlLength: serializablePayload.restingState?.html?.length || 0,
      canvasWidth: serializablePayload.canvasWidth,
      canvasHeight: serializablePayload.canvasHeight
    });
    
    // Validate that we have valid HTML content
    if (!serializablePayload.activeState?.html || serializablePayload.activeState.html.trim() === '') {
      throw new Error('No active state content to save');
    }
    
    log('💾 Sending template to server...');
    const res = await fetch('/api/templates', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(serializablePayload),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('💾 Server error:', res.status, errorText);
      throw new Error(`Failed to save template "${name}"`);
    }
    
    const result = await res.json();
    log('💾 Template saved successfully:', result);
    return result;
  } catch (error) {
    console.error('💾 Error saving template:', error);
    throw error;
  }
}

/** DELETE /api/templates/:name */
async function deleteTemplate(name) {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete template "${name}"`);
}

/* ───────────── Display-mode helper ───────────── */

/**
 * Saves the current editor contents to localStorage so the /display
 * route can render full-screen. Returns the key used.
 */
function cacheTemplateForDisplay(editor, {
  targetWidth,
  targetHeight,
  storageKey = 'currentDisplayTemplate',
  activeState = null,
  restingState = null,
} = {}) {
  try {
    let completeTemplate;
    
    // If both states are provided, use them directly
    if (activeState && restingState) {
      completeTemplate = {
        activeState: activeState,
        restingState: restingState,
        canvasWidth: activeState.canvasWidth || targetWidth,
        canvasHeight: activeState.canvasHeight || targetHeight,
      };
    } else {
      // If only one state is provided, build the missing one
      let finalActiveState = activeState;
      let finalRestingState = restingState;
      
      if (!finalActiveState) {
        finalActiveState = buildTemplateBundle(editor, { targetWidth, targetHeight, state: 'active' });
      }
      
      if (!finalRestingState) {
        finalRestingState = buildTemplateBundle(editor, { targetWidth, targetHeight, state: 'resting' });
      }
      
      completeTemplate = {
        activeState: finalActiveState,
        restingState: finalRestingState,
        canvasWidth: finalActiveState.canvasWidth || targetWidth,
        canvasHeight: finalActiveState.canvasHeight || targetHeight,
      };
    }
    
    const serializableBundle = {
      ...completeTemplate,
      timestamp: Date.now(),
    };
    
    log('Caching template for display:', {
      hasActiveState: !!completeTemplate.activeState,
      hasRestingState: !!completeTemplate.restingState,
      activeStateHtml: completeTemplate.activeState?.html ? 'present' : 'null',
      restingStateHtml: completeTemplate.restingState?.html ? 'present' : 'null'
    });
    
    localStorage.setItem(storageKey, JSON.stringify(serializableBundle));
    return storageKey;
  } catch (error) {
    console.error('Error caching template for display:', error);
    throw error;
  }
}

export {
  buildTemplateBundle,
  buildCompleteTemplate,
  fetchTemplates,
  fetchTemplate,
  saveTemplate,
  deleteTemplate,
  cacheTemplateForDisplay
}; 