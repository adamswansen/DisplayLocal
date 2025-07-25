/* ──────────────────────────────────────────────────────────────
   imageDrop.js
   ------------------------------------------------------------------
   Handles image dropping from the block manager into the canvas.
   Triggers crop modal for image processing.
   ------------------------------------------------------------------ */

/**
 * Handle image block drops - triggers crop modal
 * @param {Object} component - The dropped component
 * @param {Object} editor - GrapesJS editor instance
 */
export function handleImageDrop(component, editor) {
  console.log('Image dropped:', component);
  
  // Get the target component (where the image was dropped)
  const target = component;
  
  // Get image data from the block attributes
  const imageUrl = component.getAttributes()?.['data-image-url'];
  const imageDimensions = component.getAttributes()?.['data-image-dimensions'];
  const imageFilename = component.getAttributes()?.['data-image-filename'];
  
  if (!imageUrl) {
    console.error('No image URL found in component attributes');
    return true;
  }
  
  // Parse dimensions if they exist
  let dimensions = { width: 0, height: 0 };
  if (imageDimensions) {
    try {
      dimensions = JSON.parse(imageDimensions);
    } catch (e) {
      console.error('Failed to parse image dimensions:', e);
    }
  }
  
  // Get target dimensions from the canvas
  const wrapper = editor.getWrapper();
  const targetWidth = parseInt(wrapper.getAttributes()?.['data-design-w']) || 1920;
  const targetHeight = parseInt(wrapper.getAttributes()?.['data-design-h']) || 1080;
  
  console.log('Target dimensions:', targetWidth, 'x', targetHeight);
  console.log('Image dimensions:', dimensions.width, 'x', dimensions.height);
  
  // Check if this is a layout root component
  if (target && target.get('classes') && target.get('classes').includes('layout-root')) {
    const targetRatio = targetWidth / targetHeight;
    const imageRatio = dimensions.width / dimensions.height;
    
    console.log('Aspect ratios - Target:', targetRatio, 'Image:', imageRatio);
    
    // Task 2A: Exact dimension match
    if (dimensions.width === targetWidth && dimensions.height === targetHeight) {
      console.log('Exact dimension match - applying image directly');
      
      target.setStyle({
        'background-image': `url(${imageUrl})`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat'
      });

      target.addAttributes({
        'data-original-width': dimensions.width,
        'data-original-height': dimensions.height,
        'data-bg-native': 'true',
        'data-image-source': imageUrl
      });

      return false; // Don't prevent the drop
    }
    
    // Task 2B: Larger with matching aspect ratio
    if (dimensions.width >= targetWidth && 
        dimensions.height >= targetHeight && 
        Math.abs(targetRatio - imageRatio) < 0.01) {
      
      console.log('Larger image with matching aspect ratio - opening crop modal');
      
      // Store the data in the editor for the component to access
      editor.set('cropImageData', {
        imageUrl: imageUrl,
        targetWidth,
        targetHeight,
        target
      });
      
      // Trigger a custom event that the component can listen for
      editor.trigger('crop-modal:open');
      return true; // Prevent the drop, handle via crop modal
    }
    
    // Task 2C: Aspect mismatch or too small
    console.log('Image dimensions or aspect ratio mismatch');
    alert(`Image must be ${targetWidth}×${targetHeight} or larger with same ratio.`);
    return true; // Prevent the drop
  }
  
  // If not a layout root, create a regular image component
  console.log('Creating regular image component');
  
  // Create a new image component
  const imageComponent = editor.addComponent({
    type: 'image',
    src: imageUrl,
    alt: imageFilename || 'Image',
    style: {
      'max-width': '100%',
      'height': 'auto'
    }
  });
  
  // Position the image component at the drop location
  if (component.view && component.view.el) {
    const rect = component.view.el.getBoundingClientRect();
    const canvasRect = editor.getCanvas().getElement().getBoundingClientRect();
    
    const left = rect.left - canvasRect.left;
    const top = rect.top - canvasRect.top;
    
    imageComponent.setStyle({
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`
    });
  }
  
  return false; // Don't prevent the drop
} 