/* ──────────────────────────────────────────────────────────────
   animationSync.js
   ------------------------------------------------------------------
   Ensures animation attributes are properly synchronized before export.
   ------------------------------------------------------------------ */

/**
 * Force animation attribute synchronization on a component
 * @param {Object} component - GrapesJS component
 */
export function forceAnimationAttributeSync(component) {
  if (!component) return;
  const attrs = {};
  
  ['data-anim', 'data-anim-dur', 'data-anim-delay'].forEach(key => {
    // Get from component's CSS styles (now that animations are CSS properties)
    let value = component.getStyle(key);
    
    // Fallback to attributes for backward compatibility
    if (value === undefined || value === null || value === '') {
      value = component.getAttributes()[key];
    }
    
    if (value !== undefined && value !== null && value !== '') {
      // Ensure the value is properly converted to a string
      if (typeof value === 'object') {
        // Handle object values by converting to string
        attrs[key] = value.toString();
      } else {
        attrs[key] = String(value);
      }
    }
  });
  
  if (Object.keys(attrs).length) {
    component.addAttributes(attrs);
    console.log('Animation sync - CSS styles to attributes:', attrs);
  }
} 