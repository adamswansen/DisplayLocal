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
  
  /* ────────────────────────────────────────────────────────────── */
  
  export default function CanvasBuilder() {
    // console.log('CanvasBuilder: Component starting to render');
  
    try {
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
      const saveCurrentState = () => {
        if (!editorRef.current) return null;
        
        try {
          // console.log('💾 saveCurrentState: Saving current state for:', currentState);
          
          const stateData = buildTemplateBundle(editorRef.current, {
            targetWidth,
            targetHeight,
            state: currentState,
          });
          
          // console.log('💾 State data saved:', {
          //   state: currentState,
          //   htmlLength: stateData.html?.length || 0,
          //   canvasWidth: stateData.canvasWidth,
          //   canvasHeight: stateData.canvasHeight
          // });
          
          if (currentState === 'active') {
            setActiveStateData(stateData);
          } else {
            setRestingStateData(stateData);
          }
          
          return stateData;
        } catch (error) {
          // console.error('💾 Error saving current state:', error);
          return null;
        }
      };
    
      const switchToState = (newState) => {
        if (!editorRef.current || newState === currentState) return;
        
        // Save current state before switching
        saveCurrentState();
        
        // Switch to new state
        setCurrentState(newState);
        
        // Load the target state data
        const targetStateData = newState === 'active' ? activeStateData : restingStateData;
        
        if (targetStateData) {
          // Load the state into the editor
          const holder = document.createElement('div');
          holder.innerHTML = targetStateData.html || '';
          const styleTag = holder.querySelector('style');
          const css = styleTag ? styleTag.innerHTML : '';
          if (styleTag) styleTag.remove();
          
          editorRef.current.setComponents(holder.innerHTML);
          editorRef.current.setStyle(css);
          
          // Apply background styles to wrapper
          setTimeout(() => {
            const editorWrapper = editorRef.current.getWrapper();
            if (editorWrapper) {
              const wrapperStyles = {
                'background-color': 'transparent',
                'width': `${targetStateData.canvasWidth || targetWidth}px`,
                'height': `${targetStateData.canvasHeight || targetHeight}px`,
                'overflow': 'hidden',
              };
              
              editorWrapper.addStyle(wrapperStyles);
              editorWrapper.addAttributes({
                'data-design-w': targetStateData.canvasWidth || targetWidth,
                'data-design-h': targetStateData.canvasHeight || targetHeight
              });
            }
          }, 100);

          // Auto-zoom and center the canvas after state is switched
          setTimeout(() => {
            const canvasWidth = targetStateData.canvasWidth || targetWidth;
            const canvasHeight = targetStateData.canvasHeight || targetHeight;
            centerAndZoomCanvas(editorRef.current, canvasWidth, canvasHeight, setZoom);
          }, 200);

          // Restore animation attributes to components after state is switched
          setTimeout(() => {
            restoreAnimationAttributes(editorRef.current);
          }, 300);
        } else {
          // If no saved state, clear the editor
          editorRef.current.setComponents('');
          editorRef.current.setStyle('');
        }
      };
    
      const copyCurrentStateToOther = () => {
        if (!editorRef.current) return;
        
        const currentStateData = buildTemplateBundle(editorRef.current, {
          targetWidth,
          targetHeight,
          state: currentState,
        });
        
        const otherState = currentState === 'active' ? 'resting' : 'active';
        
        if (otherState === 'active') {
          setActiveStateData(currentStateData);
        } else {
          setRestingStateData(currentStateData);
        }
        
        // Show feedback to user
        // console.log(`Copied ${currentState} state to ${otherState} state`);
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
            
            console.log('🔍 Extracting background from CSS:', cssText.substring(0, 500) + '...');
            
            // Use regex to find all background properties
            const backgroundRegex = /background-[a-z-]+\s*:\s*[^;}]+/gi;
            const matches = cssText.match(backgroundRegex) || [];
            
            console.log('🔍 Background regex matches:', matches);
            
            for (const match of matches) {
              const colonIndex = match.indexOf(':');
              if (colonIndex > 0) {
                const property = match.substring(0, colonIndex).trim();
                const value = match.substring(colonIndex + 1).trim();
                if (property && value) {
                  backgroundStyles[property] = value;
                  console.log(`🔍 Extracted background: ${property} = ${value}`);
                }
              }
            }
            
            // Also try to extract from .layout-root specifically
            const layoutRootRegex = /\.layout-root\s*\{[^}]*background-color\s*:\s*([^;}]+)/gi;
            const layoutRootMatches = cssText.match(layoutRootRegex) || [];
            
            console.log('🔍 Layout root regex matches:', layoutRootMatches);
            
            for (const match of layoutRootMatches) {
              const colorMatch = match.match(/background-color\s*:\s*([^;}]+)/i);
              if (colorMatch) {
                const value = colorMatch[1].trim();
                backgroundStyles['background-color'] = value;
                console.log(`🔍 Extracted from layout-root: background-color = ${value}`);
              }
            }
            
            console.log('🔍 Final background styles:', backgroundStyles);
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
              
              console.log('🔍 Extracted animation data from HTML:', animationData);
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
            
            console.log('🔍 Extracted animation data from CSS (fallback):', animationData);
            return animationData;
          };

          const cssBackgroundStyles = extractBackgroundFromCSS(css);
          const cssAnimationData = extractAnimationFromCSS(css);
          const htmlAnimationData = extractAnimationFromHTML(holder.innerHTML);
          
          // Use HTML animation data if available, otherwise fall back to CSS
          const finalAnimationData = Object.keys(htmlAnimationData).length > 0 ? htmlAnimationData : cssAnimationData;
          
          console.log('🔍 Extracted background styles from CSS:', cssBackgroundStyles);
          console.log('🔍 Final animation data:', finalAnimationData);

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
              
              console.log('🔍 Applying wrapper styles:', wrapperStyles);
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
              
              console.log('🔍 Applying root styles:', rootStyles);
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
            const currentStateData = saveCurrentState();
            
            // Build both states for saving
            let finalActiveState = activeStateData;
            let finalRestingState = restingStateData;
            
            // Update the appropriate state with current data
            if (currentState === 'active') {
              finalActiveState = currentStateData;
            } else {
              finalRestingState = currentStateData;
            }
            
            // console.log('💾 Saving template with states:', {
            //   templateName,
            //   currentState,
            //   finalActiveState: finalActiveState ? 'present' : 'null',
            //   finalRestingState: finalRestingState ? 'present' : 'null',
            //   activeStateData: activeStateData ? 'present' : 'null',
            //   restingStateData: restingStateData ? 'present' : 'null',
            //   currentStateData: currentStateData ? 'present' : 'null'
            // });
            
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
          const currentStateData = saveCurrentState();
          
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
        const currentStateData = saveCurrentState();
        
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
    
      const handleDisplayMode = useCallback(() => {
        // Save current state before caching for display
        const currentStateData = saveCurrentState();
        
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
          editor.Commands.get('save-template').run = handleSave;
          editor.Commands.get('save-as-template').run = handleSaveAs;
          editor.Commands.get('fullscreen').run = handleDisplayMode;
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
                onClick={() => switchToState('active')}
              >
                Active
              </button>
              <button 
                className={`btn ${currentState === 'resting' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchToState('resting')}
              >
                Resting
              </button>
            </div>
    
            {/* Copy state button */}
            <button 
              className="btn btn-outline-secondary me-2"
              onClick={copyCurrentStateToOther}
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
    } catch (error) {
      // console.error('Error in CanvasBuilder:', error);
      return (
        <div className="canvas-builder">
          <p>An error occurred. Please try again later.</p>
        </div>
      );
    }
  }
  