/* ──────────────────────────────────────────────────────────────
   CanvasBuilder.jsx
   ------------------------------------------------------------------
   High-level container that hosts the GrapesJS designer plus the
   Dimension-wizard, Zoom controls, template CRUD, crop-modal and
   message-manager.  All logic that doesn't have to be here (snap, clamp, commands, blocks, etc.) is
   delegated to helper modules.
   ------------------------------------------------------------------ */

   import {
    React,
    useEffect,
    useRef,
    useState,
    useCallback,
    useNavigate,
  } from './CanvasBuilder.imports';
  
  /* components */
  import ImageCropModal from '../ImageCropModal';
  import MessageManager from '../MessageManager';
  
  /* hooks */
  import { useDimensionWizard }       from '../../hooks/useDimensionWizard';
  import { useGrapesEditor }          from '../../hooks/useGrapesEditor';
  import { useZoom }                  from '../../hooks/useZoom';
  
  /* utils / services */
  import {
    fetchTemplates,
    fetchTemplate,
    saveTemplate,
    deleteTemplate,
    cacheTemplateForDisplay,
    buildTemplateBundle,
  }                                   from './templateUtils';
  import { DIMENSION_PRESETS }        from '../../utils/constants';
  import { fetchUserImages }          from '../../utils/imageService';
  import { generateImageBlocks }      from '../../grapes/blocks';
  import { log }                      from '../../utils/logger';
  
  /* ────────────────────────────────────────────────────────────── */
  
