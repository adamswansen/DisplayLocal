/* ──────────────────────────────────────────────────────────────
   commands.js
   ------------------------------------------------------------------
   GrapesJS custom command registrations.
   Usage in CanvasBuilder (after editor init):

     import { registerCommands } from '../grapes/commands';

     registerCommands(editor, {
       onSave        : handleSave,
       onSaveAs      : handleSaveAs,
       onDisplayMode : handleDisplayMode,
     });
   ------------------------------------------------------------------ */

/** Helper: remove GrapesJS +animate.css classes then add new ones */
function previewAnimateCSS(element, anim, duration, delay) {
  element.classList.remove('animate__animated');
  [...element.classList].forEach((c) => c.startsWith('animate__') && element.classList.remove(c));
  element.style.removeProperty('--animate-duration');
  element.style.removeProperty('--animate-delay');
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  element.offsetHeight;

  // Sanitize the animation name to remove whitespace for CSS class compatibility
  const sanitizedAnim = anim.trim().replace(/\s+/g, '');

  element.style.setProperty('--animate-duration', `${duration}ms`);
  element.style.setProperty('--animate-delay', `${delay}ms`);
  element.classList.add('animate__animated', `animate__${sanitizedAnim}`);

  /** auto-clean when animation finishes */
  setTimeout(() => {
    element.classList.remove('animate__animated', `animate__${sanitizedAnim}`);
  }, duration + delay + 100);
}

function registerCommands(
  editor,
  {
    onSave        = () => console.warn('onSave not supplied'),
    onSaveAs      = () => console.warn('onSaveAs not supplied'),
    onDisplayMode = () => console.warn('onDisplayMode not supplied'),
  } = {},
) {
  /* ───── template CRUD wrappers ───── */
  editor.Commands.add('save-template',     { run: () => onSave() });
  editor.Commands.add('save-as-template',  { run: () => onSaveAs() });
  editor.Commands.add('fullscreen',        { run: () => onDisplayMode() });

  /* ───── simple text-align helpers ───── */
  editor.Commands.add('align-left',   {
    run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'left' }); },
  });
  editor.Commands.add('align-center', {
    run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'center' }); },
  });
  editor.Commands.add('align-right',  {
    run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'right' }); },
  });

  /* ───── inline "edit custom message" prompt ───── */
  editor.Commands.add('edit-custom-message', {
    run(ed) {
      const comp = ed.getSelected();
      if (!comp) return;
      const current = comp.getAttributes()['data-messages'] || '';
      const value   = window.prompt('Custom messages (comma separated)', current);
      if (value !== null) comp.addAttributes({ 'data-messages': value });
    },
  });

  /* ───── live animation preview ───── */
  editor.Commands.add('test-animation', {
    run(ed) {
      const comp = ed.getSelected();
      if (!comp?.view?.el) return;

      const anim     = comp.getStyle('data-anim')      || comp.getAttributes()['data-anim']      || '';
      const duration = parseInt(comp.getStyle('data-anim-dur')   || comp.getAttributes()['data-anim-dur']   || '1000', 10);
      const delay    = parseInt(comp.getStyle('data-anim-delay') || comp.getAttributes()['data-anim-delay'] || '0',    10);

      if (!anim) {
        window.alert('No animation set on this element.\nAdd one in the Animation tab first.');
        return;
      }

      /* keep attributes in sync for runtime use */
      comp.addAttributes({
        'data-anim'      : anim,
        'data-anim-dur'  : String(duration),
        'data-anim-delay': String(delay),
      });

      previewAnimateCSS(comp.view.el, anim, duration, delay);
    },
  });
}

export { registerCommands };
export default registerCommands;
