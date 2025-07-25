/* ──────────────────────────────────────────────────────────────
   useDimensionWizard.js
   ------------------------------------------------------------------
   Centralises all logic for the "Set Display Dimensions" modal.
   Pure hook – it NEVER touches React-DOM directly; the caller is
   responsible for rendering the modal UI with the returned state
   and handlers.
   ------------------------------------------------------------------ */

   import { useState, useCallback } from 'react';
   import { DIMENSION_PRESETS }      from '../utils/constants';
   
   /**
    * Calculate the optimal zoom level to fit the canvas in the available space
    */
   const calculateOptimalZoom = (canvasWidth, canvasHeight, containerWidth, containerHeight) => {
     const scaleX = containerWidth / canvasWidth;
     const scaleY = containerHeight / canvasHeight;
     const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
     return Math.max(scale, 0.1); // Minimum zoom of 10%
   };
   
   /**
    * Center and zoom the canvas to fit in the available space
    */
   const centerAndZoomCanvas = (editor, targetWidth, targetHeight, setZoomCallback = null) => {
     if (!editor) return;
   
     const canvasContainer = editor.Canvas.getFrameEl()?.parentElement;
     if (!canvasContainer) return;
   
     // Get the available space in the canvas container
     const containerRect = canvasContainer.getBoundingClientRect();
     const containerWidth = containerRect.width;
     const containerHeight = containerRect.height;
   
     // Calculate optimal zoom
     const optimalZoom = calculateOptimalZoom(targetWidth, targetHeight, containerWidth, containerHeight);
   
     // Apply zoom to the iframe body
     const frameEl = editor.Canvas.getFrameEl();
     if (frameEl?.contentDocument?.body) {
       frameEl.contentDocument.body.style.transform = `scale(${optimalZoom})`;
       frameEl.contentDocument.body.style.transformOrigin = 'top left';
     }
   
     // Center the canvas by adjusting the container's scroll position
     const scaledWidth = targetWidth * optimalZoom;
     const scaledHeight = targetHeight * optimalZoom;
   
     const scrollLeft = Math.max(0, (scaledWidth - containerWidth) / 2);
     const scrollTop = Math.max(0, (scaledHeight - containerHeight) / 2);
   
     canvasContainer.scrollLeft = scrollLeft;
     canvasContainer.scrollTop = scrollTop;
   
     // Update zoom state if callback is provided
     if (setZoomCallback && typeof setZoomCallback === 'function') {
       setZoomCallback(optimalZoom);
     }
   
     return optimalZoom;
   };
   
   /**
    * @param {object}   opts
    * @param {React.RefObject}  opts.editorRef          – ref returned by grapesjs.init()
    * @param {React.RefObject}  opts.templateSelectorRef– <select> that lists templates (for reset)
    * @param {Function} opts.setCanvasInitialized       – setter from parent component
    * @param {Function} opts.setCurrentTemplateName     – setter from parent component
    * @param {Function} [opts.setZoom]                  – setter from useZoom hook
    * @param {number}   [opts.defaultWidth=1920]
    * @param {number}   [opts.defaultHeight=1080]
    */
   export function useDimensionWizard({
     editorRef,
     templateSelectorRef,
     setCanvasInitialized,
     setCurrentTemplateName,
     setZoom,
     defaultWidth  = 1920,
     defaultHeight = 1080,
   } = {}) {
     /* ────────── local UI state ────────── */
     const [showWizard,   setShowWizard]   = useState(false);
     const [targetWidth,  setTargetWidth]  = useState(defaultWidth);
     const [targetHeight, setTargetHeight] = useState(defaultHeight);
   
     /** open modal */
     const openWizard  = () => setShowWizard(true);
     /** close modal without changes */
     const closeWizard = () => setShowWizard(false);
   
     /** user clicked a preset button */
     const selectPreset = ({ width, height }) => {
       setTargetWidth(width);
       setTargetHeight(height);
     };
   
     /** apply chosen dimensions – heavy lifting happens here */
     const confirmDimensions = useCallback(() => {
       if (
         !targetWidth ||
         !targetHeight ||
         targetWidth  < 100 ||
         targetHeight < 100
       ) {
         window.alert('Please enter valid dimensions (minimum 100px each)');
         return;
       }
   
       setShowWizard(false);
   
       /* Need a live GrapesJS editor to proceed */
       const editor = editorRef?.current;
       if (!editor) return;
   
       /* 1. wipe canvas & reset template state */
       editor.setComponents('');
       editor.setStyle('');
       setCurrentTemplateName?.(null);
       if (templateSelectorRef?.current) templateSelectorRef.current.value = '';
   
       /* 2. update iframe size */
       const frameEl = editor.Canvas.getFrameEl();
       if (frameEl) {
         frameEl.style.width  = `${targetWidth}px`;
         frameEl.style.height = `${targetHeight}px`;
   
         try {
           const body = frameEl.contentDocument?.body;
           if (body) {
             body.style.width  = `${targetWidth}px`;
             body.style.height = `${targetHeight}px`;
           }
         } catch { /* cross-doc access might fail */ }
       }
   
       /* 3. update wrapper & add a fresh layout-root */
       const wrapper = editor.getWrapper();
       wrapper.setStyle({
         width    : `${targetWidth}px`,
         height   : `${targetHeight}px`,
         position : 'relative',
         overflow : 'hidden',
       });
       wrapper.addAttributes({
         'data-design-w': targetWidth,
         'data-design-h': targetHeight,
       });
   
       wrapper.find('.layout-root').forEach((c) => c.remove()); // drop old roots
   
       const layoutRoot = wrapper.append(`
         <div class="layout-root"
              style="position:relative;width:100%;height:100%;box-sizing:border-box;"
              data-design-w="${targetWidth}"
              data-design-h="${targetHeight}">
           <div class="safe-zone-overlay"
                style="position:absolute;top:5%;left:5%;width:90%;height:90%;
                       border:2px dashed rgba(255,165,0,0.6);box-sizing:border-box;
                       pointer-events:none;z-index:1000;"></div>
         </div>
       `)[0];
   
       layoutRoot.set({
         draggable : false,
         resizable : false,
         selectable: true,
         hoverable : true,
         removable : false,
         copyable  : false,
       });
   
       editor.select(wrapper);            // ensure nothing else is selected
       setCanvasInitialized?.(true);      // let parent know canvas is ready
   
       /* 4. Auto-zoom and center the canvas */
       setTimeout(() => {
         centerAndZoomCanvas(editor, targetWidth, targetHeight, setZoom);
       }, 100);
     }, [
       targetWidth,
       targetHeight,
       editorRef,
       templateSelectorRef,
       setCurrentTemplateName,
       setCanvasInitialized,
     ]);
   
     /* ─────────── what the hook exposes ─────────── */
     return {
       /* modal visibility */
       showWizard,
       openWizard,
       closeWizard,
   
       /* controlled inputs */
       targetWidth,
       targetHeight,
       setTargetWidth,
       setTargetHeight,
   
       /* preset grid */
       dimensionPresets: DIMENSION_PRESETS,
       selectPreset,
   
       /* action buttons */
       confirmDimensions,
       centerAndZoomCanvas, // Export the function for use elsewhere
     };
   }
   