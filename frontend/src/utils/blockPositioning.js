/* ──────────────────────────────────────────────────────────────
   blockPositioning.js
   ------------------------------------------------------------------
   Helper functions for calculating drop positions in the canvas.
   ------------------------------------------------------------------ */

/**
 * Calculate the drop position for a component
 * @param {Object} component - The component being dropped
 * @param {Object} editor - GrapesJS editor instance
 * @returns {Object} Position object with x, y coordinates
 */
export function calculateDropPosition(component, editor) {
  // Default implementation - can be enhanced later
  return {
    x: 0,
    y: 0
  };
} 