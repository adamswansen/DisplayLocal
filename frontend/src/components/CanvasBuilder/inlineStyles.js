/* ──────────────────────────────────────────────────────────────
   inlineStyles.js
   ------------------------------------------------------------------
   All component-scoped CSS that GrapesJS should inject into the
   editor's parent document.  Imported by CanvasBuilder and appended
   via <style>.
   ------------------------------------------------------------------ */

   const customStyles = `
   /* Hide right panel (Layers) that we don't use */
   .panel__right.gjs-pn-panel.gjs-pn-layers {
     display: none !important;
   }
   
   /* ───────── Dimension Wizard ───────── */
   .dimension-wizard-backdrop {
     position: fixed;
     inset: 0;
     background: rgba(0,0,0,0.5);
     display: flex;
     align-items: center;
     justify-content: center;
     z-index: 9999;
   }
   
   .dimension-wizard-modal {
     background  : #fff;
     border-radius: 8px;
     padding     : 2rem;
     min-width   : 400px;
     box-shadow  : 0 4px 20px rgba(0,0,0,.15);
   }
   
   .dimension-wizard-title       { font-size:1.5rem; font-weight:600; text-align:center; margin-bottom:1rem; color:#333; }
   .dimension-wizard-description { text-align:center; line-height:1.5; margin-bottom:2rem; color:#666; }
   
   .dimension-input-group {
     display:flex; gap:1rem; align-items:center; justify-content:center; margin-bottom:2rem;
   }
   
   .dimension-input {
     width:100px; padding:.5rem;
     border:2px solid #ddd; border-radius:4px;
     text-align:center; font-size:1rem;
   }
   .dimension-input:focus { outline:none; border-color:#007bff; }
   
   .dimension-presets {
     margin-bottom:1.5rem;
   }
   .dimension-presets-title { font-weight:500; text-align:center; margin-bottom:.5rem; color:#333; }
   .dimension-presets-grid {
     display:grid;
     grid-template-columns:repeat(2,1fr);
     gap:.5rem;
   }
   .dimension-preset-btn {
     padding:.5rem; background:#f8f9fa; border:1px solid #ddd; border-radius:4px;
     font-size:.9rem; cursor:pointer; transition:.2s;
   }
   .dimension-preset-btn:hover { background:#e9ecef; border-color:#adb5bd; }
   
   .dimension-wizard-buttons {
     display: flex;
     justify-content: center;
     gap: 1rem;
     margin-top: 1.5rem;
   }
   
   /* ───────── Image status badge on block thumbnails ───────── */
   .image-status-badge {
     position:absolute; top:8px; right:8px; width:24px; height:24px;
     border-radius:50%; display:flex; align-items:center; justify-content:center;
     font-size:14px; color:#fff; box-shadow:0 2px 4px rgba(0,0,0,.2);
   }
   .image-status-badge.native  { background:#28a745; } /* ✓ perfectly sized */
   .image-status-badge.cropped { background:#fd7e14; } /* ⚠ cropped */
   
   /* Ensure custom thumbnail wrapper is position:relative */
   .gjs-block[data-type="image"] { position:relative; }
   
   /* ───────── Rotate handle ───────── */
   .rotate-handle {
     position:absolute;
     width:10px; height:10px;
     border:1px solid #007bff; background:#007bff;
     border-radius:50%; cursor:grab; z-index:1000; pointer-events:all;
     box-shadow:0 1px 3px rgba(0,0,0,.3);
   }
   .rotate-handle:hover   { background:#0056b3; border-color:#0056b3; transform:scale(1.2); }
   .rotate-handle:active  { cursor:grabbing; }
   `;
   
   export default customStyles; 