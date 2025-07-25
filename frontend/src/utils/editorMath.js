/* ──────────────────────────────────────────────────────────────
   editorMath.js
   ------------------------------------------------------------------
   Pure math & DOM helpers used by the GrapesJS integration.
   No React, no side-effects (apart from the few DOM helpers
   that intentionally mutate elements passed to them).
   ------------------------------------------------------------------ */

/* ───────────── grid-snap helpers ───────────── */

/** snap a numeric value to 20-pixel grid */
export const snap = (v) => Math.round(Number.parseInt(v, 10) / 20) * 20;

/**
 * Snap a component to the grid
 * @param {Object} model - GrapesJS component model
 */
export function snapComponent(model) {
  if (!model?.getStyle) return;

  const style = model.getStyle() || {};
  const updates = {};

  ['top', 'left', 'width', 'height'].forEach((prop) => {
    const n = Number.parseInt(style[prop], 10);
    if (!Number.isNaN(n)) {
      updates[prop] = `${Math.round(n / 20) * 20}px`;
    }
  });

  if (Object.keys(updates).length > 0) {
    model.addStyle(updates);
  }
}

/**
 * Snap `top`, `left`, `width`, `height` of a GrapesJS Component model.
 * Rotation (`transform`) is left intact.
 */
export function applySnap(model) {
  if (!model?.getStyle) return;

  const style = model.getStyle() || {};
  ['top', 'left', 'width', 'height'].forEach((prop) => {
    const n = Number.parseInt(style[prop], 10);
    if (!Number.isNaN(n)) model.addStyle({ [prop]: `${snap(n)}px` });
  });
}

/**
 * Clamp a component to stay within canvas bounds
 * @param {Object} model - GrapesJS component model
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
export function clampToCanvas(model, canvasWidth, canvasHeight) {
  if (!model?.getStyle) return;

  const style = model.getStyle() || {};
  const updates = {};

  // Clamp position
  const left = Number.parseInt(style.left, 10) || 0;
  const top = Number.parseInt(style.top, 10) || 0;
  const width = Number.parseInt(style.width, 10) || 100;
  const height = Number.parseInt(style.height, 10) || 100;

  // Ensure component doesn't go outside canvas bounds
  if (left < 0) updates.left = '0px';
  if (top < 0) updates.top = '0px';
  if (left + width > canvasWidth) updates.left = `${canvasWidth - width}px`;
  if (top + height > canvasHeight) updates.top = `${canvasHeight - height}px`;

  if (Object.keys(updates).length > 0) {
    model.addStyle(updates);
  }
}

/* ───────────── rotation helpers ───────────── */

/** Read current rotation (deg) from an HTMLElement style */
export const getElementRotation = (el) => {
  const match = (el.style.transform || '').match(/rotate\(([-\d.]+)deg\)/);
  return match ? Number.parseFloat(match[1]) : 0;
};

/** Replace/append a rotate() in element.style.transform */
export function setElementRotation(el, angleDeg) {
  const base = (el.style.transform || '').replace(/rotate\([^)]*\)/, '').trim();
  el.style.transform = `${base} rotate(${angleDeg}deg)`.trim();
}

/* ───────────── rotation handle helpers ───────────── */

/** <div class="rotate-handle"/> used by interact.js */
export const createRotationHandle = (component) => {
  const h = document.createElement('div');
  h.className = 'rotate-handle';
  
  // Safely get component ID
  let componentId = '';
  if (component && typeof component.getId === 'function') {
    componentId = component.getId();
  } else if (component && component.id) {
    componentId = component.id;
  } else if (component && component.cid) {
    componentId = component.cid;
  }
  
  h.dataset.componentId = componentId;
  return h;
};

/**
 * Position the rotation handle in the main document.
 * (Works even though the component lives inside the GrapesJS iframe.)
 */
export function positionRotationHandle(handle, componentEl) {
  if (!handle || !componentEl) return;

  try {
    const rect       = componentEl.getBoundingClientRect();
    const iframe     = document.querySelector('#gjs iframe');
    if (!iframe) return;
    const iframeRect = iframe.getBoundingClientRect();

    handle.style.left = `${iframeRect.left + rect.left + rect.width / 2 - 5}px`;
    handle.style.top  = `${iframeRect.top  + rect.top  - 15}px`;
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.warn('positionRotationHandle →', err);
  }
}

/* ───────────── block helper ───────────── */

/**
 * Shallow-copies a GrapesJS Block definition and forces absolute
 * positioning + "move" cursor so every block dropped into the canvas
 * behaves consistently.
 */
export const configureBlock = (block) => ({
  ...block,
  content   : block.content,
  attributes: {
    ...block.attributes,
    class : 'gjs-block',
    title : block.attributes?.title || 'Drag to add',
  },
  style: {
    position   : 'absolute',
    cursor     : 'move',
    userSelect : 'none',
  },
});

/* ───────────── animation attribute sync ───────────── */

/**
 * For backward compatibility: ensure data-anim* attributes are present
 * when the values exist in CSS styles (or vice-versa).
 */
export function forceAnimationAttributeSync(component) {
  if (!component) return;

  const attrs = {};
  ['data-anim', 'data-anim-dur', 'data-anim-delay'].forEach((key) => {
    let val = component.getStyle(key);
    if (val == null || val === '') val = component.getAttributes()[key];
    if (val != null && val !== '') {
      // Ensure the value is properly converted to a string
      if (typeof val === 'object') {
        // Handle object values by converting to string
        attrs[key] = val.toString();
      } else {
        attrs[key] = String(val);
      }
    }
  });

  if (Object.keys(attrs).length) component.addAttributes(attrs);
}
