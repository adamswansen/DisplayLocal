/* ──────────────────────────────────────────────────────────────
   useZoom.js
   ------------------------------------------------------------------
   Adds pinch-to-zoom style scaling to the GrapesJS iframe.
   • Keeps the current zoom in React state
   • Exposes zoomIn / zoomOut helpers
   • Automatically reapplies the transform if the editor
     iframe is recreated (e.g. after template load)
   ------------------------------------------------------------------ */

import { useState, useCallback, useEffect } from 'react';

/**
 * @param {React.RefObject} editorRef – ref holding the GrapesJS editor instance
 * @param {object}  [opts]
 * @param {number}  [opts.initial=1]  – starting zoom (1 = 100 %)
 * @param {number}  [opts.min=0.1]    – lower bound
 * @param {number}  [opts.max=3]      – upper bound
 * @param {number}  [opts.step=0.1]   – increment for zoomIn / zoomOut
 */
function useZoom(
  editorRef,
  { initial = 1, min = 0.1, max = 3, step = 0.1 } = {}
) {
  const [zoom, setZoom] = useState(initial);

  /** Write the CSS transform into the iframe <body> */
  const applyZoom = useCallback(
    (val) => {
      const editor = editorRef?.current;
      if (!editor) return;

      const frame = editor.Canvas.getFrameEl();
      if (frame?.contentDocument?.body) {
        frame.contentDocument.body.style.transform       = `scale(${val})`;
        frame.contentDocument.body.style.transformOrigin = 'top left';
      }
    },
    [editorRef]
  );

  /** Get current zoom level from the iframe */
  const getCurrentZoom = useCallback(() => {
    const editor = editorRef?.current;
    if (!editor) return 1;

    const frame = editor.Canvas.getFrameEl();
    if (frame?.contentDocument?.body) {
      const transform = frame.contentDocument.body.style.transform;
      const match = transform.match(/scale\(([^)]+)\)/);
      if (match) {
        return parseFloat(match[1]) || 1;
      }
    }
    return 1;
  }, [editorRef]);

  /** Set zoom and update state */
  const setZoomAndApply = useCallback((val) => {
    const clampedVal = Math.max(min, Math.min(max, val));
    setZoom(clampedVal);
    applyZoom(clampedVal);
  }, [min, max, applyZoom]);

  /** Convenience wrappers */
  const zoomIn  = useCallback(() => setZoomAndApply(zoom + step), [zoom, step, setZoomAndApply]);
  const zoomOut = useCallback(() => setZoomAndApply(zoom - step), [zoom, step, setZoomAndApply]);

  /** Re-apply whenever zoom or editor instance changes */
  useEffect(() => applyZoom(zoom), [zoom, applyZoom]);

  return { 
    zoom, 
    setZoom: setZoomAndApply, 
    zoomIn, 
    zoomOut, 
    applyZoom,
    getCurrentZoom 
  };
}

export { useZoom };
export default useZoom;
   