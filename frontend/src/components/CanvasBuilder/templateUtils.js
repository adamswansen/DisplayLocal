/* ──────────────────────────────────────────────────────────────
   templateUtils.js
   ------------------------------------------------------------------
   CRUD helpers for templates.
   All functions are pure (no direct React / DOM usage).
   The caller supplies an initialised `editor` instance and handles
   any UI / state updates.
   ------------------------------------------------------------------ */

import { forceAnimationAttributeSync } from '../../utils/animationSync';

/* Small helper – walk every component in the canvas */
const walkComponents = (editor, cb) =>
  editor.getWrapper().find('*').forEach(cb);

/* Build a single HTML/CSS string + metadata ready to POST */
function buildTemplateBundle(editor, {
  targetWidth  = 1920,
  targetHeight = 1080,
  state = 'active', // 'active' or 'resting'
} = {}) {
  console.log('🔧 buildTemplateBundle: Starting template build for state:', state);
  
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

  console.log('🔧 Wrapper styles:', wrapperStyle);
  console.log('🔧 Background color extracted:', bgColor);

  // Extract all background properties from wrapper styles
  const backgroundStyles = {};
  ['background-image', 'background-repeat', 'background-position', 'background-size', 'background-attachment'].forEach(prop => {
    if (wrapperStyle[prop]) {
      backgroundStyles[prop] = wrapperStyle[prop];
      console.log(`🔧 Found background style: ${prop} = ${wrapperStyle[prop]}`);
    }
  });

  // Also check for background properties in different formats
  ['backgroundImage', 'backgroundRepeat', 'backgroundPosition', 'backgroundSize', 'backgroundAttachment'].forEach(prop => {
    if (wrapperStyle[prop]) {
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      backgroundStyles[kebabProp] = wrapperStyle[prop];
      console.log(`🔧 Found background style (camelCase): ${prop} = ${wrapperStyle[prop]} -> ${kebabProp}`);
    }
  });

  console.log('🔧 Background styles extracted:', backgroundStyles);

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
    
    console.log('🔧 Raw HTML length:', html.length);
    console.log('🔧 Raw CSS length:', css.length);
    
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
        console.log(`🔧 Skipping already processed component ${componentId}`);
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
        console.log(`🔧 Skipping layout component ${componentId} (${componentType})`);
        processedComponents.add(componentId);
        return;
      }
      
      // Skip components without meaningful content
      if (!component.getStyle() || Object.keys(component.getStyle()).length === 0) {
        console.log(`🔧 Skipping component ${componentId} (${componentType}) - no styles`);
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
      
      console.log(`🔧 Component ${componentId} (${componentType}):`, {
        styles: componentStyles,
        attributes: componentAttrs,
        classes: componentClasses,
        traits: componentTraits,
        elementStyles: elementStyles
      });
      
      // Generate CSS for this component - use both component styles and element styles
      const allStyles = { ...componentStyles, ...elementStyles };
      if (allStyles && Object.keys(allStyles).length > 0) {
        // Use class-based selectors instead of ID-based selectors for better compatibility
        // This ensures the CSS works in the display even if IDs change
        const selector = `[data-gjs-type="${componentType}"][id="${componentId}"]`;
        const classSelector = `.gjs-block[data-placeholder]`; // More generic selector for text blocks
        
        let componentCSS = `${selector} {\n`;
        let classCSS = '';
        
        Object.entries(allStyles).forEach(([prop, value]) => {
          // Skip animation properties - they should be HTML attributes, not CSS
          if (prop.startsWith('data-anim')) {
            return;
          }
          
          if (value !== undefined && value !== null && value !== '' && value !== 'auto' && value !== 'normal') {
            // Convert CSS property names from camelCase to kebab-case
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            componentCSS += `  ${cssProp}: ${value};\n`;
            
            // Track font sizes for global CSS
            if (cssProp === 'font-size') {
              fontSizes.set(componentId, value);
            }
          }
        });
        
        componentCSS += `}\n`;
        componentStylesArray.push(componentCSS);
        
        console.log(`🔧 Generated CSS for ${componentId}:`, componentCSS);
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
        console.log(`🔧 Added animation attributes for ${componentId}:`, animationAttrs);
      }
    });
    
    // Add component styles to CSS
    if (componentStylesArray.length > 0) {
      // Deduplicate CSS rules to prevent conflicts
      const uniqueCSS = [...new Set(componentStylesArray)];
      css += '\n/* Component styles */\n' + uniqueCSS.join('\n');
      console.log(`🔧 Added ${uniqueCSS.length} unique CSS rules (filtered from ${componentStylesArray.length} total)`);
    }
    
    // Add global font-size rules for better display compatibility
    // This ensures font sizes are applied even if specific selectors don't match
    if (fontSizes.size > 0) {
      const globalFontSizeCSS = `
/* Global font-size rules for display compatibility - HIGH SPECIFICITY */
body .gjs-block[data-placeholder] {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
  color: white !important;
}

body [data-placeholder] {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
}

/* Ensure text blocks have proper font sizing */
body span[data-placeholder] {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
}

/* Fallback for any text elements with high specificity */
body .gjs-block span {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
}

/* Override any layout component font sizes */
body [data-gjs-type="default"] span,
body [data-gjs-type="text"] span {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
}

/* Ensure placeholder text has correct font size */
body [data-placeholder="name"],
body [data-placeholder="message"] {
  font-size: ${Array.from(fontSizes.values())[0]} !important;
}
`;
      
      css += globalFontSizeCSS;
      console.log(`🔧 Added global font-size CSS with size: ${Array.from(fontSizes.values())[0]}`);
    }
    
    // Note: Animation data is now handled as HTML attributes, not CSS properties
    console.log('🔧 Final CSS length:', css.length);
    console.log('🔧 Animation data will be applied as HTML attributes');
    
  } catch (error) {
    console.warn('Error extracting HTML/CSS from editor:', error);
    html = '';
    css = '';
  }

  /* inject background + dimension attributes on layout-root */
  let processedHtml = html;
  try {
    console.log('🔧 Processing HTML with background styles:', backgroundStyles);
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const layoutRoot = temp.querySelector('.layout-root');
    if (layoutRoot) {
      layoutRoot.style.backgroundColor = bgColor;
      // Apply all background styles to layout root
      Object.entries(backgroundStyles).forEach(([prop, value]) => {
        layoutRoot.style[prop] = value;
        console.log(`🔧 Applied background style to layout root: ${prop} = ${value}`);
      });
      layoutRoot.setAttribute('data-design-w', canvasWidth);
      layoutRoot.setAttribute('data-design-h', canvasHeight);
    }
    
    // Ensure component styles and attributes are applied to HTML elements
    console.log('🔧 Processing component attributes:', componentAttributes.length, 'components');
    
    componentAttributes.forEach(({ id, type, attributes }) => {
      const element = temp.querySelector(`[id="${id}"]`);
      if (element) {
        console.log(`🔧 Processing element ${id}:`, { attributes });
        
        // Apply all attributes to the element
        if (attributes && Object.keys(attributes).length > 0) {
          Object.entries(attributes).forEach(([prop, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              if (prop.startsWith('data-')) {
                // Handle data attributes
                const stringValue = typeof value === 'object' ? value.toString() : String(value);
                element.setAttribute(prop, stringValue);
                console.log(`🔧 Applied data attribute to ${id}: ${prop} = ${stringValue}`);
              } else if (prop === 'class') {
                // Handle class attributes
                const classValue = typeof value === 'object' ? value.toString() : String(value);
                element.className = classValue;
                console.log(`🔧 Applied class to ${id}: ${classValue}`);
              } else {
                // Handle other attributes
                const stringValue = typeof value === 'object' ? value.toString() : String(value);
                element.setAttribute(prop, stringValue);
                console.log(`🔧 Applied attribute to ${id}: ${prop} = ${stringValue}`);
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
    console.log('🔧 Processed HTML length:', processedHtml.length);
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
    console.log('💾 saveTemplate: Starting save for template:', name);
    
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
      console.log('💾 Using provided states');
      completeTemplate = {
        activeState: activeState,
        restingState: restingState,
        canvasWidth: activeState.canvasWidth,
        canvasHeight: activeState.canvasHeight,
      };
    } else {
      console.log('💾 Building complete template with both states');
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
    
    console.log('💾 Template payload structure:', {
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
    
    console.log('💾 Sending template to server...');
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
    console.log('💾 Template saved successfully:', result);
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
    
    console.log('Caching template for display:', {
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