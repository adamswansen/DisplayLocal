/* ──────────────────────────────────────────────────────────────
   constants.js
   ------------------------------------------------------------------
   Central place for tiny, pure data constants (no side-effects).
   Objects are frozen to prevent accidental run-time mutation in
   strict-mode.
   ------------------------------------------------------------------ */

/** Common screen-size presets for the Dimension Wizard */
export const DIMENSION_PRESETS = Object.freeze([
    Object.freeze({ name: 'Full HD', width: 1920, height: 1080 }),
    Object.freeze({ name: '4K UHD', width: 3840, height: 2160 }),
    Object.freeze({ name: 'HD Ready', width: 1366, height: 768 }),
    Object.freeze({ name: 'iPad', width: 1024, height: 768 }),
  ]);
  
  /* add more project-wide constants here … */
  