export default function CanvasBuilder() {
  // console.log('CanvasBuilder: Component starting to render');
      /* ────────── refs & router ────────── */
      const navigate                = useNavigate();   // reserved if you want to push instead of window.open
      const templateSelectRef       = useRef(null);
  
      // console.log('CanvasBuilder: Hooks initialized');
  
      /* ────────── template list UI state ────────── */
      const [templates, setTemplates] = useState([]);
      const [currentName,   setCurrentName] = useState(null);
      const [msgMgrOpen,    setMsgMgrOpen]  = useState(false);
      const [canvasInitialized, setCanvasInitialized] = useState(false);
      
      // console.log('CanvasBuilder: State initialized');
      
      /* ────────── State management ────────── */
      const [currentState, setCurrentState] = useState('active'); // 'active' or 'resting'
      const [activeStateData, setActiveStateData] = useState(null);
      const [restingStateData, setRestingStateData] = useState(null);
      
      // console.log('CanvasBuilder: State management initialized');
      
      /* ────────── GrapesJS wrapper hook ────────── */
      const {
        editorRef,           // live GrapesJS instance
        cropData,
        setCropData,
        showCrop,
        userImages,
        imagesLoaded,
      } = useGrapesEditor({
        targetWidth: 1920,  // default values
        targetHeight: 1080, // will be updated by dimension wizard
        onImagesRefreshed: () => {
          // console.log('Images refreshed automatically');
        }
      });
  
      // console.log('CanvasBuilder: useGrapesEditor hook initialized');
  
      /* ────────── Zoom hook (pure UI) ────────── */
      const { zoom, zoomIn, zoomOut, setZoom, getCurrentZoom } = useZoom(editorRef);
  
      // console.log('CanvasBuilder: useZoom hook initialized');
  
      /* ────────── Dimension wizard hook ────────── */
      const {
        /* state */
        showWizard,
        targetWidth,
        targetHeight,
    
        /* mutators / actions */
        openWizard,
        closeWizard,
        selectPreset,
        confirmDimensions,      // creates a fresh canvas of targetWidth/Height
        setTargetWidth,
        setTargetHeight,
        centerAndZoomCanvas,    // Auto-zoom and center function
      } = useDimensionWizard({ 
        editorRef: editorRef,
        templateSelectorRef: templateSelectRef,
        setCanvasInitialized,
        setCurrentTemplateName: setCurrentName,
        setZoom: setZoom
      });
  
      // console.log('CanvasBuilder: useDimensionWizard hook initialized');
  
      /* ────────── Optimistic display-duration UI ────────── */
      const [displayDuration, setDisplayDuration] = useState(5);
      const [localDuration,   setLocalDuration]   = useState(5);
      const durationTimeoutRef = useRef(null);
    
      const handleDurationChange = (val) => {
        setLocalDuration(val);
        localStorage.setItem('displayDuration', val.toString());
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
            // console.log('Queue cleared successfully:', result);
            // You could add a toast notification here if desired
          } else {
            // console.error('Failed to clear queue:', response.statusText);
          }
        } catch (error) {
          // console.error('Error clearing queue:', error);
        }
      };
    
      useEffect(() => () => window.clearTimeout(durationTimeoutRef.current), []);
    
      /* ────────── template list helpers ────────── */
      const refreshTemplates = () =>
        fetchTemplates().then((templateList) => {
          // Ensure unique template names to prevent React key warnings
          const uniqueTemplates = [...new Set(templateList)];
          setTemplates(uniqueTemplates);
        }).catch(console.error);
    
      useEffect(() => {
        refreshTemplates();
      }, []);
    
      /* ────────── Animation restoration utility ────────── */
      const restoreAnimationAttributes = (editor) => {
        try {
          // console.log('🔄 restoreAnimationAttributes: Starting animation restoration');
          
          // Walk through all components and restore animation attributes
          const walkComponents = (editor, cb) =>
            editor.getWrapper().find('*').forEach(cb);

          let processedComponents = 0;
          let fixedComponents = 0;

          walkComponents(editor, (component) => {
            processedComponents++;
            const attrs = component.getAttributes();
            const animType = attrs['data-anim'];
            const duration = attrs['data-anim-dur'];
            const delay = attrs['data-anim-delay'];
            
            // console.log(`🔄 Component ${component.getId()}:`, {
            //   animType,
            //   duration,
            //   delay,
            //   hasObjectValues: animType === '[object Object]' || duration === '[object Object]' || delay === '[object Object]'
            // });
            
            // If we have animation data, ensure it's properly set
            if (animType && animType.trim() !== '' && animType !== '[object Object]') {
              // Convert any object values to strings
              const animTypeValue = typeof animType === 'object' ? animType.toString() : String(animType);
              const durationValue = duration !== undefined && duration !== null && duration !== '' && duration !== '[object Object]' 
                ? (typeof duration === 'object' ? duration.toString() : String(duration))
                : '1000';
              const delayValue = delay !== undefined && delay !== null && delay !== '' && delay !== '[object Object]'
                ? (typeof delay === 'object' ? delay.toString() : String(delay))
                : '0';
              
              // Update the component's attributes with clean values
              component.addAttributes({
                'data-anim': animTypeValue,
                'data-anim-dur': durationValue,
                'data-anim-delay': delayValue
              });
              
              // Also set as CSS styles for consistency
              component.addStyle({
                'data-anim': animTypeValue,
                'data-anim-dur': durationValue,
                'data-anim-delay': delayValue
              });
              
              fixedComponents++;
              // console.log(`🔄 Fixed component ${component.getId()}:`, {
              //   animType: animTypeValue,
              //   duration: durationValue,
              //   delay: delayValue
              // });
            }
          });
          
          // console.log(`🔄 Animation restoration complete: ${processedComponents} components processed, ${fixedComponents} components fixed`);
        } catch (error) {
          // console.warn('🔄 Error restoring animation attributes:', error);
        }
      };
    
      /* ────────── State switching functions ────────── */
      const saveCurrentState = async () => {
        if (!editorRef.current) return null;
        
        try {
          console.log(`💾 Saving current ${currentState} state before switching`);
          
          // Clear any active selections before saving to avoid state contamination
          editorRef.current.select(null);
          
          // Force sync any pending changes before saving
          editorRef.current.trigger('component:update');
          editorRef.current.trigger('style:update');
          
          // Ensure all components have finalized their states
          const allComponents = editorRef.current.getWrapper().find('*');
          allComponents.forEach(component => {
            try {
              // Make sure component styles are finalized
              if (component.view && component.view.el) {
                component.view.updateStyle();
              }
              
              // Ensure component attributes are current
              component.trigger('change:attributes');
              component.trigger('change:style');
              
            } catch (e) {
              console.warn(`Could not finalize component ${component.getId()}:`, e);
            }
          });
          
          // Wait for all operations to complete
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const stateData = buildTemplateBundle(editorRef.current, {
            targetWidth,
            targetHeight,
            state: currentState,
          });
          
          console.log('💾 State data saved:', {
            state: currentState,
            htmlLength: stateData.html?.length || 0,
            canvasWidth: stateData.canvasWidth,
            canvasHeight: stateData.canvasHeight,
            componentCount: allComponents.length
          });
          
          return stateData;
        } catch (error) {
          console.error('💾 Error saving current state:', error);
          return null;
        }
      };

      const clearEditorCompletely = async () => {
        if (!editorRef.current) {
          console.log('🧹 No editor reference, skipping clear');
          return;
        }
        
        console.log('🧹 Clearing editor completely');
        
        try {
          // 1. Clear selection first
          try {
            const selected = editorRef.current.getSelected();
            if (selected) {
              editorRef.current.select(null);
            }
          } catch (e) {
            console.warn('Could not clear selection:', e);
          }
          
          // 2. Clear CSS rules first (most important)
          try {
            if (editorRef.current.CssComposer) {
              editorRef.current.CssComposer.clear();
            }
          } catch (e) {
            console.warn('Could not clear CSS composer:', e);
          }
          
          // 3. Clear all CSS 
          try {
            editorRef.current.setStyle('');
          } catch (e) {
            console.warn('Could not clear styles:', e);
          }
          
          // 4. Clear all components
          try {
            editorRef.current.setComponents('');
          } catch (e) {
            console.warn('Could not clear components:', e);
          }
          
          // 5. Reset wrapper to clean state
          try {
            const wrapper = editorRef.current.getWrapper();
            if (wrapper) {
              wrapper.set('style', {});
              wrapper.set('attributes', {});
            }
          } catch (e) {
            console.warn('Could not reset wrapper:', e);
          }
          
          // 6. Clear undo/redo history
          try {
            if (editorRef.current.UndoManager) {
              editorRef.current.UndoManager.clear();
            }
          } catch (e) {
            console.warn('Could not clear undo manager:', e);
          }
          
          // 7. Clear any device manager state
          try {
            if (editorRef.current.DeviceManager) {
              editorRef.current.DeviceManager.select('desktop');
            }
          } catch (e) {
            console.warn('Could not reset device manager:', e);
          }
          
          // 8. Force complete refresh and trigger updates
          try {
            editorRef.current.trigger('component:update');
            editorRef.current.trigger('style:update');
            editorRef.current.refresh();
          } catch (e) {
            console.warn('Could not trigger updates:', e);
          }
          
          // Wait for clearing to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('🧹 Editor cleared successfully');
          
        } catch (error) {
          console.error('🧹 Error during editor clearing:', error);
          // Even if clearing fails, we should continue with the state switch
        }
      };

      const loadStateContent = async (stateData, stateName) => {
        if (!editorRef.current || !stateData) return;
        
        console.log(`📥 Loading ${stateName} state content`);
        
        // Parse the HTML and CSS
        const holder = document.createElement('div');
        holder.innerHTML = stateData.html || '';
        const styleTag = holder.querySelector('style');
        const css = styleTag ? styleTag.innerHTML : '';
        if (styleTag) styleTag.remove();
        
        console.log(`📥 Content parsed:`, {
          htmlLength: holder.innerHTML.length,
          cssLength: css.length,
          canvasWidth: stateData.canvasWidth,
          canvasHeight: stateData.canvasHeight
        });
        
        try {
          // Step 1: Process HTML to bake styles into inline styles for component preservation
          console.log('📥 Processing HTML to preserve component styles...');
          const processedHTML = await processHTMLForStylePreservation(holder.innerHTML, css);
          
          // Step 2: Set minimal CSS (only global styles, not component-specific)
          console.log('📥 Setting global CSS...');
          const globalCSS = extractGlobalCSS(css);
          editorRef.current.setStyle(globalCSS);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Step 3: Set components with processed HTML
          console.log('📥 Setting components with preserved styles...');
          if (processedHTML.trim()) {
            editorRef.current.setComponents(processedHTML);
          } else {
            editorRef.current.setComponents('');
          }
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Step 4: Apply wrapper styles with proper dimensions
          console.log('📥 Setting wrapper styles...');
          const editorWrapper = editorRef.current.getWrapper();
          if (editorWrapper) {
            const canvasWidth = stateData.canvasWidth || targetWidth;
            const canvasHeight = stateData.canvasHeight || targetHeight;
            
            // Reset wrapper completely
            editorWrapper.set('style', {});
            editorWrapper.set('attributes', {});
            
            const wrapperStyles = {
              'background-color': 'transparent',
              'width': `${canvasWidth}px`,
              'height': `${canvasHeight}px`,
              'overflow': 'hidden',
              'position': 'relative',
              'margin': '0',
              'padding': '0'
            };
            
            editorWrapper.addStyle(wrapperStyles);
            editorWrapper.addAttributes({
              'data-design-w': canvasWidth,
              'data-design-h': canvasHeight
            });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Center and zoom canvas
            centerAndZoomCanvas(editorRef.current, canvasWidth, canvasHeight, setZoom);
          }
          
          // Step 5: Restore component interactivity
          console.log('📥 Restoring component interactivity...');
          
          // Clear any selections to reset state
          editorRef.current.select(null);
          
          // Wait for components to be fully initialized
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Restore animations and make sure components are interactive
          restoreAnimationAttributes(editorRef.current);
          
          // Step 6: Ensure all components are properly initialized and editable
          const allComponents = editorRef.current.getWrapper().find('*');
          allComponents.forEach(component => {
            try {
              // Reset component selection state
              component.set('status', '');
              
              // Ensure component is not in a locked state
              component.set('locked', false);
              
              // Re-trigger component initialization
              if (component.view) {
                component.view.render();
              }
            } catch (e) {
              console.warn(`Could not reset component ${component.getId()}:`, e);
            }
          });
          
          // Step 7: Force complete refresh and re-initialization
          console.log('📥 Final refresh...');
          editorRef.current.trigger('component:update');
          editorRef.current.trigger('style:update');
          editorRef.current.trigger('canvas:updated');
          editorRef.current.refresh();
          
          // Final wait to ensure everything is stable
          await new Promise(resolve => setTimeout(resolve, 200));
          
          console.log(`✅ ${stateName} state loaded successfully`);
          
        } catch (error) {
          console.error(`❌ Error loading ${stateName} state:`, error);
          throw error; // Re-throw to be caught by switchToState
        }
      };

      // Helper function to process HTML and bake CSS styles into inline styles
      const processHTMLForStylePreservation = async (html, css) => {
        if (!html || !css) return html;
        
        try {
          // Create a temporary container to work with the HTML
          const tempContainer = document.createElement('div');
          tempContainer.innerHTML = html;
          
          // Parse CSS rules to extract component-specific styles
          const cssRules = parseCSSRules(css);
          
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
          console.warn('Error processing HTML for style preservation:', error);
          return html; // Return original HTML if processing fails
        }
      };

      // Helper function to parse CSS into rules
      const parseCSSRules = (css) => {
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

      // Helper function to extract only global CSS (non-component-specific)
      const extractGlobalCSS = (css) => {
        if (!css) return '';
        
        try {
          // Filter out component-specific selectors (those with IDs)
          const lines = css.split('\n');
          const globalLines = [];
          let insideComponentRule = false;
          let braceCount = 0;
          
          lines.forEach(line => {
            const trimmedLine = line.trim();
            
            // Check if this line starts a component-specific rule
            if (trimmedLine.includes('[id=') || trimmedLine.includes('#')) {
              insideComponentRule = true;
            }
            
            // Count braces to track rule nesting
            const openBraces = (trimmedLine.match(/\{/g) || []).length;
            const closeBraces = (trimmedLine.match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            // If we're not inside a component rule, keep the line
            if (!insideComponentRule) {
              globalLines.push(line);
            }
            
            // Reset when we exit the component rule
            if (insideComponentRule && braceCount <= 0) {
              insideComponentRule = false;
              braceCount = 0;
            }
          });
          
          return globalLines.join('\n');
        } catch (error) {
          console.warn('Error extracting global CSS:', error);
          return css; // Return full CSS if extraction fails
        }
      };
    
      const switchToState = async (newState) => {
        if (!editorRef.current) {
          console.warn('🔄 No editor reference available for state switch');
          return;
        }
        
        if (newState === currentState) {
          console.log(`🔄 Already in ${newState} state, skipping switch`);
          return;
        }
        
        console.log(`🔄 Starting switch from ${currentState} to ${newState}`);
        
        try {
          // Step 1: Capture the current state value before any changes (React state updates are async)
          const oldState = currentState;
          console.log(`🔄 Old state captured: ${oldState}`);
          
          // Step 2: Save current state before any changes
          console.log('💾 Saving current state...');
          const savedStateData = await saveCurrentState();
          
          console.log(`💾 Saved ${oldState} state data:`, {
            hasData: !!savedStateData,
            htmlLength: savedStateData?.html?.length || 0
          });
          
          // Step 3: Update the appropriate state data storage BEFORE clearing editor
          if (oldState === 'active' && savedStateData) {
            console.log('💾 Updating activeStateData with saved data');
            setActiveStateData(savedStateData);
          } else if (oldState === 'resting' && savedStateData) {
            console.log('💾 Updating restingStateData with saved data');
            setRestingStateData(savedStateData);
          }
          
          // Step 4: Get the current state data from memory (use fresh saved data for old state)
          const currentActiveData = oldState === 'active' ? savedStateData : activeStateData;
          const currentRestingData = oldState === 'resting' ? savedStateData : restingStateData;
          
          console.log(`📊 State data available:`, {
            activeDataExists: !!currentActiveData,
            restingDataExists: !!currentRestingData,
            switchingTo: newState
          });
          
          // Step 5: Clear editor completely
          console.log('🧹 Clearing editor...');
          await clearEditorCompletely();
          
          // Step 6: Update current state
          console.log(`🔄 Setting current state to ${newState}`);
          setCurrentState(newState);
          
          // Step 7: Wait for state updates to complete
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Step 8: Get target state data using the current memory values
          const targetStateData = newState === 'active' ? currentActiveData : currentRestingData;
          
          // Step 9: Load target state if it exists
          if (targetStateData) {
            console.log(`📥 Loading ${newState} state with data:`, {
              htmlLength: targetStateData.html?.length || 0
            });
            await loadStateContent(targetStateData, newState);
          } else {
            console.log(`🔄 No saved ${newState} state - initializing empty editor`);
            // Initialize the editor with proper canvas dimensions
            try {
              const editorWrapper = editorRef.current.getWrapper();
              if (editorWrapper) {
                const wrapperStyles = {
                  'background-color': 'transparent',
                  'width': `${targetWidth}px`,
                  'height': `${targetHeight}px`,
                  'overflow': 'hidden',
                };
                editorWrapper.addStyle(wrapperStyles);
                editorWrapper.addAttributes({
                  'data-design-w': targetWidth,
                  'data-design-h': targetHeight
                });
              }
              centerAndZoomCanvas(editorRef.current, targetWidth, targetHeight, setZoom);
            } catch (initError) {
              console.warn('Could not initialize empty editor:', initError);
            }
          }
          
          console.log(`✅ Successfully switched to ${newState} state`);
          
        } catch (error) {
          console.error(`❌ Error switching to ${newState} state:`, error);
          console.error('❌ Full error details:', error.stack);
          
          // Try to recover by at least updating the state
          try {
            console.log('🔄 Attempting to recover by updating state only');
            setCurrentState(newState);
          } catch (recoveryError) {
            console.error('❌ Recovery failed:', recoveryError);
          }
        }
      };
    
      const copyCurrentStateToOther = async () => {
        if (!editorRef.current) return;
        
        try {
          console.log(`📋 Copying ${currentState} state to ${currentState === 'active' ? 'resting' : 'active'} state`);
          
          // Save current state
          const currentStateData = await saveCurrentState();
          
          if (!currentStateData) {
            console.error('❌ Failed to save current state for copying');
            return;
          }
          
          const otherState = currentState === 'active' ? 'resting' : 'active';
          
          // Update the other state with current data
          if (otherState === 'active') {
            setActiveStateData(currentStateData);
          } else {
            setRestingStateData(currentStateData);
          }
          
          console.log(`✅ Successfully copied ${currentState} state to ${otherState} state`);
          
        } catch (error) {
          console.error('❌ Error copying state:', error);
        }
      };
    
      const handleTemplateLoad = async (e) => {
        const name = e.target.value;
        if (!name) { 
          setCurrentName(null); 
          setActiveStateData(null);
          setRestingStateData(null);
          return; 
        }
    
        try {
          // console.log('📂 Loading template:', name);
          const tpl = await fetchTemplate(name);
          setCurrentName(name);
    
          // console.log('📂 Template loaded:', {
          //   name,
          //   hasActiveState: !!tpl.activeState,
          //   hasRestingState: !!tpl.restingState,
          //   activeStateHtmlLength: tpl.activeState?.html?.length || 0,
          //   restingStateHtmlLength: tpl.restingState?.html?.length || 0,
          //   canvasWidth: tpl.canvasWidth,
          //   canvasHeight: tpl.canvasHeight
          // });
    
          /* forward size to wizard hook so clamp / snap have right canvas-size */
          setTargetWidth(tpl.canvasWidth || 1920);
          setTargetHeight(tpl.canvasHeight || 1080);
    
          // Store both states if they exist
          if (tpl.activeState) {
            setActiveStateData(tpl.activeState);
            // console.log('📂 Loaded active state:', tpl.activeState.html ? 'present' : 'null');
          }
          if (tpl.restingState) {
            setRestingStateData(tpl.restingState);
            // console.log('📂 Loaded resting state:', tpl.restingState.html ? 'present' : 'null');
          }
          
          // console.log('📂 Template load data:', {
          //   name,
          //   hasActiveState: !!tpl.activeState,
          //   hasRestingState: !!tpl.restingState,
          //   activeStateHtml: tpl.activeState?.html ? 'present' : 'null',
          //   restingStateHtml: tpl.restingState?.html ? 'present' : 'null'
          // });
    
          // Load the current state (default to active)
          const stateToLoad = currentState === 'active' ? tpl.activeState : tpl.restingState;
          const stateData = stateToLoad || tpl.activeState || tpl; // fallback to old format
    
          // console.log('📂 Loading state data:', {
          //   currentState,
          //   stateDataHtmlLength: stateData.html?.length || 0
          // });
    
          /* push components / CSS into editor */
          const holder = document.createElement('div');
          holder.innerHTML = stateData.html || '';
          const styleTag   = holder.querySelector('style');
          const css        = styleTag ? styleTag.innerHTML : '';
          if (styleTag) styleTag.remove();
          
          // console.log('📂 Extracted CSS length:', css.length);
          // console.log('📂 CSS preview:', css.substring(0, 500) + '...');
          
          editorRef.current.setComponents(holder.innerHTML);
          editorRef.current.setStyle(css);

          // Extract background styles from CSS and apply to wrapper
          const extractBackgroundFromCSS = (cssText) => {
            const backgroundStyles = {};
            if (!cssText) return backgroundStyles;
            
            log('🔍 Extracting background from CSS:', cssText.substring(0, 500) + '...');
            
            // Use regex to find all background properties
            const backgroundRegex = /background-[a-z-]+\s*:\s*[^;}]+/gi;
            const matches = cssText.match(backgroundRegex) || [];
            
            log('🔍 Background regex matches:', matches);
            
            for (const match of matches) {
              const colonIndex = match.indexOf(':');
              if (colonIndex > 0) {
                const property = match.substring(0, colonIndex).trim();
                const value = match.substring(colonIndex + 1).trim();
                if (property && value) {
                  backgroundStyles[property] = value;
                  log(`🔍 Extracted background: ${property} = ${value}`);
                }
              }
            }
            
            // Also try to extract from .layout-root specifically
            const layoutRootRegex = /\.layout-root\s*\{[^}]*background-color\s*:\s*([^;}]+)/gi;
            const layoutRootMatches = cssText.match(layoutRootRegex) || [];
            
            log('🔍 Layout root regex matches:', layoutRootMatches);
            
            for (const match of layoutRootMatches) {
              const colorMatch = match.match(/background-color\s*:\s*([^;}]+)/i);
              if (colorMatch) {
                const value = colorMatch[1].trim();
                backgroundStyles['background-color'] = value;
                log(`🔍 Extracted from layout-root: background-color = ${value}`);
              }
            }
            
            log('🔍 Final background styles:', backgroundStyles);
            return backgroundStyles;
          };

          // Extract animation data from HTML elements and apply to components
          const extractAnimationFromHTML = (htmlText) => {
            const animationData = {};
            if (!htmlText) return animationData;
            
            // Create a temporary element to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = htmlText;
            
            // Look for elements with animation attributes
            const animatedElements = temp.querySelectorAll('[data-anim]');
            
            if (animatedElements.length > 0) {
              const element = animatedElements[0]; // Take the first animated element
              animationData.animType = element.getAttribute('data-anim');
              animationData.duration = element.getAttribute('data-anim-dur');
              animationData.delay = element.getAttribute('data-anim-delay');
              
              log('🔍 Extracted animation data from HTML:', animationData);
            }
            
            return animationData;
          };

          // Extract animation data from CSS (fallback method)
          const extractAnimationFromCSS = (cssText) => {
            const animationData = {};
            if (!cssText) return animationData;
            
            // Look for .gjs-block rules that contain animation data
            const gjsBlockRegex = /\.gjs-block\s*\{[^}]*data-anim[^}]*\}/gi;
            const matches = cssText.match(gjsBlockRegex) || [];
            
            for (const match of matches) {
              // Extract animation properties from the CSS rule
              const animMatch = match.match(/data-anim\s*:\s*([^;]+)/i);
              const durMatch = match.match(/data-anim-dur\s*:\s*([^;]+)/i);
              const delayMatch = match.match(/data-anim-delay\s*:\s*([^;]+)/i);
              
              if (animMatch) {
                animationData.animType = animMatch[1].trim();
              }
              if (durMatch) {
                animationData.duration = durMatch[1].trim();
              }
              if (delayMatch) {
                animationData.delay = delayMatch[1].trim();
              }
            }
            
            log('🔍 Extracted animation data from CSS (fallback):', animationData);
            return animationData;
          };

          const cssBackgroundStyles = extractBackgroundFromCSS(css);
          const cssAnimationData = extractAnimationFromCSS(css);
          const htmlAnimationData = extractAnimationFromHTML(holder.innerHTML);
          
          // Use HTML animation data if available, otherwise fall back to CSS
          const finalAnimationData = Object.keys(htmlAnimationData).length > 0 ? htmlAnimationData : cssAnimationData;
          
          log('🔍 Extracted background styles from CSS:', cssBackgroundStyles);
          log('🔍 Final animation data:', finalAnimationData);

          // Apply extracted background styles to wrapper and layout root
          setTimeout(() => {
            const editorWrapper = editorRef.current.getWrapper();
            if (editorWrapper) {
              // Apply extracted background styles along with other wrapper styles
              const wrapperStyles = {
                'width': `${stateData.canvasWidth || targetWidth}px`,
                'height': `${stateData.canvasHeight || targetHeight}px`,
                'overflow': 'hidden',
                ...cssBackgroundStyles
              };
              
              log('🔍 Applying wrapper styles:', wrapperStyles);
              editorWrapper.addStyle(wrapperStyles);
              
              // Ensure wrapper has dimension attributes
              editorWrapper.addAttributes({
                'data-design-w': stateData.canvasWidth || targetWidth,
                'data-design-h': stateData.canvasHeight || targetHeight
              });
            }

            // Apply styles to layout root as well
            const rootComponent = editorRef.current.getWrapper().find('.layout-root')[0];
            if (rootComponent) {
              const rootStyles = {
                'width': `${stateData.canvasWidth || targetWidth}px`,
                'height': `${stateData.canvasHeight || targetHeight}px`,
                ...cssBackgroundStyles
              };
              
              log('🔍 Applying root styles:', rootStyles);
              rootComponent.addStyle(rootStyles);
              
              // Ensure layout root has dimension attributes
              rootComponent.addAttributes({
                'data-design-w': stateData.canvasWidth || targetWidth,
                'data-design-h': stateData.canvasHeight || targetHeight
              });
            }
          }, 100);

          // Auto-zoom and center the canvas after template is loaded
          setTimeout(() => {
            const canvasWidth = stateData.canvasWidth || targetWidth;
            const canvasHeight = stateData.canvasHeight || targetHeight;
            centerAndZoomCanvas(editorRef.current, canvasWidth, canvasHeight, setZoom);
          }, 200);

          // Restore animation attributes to components after template is loaded
          setTimeout(() => {
            restoreAnimationAttributes(editorRef.current);
            
            // Apply extracted animation data to components
            if (finalAnimationData.animType) {
              // console.log('🔄 Applying extracted animation data:', finalAnimationData);
              
              const walkComponents = (editor, cb) =>
                editor.getWrapper().find('*').forEach(cb);
              
              walkComponents(editorRef.current, (component) => {
                // Apply animation data to components that have the gjs-block class
                if (component.getClasses && component.getClasses().includes('gjs-block')) {
                  const attrs = {};
                  
                  if (finalAnimationData.animType) {
                    attrs['data-anim'] = finalAnimationData.animType;
                  }
                  if (finalAnimationData.duration) {
                    attrs['data-anim-dur'] = finalAnimationData.duration;
                  }
                  if (finalAnimationData.delay) {
                    attrs['data-anim-delay'] = finalAnimationData.delay;
                  }
                  
                  if (Object.keys(attrs).length > 0) {
                    component.addAttributes(attrs);
                    // console.log(`🔄 Applied animation attributes to component ${component.getId()}:`, attrs);
                  }
                }
              });
            }
          }, 300);
        } catch (err) {
          // console.error(err);
          window.alert('Failed to load template');
        }
      };
    
      const handleDelete = async () => {
        if (!currentName) { window.alert('No template selected'); return; }
        if (!window.confirm(`Delete template "${currentName}"?`)) return;
    
        await deleteTemplate(currentName).catch((e) => {
          // console.error(e);
          window.alert('Deletion failed');
        });
        setCurrentName(null);
        setActiveStateData(null);
        setRestingStateData(null);
        templateSelectRef.current.value = '';
        refreshTemplates();
        editorRef.current.setComponents('');
        editorRef.current.setStyle('');
      };
    
      /* ────────── Command callbacks (defined after hooks) ────────── */
      const handleSave = useCallback(async () => {
        // console.log('💾 handleSave: Starting save process');
        // console.log('💾 Current template name at save:', currentName);
        // console.log('💾 Template selector value:', templateSelectRef.current?.value);
        
        // Determine which template name to use
        let templateName = currentName;
        
        // If no current template name but we have a selected template, use that
        if (!templateName && templateSelectRef.current?.value) {
          templateName = templateSelectRef.current.value;
          setCurrentName(templateName);
        }
        
        // If we have a template name (either from state or selector), save it
        if (templateName) {
          // console.log('💾 Saving existing template:', templateName);
          try {
            // Save current state before saving template
            const currentStateData = await saveCurrentState();
            
            // Build both states for saving
            let finalActiveState = activeStateData;
            let finalRestingState = restingStateData;
            
            // Update the appropriate state with current data
            if (currentState === 'active') {
              finalActiveState = currentStateData;
            } else {
              finalRestingState = currentStateData;
            }
            
            console.log('💾 Saving template with states:', {
              templateName,
              currentState,
              finalActiveState: finalActiveState ? 'present' : 'null',
              finalRestingState: finalRestingState ? 'present' : 'null',
              activeStateData: activeStateData ? 'present' : 'null',
              restingStateData: restingStateData ? 'present' : 'null',
              currentStateData: currentStateData ? 'present' : 'null',
              activeStateHtmlLength: finalActiveState?.html?.length || 0,
              restingStateHtmlLength: finalRestingState?.html?.length || 0
            });
            
            await saveTemplate({
              editor: editorRef?.current,
              name: templateName,
              targetWidth,
              targetHeight,
              activeState: finalActiveState,
              restingState: finalRestingState,
            });
            await refreshTemplates();
            // console.log('💾 Successfully saved template:', templateName);
            return;
          } catch (error) {
            // console.error('💾 Failed to save template:', error);
          }
        }
        
        // If we get here, we need to prompt for a new name
        // console.log('💾 No template name found, prompting for new name');
        const name = window.prompt('Template name');
        if (!name) return;
        
        try {
          // Save current state before saving template
          const currentStateData = await saveCurrentState();
          
          // Build both states for saving
          let finalActiveState = activeStateData;
          let finalRestingState = restingStateData;
          
          // Update the appropriate state with current data
          if (currentState === 'active') {
            finalActiveState = currentStateData;
          } else {
            finalRestingState = currentStateData;
          }
          
          // console.log('💾 Saving new template:', name);
          await saveTemplate({
            editor: editorRef?.current,
            name,
            targetWidth,
            targetHeight,
            activeState: finalActiveState,
            restingState: finalRestingState,
          });
          setCurrentName(name); // Set the current name after successful save
          await refreshTemplates();
        } catch (error) {
          // console.error('💾 Failed to save template:', error);
        }
      }, [
        currentName,
        activeStateData,
        restingStateData,
        currentState,
        targetWidth,
        targetHeight,
        refreshTemplates,
        saveCurrentState,
        setCurrentName,
        editorRef,
      ]);
    
      const handleSaveAs = useCallback(async () => {
        const name = window.prompt('Template name');
        if (!name) return;
        
        // Save current state before saving template
        const currentStateData = await saveCurrentState();
        
        // Build both states for saving
        let finalActiveState = activeStateData;
        let finalRestingState = restingStateData;
        
        // Update the appropriate state with current data
        if (currentState === 'active') {
          finalActiveState = currentStateData;
        } else {
          finalRestingState = currentStateData;
        }
        
        await saveTemplate({
          editor: editorRef?.current,
          name,
          targetWidth,
          targetHeight,
          activeState: finalActiveState,
          restingState: finalRestingState,
        });
        setCurrentName(name);
        refreshTemplates();
      }, [
        activeStateData,
        restingStateData,
        currentState,
        targetWidth,
        targetHeight,
        refreshTemplates,
        setCurrentName,
        saveCurrentState,
        editorRef,
      ]);
    
      const handleDisplayMode = useCallback(async () => {
        // Save current state before caching for display
        const currentStateData = await saveCurrentState();
        
        // Build both states for caching
        let finalActiveState = activeStateData;
        let finalRestingState = restingStateData;
        
        // Update the appropriate state with current data
        if (currentState === 'active') {
          finalActiveState = currentStateData;
        } else {
          finalRestingState = currentStateData;
        }
        
        cacheTemplateForDisplay(editorRef?.current, { 
          targetWidth,
          targetHeight,
          activeState: finalActiveState,
          restingState: finalRestingState,
        });
        window.open('/display', '_blank', 'noopener');          // keep editor open
      }, [
        activeStateData,
        restingStateData,
        currentState,
        targetWidth,
        targetHeight,
        saveCurrentState,
        editorRef,
      ]);
    
      /* ────────── Wire up command callbacks ────────── */
      useEffect(() => {
        if (editorRef?.current) {
          const editor = editorRef.current;
          
          // Wrap async functions to handle errors properly
          editor.Commands.get('save-template').run = async () => {
            try {
              await handleSave();
            } catch (error) {
              console.error('Error in save command:', error);
            }
          };
          
          editor.Commands.get('save-as-template').run = async () => {
            try {
              await handleSaveAs();
            } catch (error) {
              console.error('Error in save-as command:', error);
            }
          };
          
          editor.Commands.get('fullscreen').run = async () => {
            try {
              await handleDisplayMode();
            } catch (error) {
              console.error('Error in display mode command:', error);
            }
          };
        }
      }, [handleSave, handleSaveAs, handleDisplayMode]);
    
      /* ────────── JSX ────────── */
      return (
        <div className="canvas-builder">
    
          {/* ═══ Dimension-Wizard Modal ═══ */}
          {showWizard && (
            <div className="dimension-wizard-backdrop">
              <div className="dimension-wizard-modal">
                <h2 className="dimension-wizard-title">Set Target Display Dimensions</h2>
                <p className="dimension-wizard-description">
                  Enter the pixel dimensions of your target display screen.
                </p>
    
                <div className="dimension-presets">
                  <div className="dimension-presets-title">Common Presets</div>
                  <div className="dimension-presets-grid">
                    {DIMENSION_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        className="dimension-preset-btn"
                        onClick={() => selectPreset(p)}
                      >
                        {p.name}<br />
                        <small>{p.width} × {p.height}</small>
                      </button>
                    ))}
                  </div>
                </div>
    
                <div className="dimension-input-group">
                  <div>
                    <label className="dimension-label">Width</label>
                    <input
                      className="dimension-input"
                      type="number"
                      min={100}
                      value={targetWidth}
                      onChange={(e) => setTargetWidth(Number(e.target.value))}
                    />
                  </div>
                  <span className="dimension-label">×</span>
                  <div>
                    <label className="dimension-label">Height</label>
                    <input
                      className="dimension-input"
                      type="number"
                      min={100}
                      value={targetHeight}
                      onChange={(e) => setTargetHeight(Number(e.target.value))}
                    />
                  </div>
                </div>
    
                <div className="dimension-wizard-buttons">
                  <button className="btn btn-secondary" onClick={closeWizard}>Cancel</button>
                  <button className="btn btn-primary"   onClick={confirmDimensions}>Create Canvas</button>
                </div>
              </div>
            </div>
          )}
    
          {/* ═══ Top Toolbar ═══ */}
          <div className="canvas-builder__toolbar">
    
            <button className="btn btn-secondary me-2"
                    onClick={() => editorRef.current?.runCommand('core:undo')}>
              Undo
            </button>
    
            <button className="btn btn-secondary me-2"
                    onClick={() => editorRef.current?.runCommand('core:redo')}>
              Redo
            </button>
    
            <button className="btn btn-secondary me-2"
                    onClick={() => editorRef.current?.runCommand('open-assets')}>
              Images
            </button>
    
            <button className="btn btn-secondary me-2"
                    onClick={() => editorRef.current?.runCommand('fullscreen')}>
              Display Mode
            </button>
    
            {/* zoom */}
            <button className="btn btn-secondary me-2" onClick={zoomOut}>−</button>
            <button className="btn btn-secondary me-2" onClick={zoomIn}>+</button>
            <span style={{ minWidth: 60 }} className="me-3">{Math.round(zoom * 100)}%</span>
    
            {/* save / save-as */}
            <div className="btn-group me-2">
              <button className="btn btn-primary"
                      onClick={handleSave}>
                Save
              </button>
              <button className="btn btn-primary dropdown-toggle dropdown-toggle-split"
                      data-bs-toggle="dropdown" aria-expanded="false" />
              <ul className="dropdown-menu">
                <li>
                  <button className="dropdown-item"
                          onClick={handleSaveAs}>
                    Save As…
                  </button>
                </li>
              </ul>
            </div>
    
            <button className="btn btn-secondary me-2" onClick={openWizard}>New</button>
            <button className="btn btn-danger me-2"    onClick={handleDelete}>Delete</button>
    
            {/* template selector */}
            <select ref={templateSelectRef}
                    className="form-select d-inline w-auto me-2"
                    value={currentName || ''}
                    onChange={handleTemplateLoad}>
              <option value="">— templates —</option>
              {templates.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
    
            {/* State toggle controls */}
            <div className="btn-group me-2">
              <button 
                className={`btn ${currentState === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={async () => {
                  try {
                    await switchToState('active');
                  } catch (error) {
                    console.error('Error switching to active state:', error);
                  }
                }}
              >
                Active
              </button>
              <button 
                className={`btn ${currentState === 'resting' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={async () => {
                  try {
                    await switchToState('resting');
                  } catch (error) {
                    console.error('Error switching to resting state:', error);
                  }
                }}
              >
                Resting
              </button>
            </div>
    
            {/* Copy state button */}
            <button 
              className="btn btn-outline-secondary me-2"
              onClick={async () => {
                try {
                  await copyCurrentStateToOther();
                } catch (error) {
                  console.error('Error copying state:', error);
                }
              }}
              title={`Copy ${currentState} state to ${currentState === 'active' ? 'resting' : 'active'} state`}
            >
              Copy to {currentState === 'active' ? 'Resting' : 'Active'}
            </button>
    
            {/* message manager toggle (small button) */}
            <button className="toolbar-button me-2"
                    onClick={() => setMsgMgrOpen(true)}>
              Messages
            </button>
    
            {/* duration field */}
            <div className="d-flex align-items-center">
              <span className="me-1">Duration</span>
              <input
                style={{ width: 60 }}
                className="form-control"
                type="number"
                min={0}
                value={localDuration}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
              />
              <span className="ms-1">sec</span>
            </div>
          </div>
    
          {/* ═══ Workspace ═══ */}
          <div className="canvas-builder__workspace">
            <div id="blocks" className="canvas-builder__blocks" />
            <div id="gjs"    className="canvas-builder__editor" />
            <div className="canvas-builder__right-panel">
              <div className="panel__right" />
              <div id="style" className="canvas-builder__styles" />
            </div>
          </div>
    
          {/* ═══ Modals ═══ */}
          <ImageCropModal
            isOpen       ={showCrop}
            onClose      ={() => setCropData(null)}
            imageUrl     ={cropData?.imageUrl}
            targetWidth  ={cropData?.targetWidth}
            targetHeight ={cropData?.targetHeight}
            /* upload handled in imageDrop util → nothing to do here */
          />
    
          <MessageManager
            isOpen ={msgMgrOpen}
            onClose={()=> setMsgMgrOpen(false)}
          />
        </div>
      );
  }

