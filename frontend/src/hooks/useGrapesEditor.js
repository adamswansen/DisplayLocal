/* ──────────────────────────────────────────────────────────────
   useGrapesEditor.js
   ------------------------------------------------------------------
   React hook that boots a GrapesJS editor exactly once, registers
   blocks & commands, and wires up common listeners.  All logic that
   doesn't have to be here (snap, clamp, commands, blocks, etc.) is
   delegated to helper modules.
   ------------------------------------------------------------------ */

   import { useEffect, useRef, useState } from 'react';
   import grapesjs                        from 'grapesjs';
   import interact                        from 'interactjs';
   
   import EDITOR_CONFIG                   from '../components/CanvasBuilder/editorConfig';
   import customStyles                    from '../components/CanvasBuilder/inlineStyles.js';
   import { registerCommands }            from '../grapes/commands';
   import { snapComponent, clampToCanvas, createRotationHandle, positionRotationHandle, getElementRotation, setElementRotation } from '../utils/editorMath';
   import { fetchUserImages }             from '../utils/imageService';
   import { generateImageBlocks, getBlocksForMode } from '../grapes/blocks';
   
   /* shorthand for addSnap+Clamp on move / resize */
   const makeSyncHandler =
     (targetW, targetH) =>
     (comp) => {
       snapComponent(comp);
       clampToCanvas(comp, targetW, targetH);
     };

   /**
    * Calculate a good position for a new block on the canvas
    * @param {Object} editor - GrapesJS editor instance
    * @param {number} targetWidth - Canvas width
    * @param {number} targetHeight - Canvas height
    * @returns {Object} Position object with x, y coordinates
    */
   const calculateBlockPosition = (editor, targetWidth, targetHeight) => {
     const wrapper = editor.getWrapper();
     const existingComponents = wrapper.components();
     
     // Get actual canvas dimensions from the wrapper
     const wrapperStyle = wrapper.getStyle();
     const actualWidth = parseInt(wrapperStyle.width) || targetWidth;
     const actualHeight = parseInt(wrapperStyle.height) || targetHeight;
     
     // Always place in center for now
     let x = Math.floor(actualWidth / 2) - 50; // Center horizontally, offset by half block width
     let y = Math.floor(actualHeight / 2) - 25; // Center vertically, offset by half block height
     
     // If there are existing components, we could add a small offset to avoid exact overlap
     if (existingComponents.length > 0) {
       // Add a small random offset to avoid exact center overlap
       const offsetX = (Math.random() - 0.5) * 100; // Random offset between -50 and 50
       const offsetY = (Math.random() - 0.5) * 100; // Random offset between -50 and 50
       x += offsetX;
       y += offsetY;
     }
     
     return { x, y };
   };

   /**
    * Handle clicking on a block to add it to the canvas
    * @param {Object} block - The block that was clicked
    * @param {Object} editor - GrapesJS editor instance
    * @param {number} targetWidth - Canvas width
    * @param {number} targetHeight - Canvas height
    */
   const handleBlockClick = (block, editor, targetWidth, targetHeight) => {
     try {
       const position = calculateBlockPosition(editor, targetWidth, targetHeight);
       
       // Check if this is an image block
       const isImageBlock = block.get('category') === 'Images';
       const imageUrl = block.get('attributes')?.['data-image-url'];
       
       let componentConfig;
       
       if (isImageBlock && imageUrl) {
         // Create image component
         componentConfig = {
           type: 'image',
           src: imageUrl,
           alt: block.get('attributes')?.['data-image-filename'] || 'Image',
           style: {
             position: 'absolute',
             left: `${position.x}px`,
             top: `${position.y}px`,
             cursor: 'move',
             'user-select': 'none',
             'max-width': '100%',
             'height': 'auto'
           },
           attributes: block.get('attributes')
         };
       } else {
         // Create regular text component
         componentConfig = {
           type: 'default',
           content: block.get('content'),
           style: {
             position: 'absolute',
             left: `${position.x}px`,
             top: `${position.y}px`,
             cursor: 'move',
             'user-select': 'none'
           },
           attributes: block.get('attributes')
         };
       }
       
       // Try adding to wrapper instead of directly to editor
       const wrapper = editor.getWrapper();
       const component = wrapper.append(componentConfig)[0];
       
       // Configure the component for dragging and resizing
       component.set({
         draggable: true,
         resizable: {
           handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
           minWidth: 20,
           minHeight: 20
         }
       });
       
       // Force update the position
       component.addStyle({
         position: 'absolute',
         left: `${position.x}px`,
         top: `${position.y}px`
       });
       
       // Select the new component
       editor.select(component);
     } catch (error) {
       console.error('Error adding component to canvas:', error);
     }
   };

   /**
    * Attach click listeners to existing block elements
    * @param {Object} editor - GrapesJS editor instance
    * @param {number} targetWidth - Canvas width
    * @param {number} targetHeight - Canvas height
    */
   const attachBlockClickListeners = (editor, targetWidth, targetHeight) => {
     // Find all block elements and attach click listeners
     const blockElements = document.querySelectorAll('#blocks .gjs-block');
     
     blockElements.forEach((blockEl, index) => {
       // Remove existing click listeners to prevent duplicates
       blockEl.removeEventListener('click', blockEl._clickHandler);
       
       // Create new click handler
       blockEl._clickHandler = (e) => {
         e.preventDefault();
         e.stopPropagation();
         
         const blockManager = editor.BlockManager;
         
         // Find block by ID (more reliable than text matching)
         let block = null;
         
         // Try to find by data attribute first (for image blocks)
         const imageId = blockEl.querySelector('[data-image-id]')?.getAttribute('data-image-id');
         if (imageId) {
           block = blockManager.get(imageId);
         }
         
         // If not found by image ID, try to find by text content (for text blocks)
         if (!block) {
           const blockText = blockEl.textContent.trim();
           const allBlocks = blockManager.getAll();
           block = allBlocks.find(b => b.get('label') === blockText);
         }
         
         if (block) {
           // Use the same logic as handleBlockClick
           const position = calculateBlockPosition(editor, targetWidth, targetHeight);
           
           try {
             // Check if this is an image block
             const isImageBlock = block.get('category') === 'Images';
             const imageUrl = block.get('attributes')?.['data-image-url'];
             
             let componentConfig;
             
             if (isImageBlock && imageUrl) {
               // Create image component
               componentConfig = {
                 type: 'image',
                 src: imageUrl,
                 alt: block.get('attributes')?.['data-image-filename'] || 'Image',
                 style: {
                   position: 'absolute',
                   left: `${position.x}px`,
                   top: `${position.y}px`,
                   cursor: 'move',
                   'user-select': 'none',
                   'max-width': '100%',
                   'height': 'auto'
                 },
                 attributes: block.get('attributes')
               };
             } else {
               // Create regular text component
               componentConfig = {
                 type: 'default',
                 content: block.get('content'),
                 style: {
                   position: 'absolute',
                   left: `${position.x}px`,
                   top: `${position.y}px`,
                   cursor: 'move',
                   'user-select': 'none'
                 },
                 attributes: block.get('attributes')
               };
             }
             
             // Try adding to wrapper instead of directly to editor
             const wrapper = editor.getWrapper();
             const component = wrapper.append(componentConfig)[0];
             
             // Configure the component for dragging and resizing
             component.set({
               draggable: true,
               resizable: {
                 handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
                 minWidth: 20,
                 minHeight: 20
               }
             });
             
             // Force update the position
             component.addStyle({
               position: 'absolute',
               left: `${position.x}px`,
               top: `${position.y}px`
             });
             
             // Select the new component
             editor.select(component);
           } catch (error) {
             console.error('Error adding component to canvas:', error);
           }
         }
       };
       
       // Attach the click listener
       blockEl.addEventListener('click', blockEl._clickHandler);
     });
   };

   /**
    * Boot GrapesJS once and give the parent a ref.
    *
    * @param {object} opts
    * @param {number} opts.targetWidth   – canvas width  (px)
    * @param {number} opts.targetHeight  – canvas height (px)
    * @param {function} opts.onImagesRefreshed – callback when images are refreshed
    * @returns {object} { editorRef, cropData, setCropData, showCrop }
    */
   export function useGrapesEditor({
     targetWidth = 1920,
     targetHeight = 1080,
     onImagesRefreshed = () => {},
   } = {}) {
     const editorRef = useRef(null);
     const [cropData, setCropData] = useState(null);
     const [showCrop, setShowCrop] = useState(false);
     const [currentRotationHandle, setCurrentRotationHandle] = useState(null);
     const [selectedComponent, setSelectedComponent] = useState(null);
     const [userImages, setUserImages] = useState([]);
     const [imagesLoaded, setImagesLoaded] = useState(false);
     const [currentMode, setCurrentMode] = useState(null);

     useEffect(() => {
       /* guard: only init once */
       if (editorRef.current) return;

       /* start with a clean slate */
       localStorage.removeItem('currentDisplayTemplate');

       /* Get current mode from localStorage */
       const mode = localStorage.getItem('raceDisplayMode');
       setCurrentMode(mode);

       /* ────────── Grapes init ────────── */
       try {
         const editor = grapesjs.init({ 
           ...EDITOR_CONFIG, 
           dragMode: 'absolute',
           // Disable drag functionality for blocks
           blockManager: {
             ...EDITOR_CONFIG.blockManager,
             dragMode: false
           }
         });
         
         // Add safety check for editor initialization
         if (!editor) {
           console.warn('GrapesJS editor failed to initialize');
           return;
         }
         
         editorRef.current = editor;
         
         // Add error handler for SelectComponent errors
         editor.on('error', (error) => {
           if (error.message && error.message.includes('getContainer() is null')) {
             console.warn('GrapesJS SelectComponent error (likely during hot reload):', error);
             return; // Don't throw the error
           }
           console.error('GrapesJS error:', error);
         });
         
       } catch (error) {
         console.error('Failed to initialize GrapesJS editor:', error);
         return;
       }

       /* ────────── Register blocks based on mode ────────── */
       const registerBlocksForMode = (mode) => {
         const blockManager = editorRef.current.BlockManager;
         
         // Safety check: ensure BlockManager is available
         if (!blockManager) {
           return;
         }
         
         // Clear ALL existing blocks (including images - they'll be re-added)
         const existingBlocks = blockManager.getAll();
         if (existingBlocks && Array.isArray(existingBlocks)) {
           existingBlocks.forEach(block => {
             if (block && typeof block.get === 'function') {
               const blockId = block.get('id');
               blockManager.remove(blockId);
             }
           });
         }
         
         // Force a small delay to ensure blocks are cleared
         setTimeout(() => {
           // Get blocks for current mode
           const modeBlocks = getBlocksForMode(mode);
           
           // Safety check: ensure modeBlocks is an array
           if (!modeBlocks || !Array.isArray(modeBlocks)) {
             return;
           }
           
           // Register blocks with click handlers
           modeBlocks.forEach(blockDef => {
             if (blockDef && blockDef.id) {  // Add safety check
               try {
                 blockManager.add(blockDef.id, {
                   id: blockDef.id,
                   label: blockDef.label,
                   content: blockDef.content,
                   category: blockDef.category,
                   attributes: blockDef.attributes
                 });
               } catch (error) {
                 console.error('Error registering block:', blockDef.id, error);
               }
             }
           });
           
           // Force refresh the block manager UI
           if (blockManager.render) {
             blockManager.render();
           }
           
           // Attach click listeners to blocks after rendering
           setTimeout(() => {
             attachBlockClickListeners(editorRef.current, targetWidth, targetHeight);
           }, 100);
           
           // Now load images after blocks are registered
           loadUserImages();
         }, 100);
       };

       /* ────────── <style> injection ────────── */
       const styleEl = document.createElement('style');
       styleEl.textContent = customStyles;
       document.head.appendChild(styleEl);

       /* ────────── Commands ────────── */
       registerCommands(editorRef.current, {
         onSave        : () => {}, // will be set by parent component
         onSaveAs      : () => {}, // will be set by parent component
         onDisplayMode : () => {}, // will be set by parent component
       });

       /* ────────── Style Manager Configuration ────────── */
       // Add Page Background sector and configure wrapper
       const wrapper = editorRef.current.getWrapper();
       editorRef.current.StyleManager.addSector('page-background', {
         name: 'Page Background',
         open: true,
         buildProps: [
           'background-color',
           'background-image',
           'background-size',
           'background-position',
           'background-repeat'
         ],
       });

       // Configure background-image as asset type
       editorRef.current.StyleManager.addProperty('page-background', {
         property: 'background-image',
         type: 'asset',
         full: true,
         functionName: 'url',
         default: 'none',
       });
   
       /* ────────── Load User Images ────────── */
       const loadUserImages = async () => {
         try {
           const images = await fetchUserImages();
           setUserImages(images);
           setImagesLoaded(true);
           
           // Generate and register image blocks
           if (images.length > 0) {
             const imageBlocks = generateImageBlocks(images);
             
             // Wait for editor to be fully loaded before accessing BlockManager
             if (editorRef.current.BlockManager) {
               // Clear existing image blocks
               const blockManager = editorRef.current.BlockManager;
               const existingBlocks = blockManager.getAll();
               if (existingBlocks && Array.isArray(existingBlocks)) {
                 existingBlocks.forEach(block => {
                   if (block && typeof block.get === 'function' && block.get('category') === 'Images') {
                     blockManager.remove(block.get('id'));
                   }
                 });
               }
               
               // Add new image blocks
               imageBlocks.forEach(blockDef => {
                 if (blockDef && blockDef.id) {  // Add safety check
                   try {
                     blockManager.add(blockDef.id, {
                       id: blockDef.id,
                       label: blockDef.label,
                       content: blockDef.content,
                       category: blockDef.category,
                       attributes: blockDef.attributes
                     });
                   } catch (error) {
                     console.error('Error registering image block:', blockDef.id, error);
                   }
                 }
               });
               
               // Attach click listeners to image blocks
               setTimeout(() => {
                 attachBlockClickListeners(editorRef.current, targetWidth, targetHeight);
               }, 100);
               
               onImagesRefreshed(); // Notify parent component
             } else {
               setTimeout(() => {
                 if (editorRef.current.BlockManager) {
                   loadUserImages();
                 }
               }, 100);
             }
           }
         } catch (error) {
           console.error('Failed to load user images:', error);
           setImagesLoaded(true); // Mark as loaded even on error
         }
       };

       /* ────────── Asset Manager Upload Listener ────────── */
       editorRef.current.on('asset:upload:response', (response) => {
         setTimeout(() => {
           loadUserImages();
         }, 500); // Small delay to ensure server has processed the upload
       });

       /* ────────── Listeners (snap, clamp, crop modal) ────────── */
       const sync = makeSyncHandler(targetWidth, targetHeight);
       editorRef.current.on('component:drag:end',   sync);
       editorRef.current.on('component:resize:end', sync);

       /* ────────── Component Configuration ────────── */
       editorRef.current.on('component:add', (component) => {
         // Configure all components for dragging
         component.set({
           draggable: true,
           resizable: {
             handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
             minWidth: 20,
             minHeight: 20
           },
           style: {
             position: 'absolute',
             cursor: 'move',
             'user-select': 'none'
           }
         });

         // Add drag handles
         component.set('traits', [
           {
             type: 'number',
             name: 'top',
             label: 'Top',
             default: 0,
           },
           {
             type: 'number',
             name: 'left',
             label: 'Left',
             default: 0,
           }
         ]);
       });

       /* ────────── Animation Handling ────────── */
       editorRef.current.on('component:update:attributes', (component) => {
         try {
           if (component && typeof component.getId === 'function' && 
               component.view && component.view.el && 
               typeof component.getAttributes === 'function') {
             
             const element = component.view.el;
             const attrs = component.getAttributes();
             const anim = attrs['data-anim'];
             
             if (anim && typeof anim === 'string' && anim.trim() !== '') {
               const duration = parseInt(attrs['data-anim-dur']) || 1000;
               const delay = parseInt(attrs['data-anim-delay']) || 0;
               
               // Sanitize the animation name to remove whitespace for CSS class compatibility
               const sanitizedAnim = anim.trim().replace(/\s+/g, '');
               
               // Preview animation in editor
               element.classList.remove('animate__animated');
               Array.from(element.classList).forEach(className => {
                 if (className.startsWith('animate__')) {
                   element.classList.remove(className);
                 }
               });
               
               element.offsetHeight; // Force reflow
               
               setTimeout(() => {
                 element.style.setProperty('--animate-duration', `${duration}ms`);
                 element.style.setProperty('--animate-delay', `${delay}ms`);
                 element.classList.add('animate__animated', `animate__${sanitizedAnim}`);
               }, 50);
             }
           }
         } catch (error) {
           console.error('Error handling animation update:', error);
         }
       });

       /* ────────── Component Selection Handlers ────────── */
       editorRef.current.on('component:selected', (component) => {
         // Clean up previous rotation handle
         if (currentRotationHandle) {
           currentRotationHandle.remove();
           setCurrentRotationHandle(null);
         }

         setSelectedComponent(component);
         
         // Update component toolbar with animation and alignment buttons
         const updateComponentToolbar = (m) => {
           const tb = [...(m.get('toolbar') || [])];
           const add = (id, command, label) => {
             if (!tb.find(t => t.id === id)) tb.push({ id, command, label });
           };
           add('duplicate', 'core:clone', 'Dup');
           add('delete', 'core:delete', 'Del');
           add('align-l', 'align-left', 'L');
           add('align-c', 'align-center', 'C');
           add('align-r', 'align-right', 'R');
           
           // Add animation test button if component has animation
           const animValue = m.getStyle('data-anim') || (m.getAttributes ? m.getAttributes()['data-anim'] : '');
           if (animValue && typeof animValue === 'string' && animValue.trim() !== '') {
             add('test-anim', 'test-animation', '▶');
           }
           
           if (m.getAttributes && m.getAttributes()['data-placeholder'] === 'message') {
             add('edit-msg', 'edit-custom-message', '✎');
           }
           
           m.set('toolbar', tb);
         };

         updateComponentToolbar(component);
         
         // Load animation values from attributes into CSS styles on selection (for backward compatibility)
         setTimeout(() => {
           if (component) {
             const attrs = component.getAttributes();
             const currentStyles = component.getStyle();
             const animationAttrs = {};
             
             // Only load from attributes if CSS styles don't already have the values
             ['data-anim', 'data-anim-dur', 'data-anim-delay'].forEach(key => {
               const cssValue = currentStyles[key];
               const attrValue = attrs[key];
               
               // Only load from attributes if no CSS value exists
               if ((cssValue === undefined || cssValue === null || cssValue === '') && attrValue !== undefined) {
                 animationAttrs[key] = attrValue;
               }
             });
             
             if (Object.keys(animationAttrs).length > 0) {
               component.addStyle(animationAttrs);
             }
           }
         }, 100);
         
         // Enable dragging and resizing
         component.set('draggable', true);
         component.set('resizable', {
           handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
           minWidth: 20,
           minHeight: 20
         });
         component.set('movable', true);
         
         // Add custom styles for drag handles
         component.addStyle({
           'cursor': 'move',
           'user-select': 'none'
         });
         
         // Create rotation handle
         try {
           if (component && component.view && component.view.el) {
             const element = component.view.el;
             const handle = createRotationHandle(component);
             if (handle) {
               setCurrentRotationHandle(handle);
             }
           }
         } catch (error) {
           console.error('Error creating rotation handle:', error);
         }
       });

       editorRef.current.on('component:deselected', () => {
         // Remove rotation handle
         if (currentRotationHandle) {
           currentRotationHandle.remove();
           setCurrentRotationHandle(null);
         }
         setSelectedComponent(null);
       });

       /* bridge to React crop modal */
       editorRef.current.on('crop-modal:open', () => {
         const data = editorRef.current.get('cropImageData');
         if (data) {
           setCropData(data);
           setShowCrop(true);
         }
       });

       /* tiny cosmetic clean-up: hide Layers panel we CSS-hide anyway */
       setTimeout(() => {
         document.querySelector('.panel__right.gjs-pn-panel.gjs-pn-layers')?.remove();
       }, 100);

       /* ────────── Load images after editor is fully initialized ────────── */
       editorRef.current.on('load', () => {
         // Register blocks for current mode after editor is loaded
         if (mode) {
           registerBlocksForMode(mode);
         } else {
           // Register default blocks (all blocks without mode restriction)
           registerBlocksForMode(null);
         }
       });

       /* ────────── Mutation Observer for Dynamic Blocks ────────── */
       const blocksContainer = document.querySelector('#blocks');
       let observer = null;
       if (blocksContainer) {
         observer = new MutationObserver((mutations) => {
           mutations.forEach((mutation) => {
             if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
               const hasNewBlocks = Array.from(mutation.addedNodes).some(node => 
                 node.nodeType === Node.ELEMENT_NODE && 
                 (node.classList.contains('gjs-block') || node.querySelector('.gjs-block'))
               );
               
               if (hasNewBlocks) {
                 setTimeout(() => {
                   attachBlockClickListeners(editorRef.current, targetWidth, targetHeight);
                 }, 50);
               }
             }
           });
         });
         
         observer.observe(blocksContainer, {
           childList: true,
           subtree: true
         });
       } else {
         console.warn('⚠️ Blocks container not found for mutation observer');
       }

       /* ────────── Cleanup function ────────── */
       return () => {
         try {
           if (editorRef.current) {
             // Remove all event listeners
             editorRef.current.off();
             
             // Destroy the editor
             editorRef.current.destroy();
             editorRef.current = null;
           }
         } catch (error) {
           console.warn('Error during GrapesJS cleanup:', error);
         }
       };
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, []);

     return { editorRef, cropData, setCropData, showCrop, userImages, imagesLoaded };
   }
   