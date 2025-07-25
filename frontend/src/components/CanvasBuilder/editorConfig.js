/* ──────────────────────────────────────────────────────────────
   editorConfig.js
   ------------------------------------------------------------------
   Pure data module: central GrapesJS boot-strap configuration.
   • No DOM / window access.
   • Frozen on export so accidental runtime mutation throws in strict-mode.
   ------------------------------------------------------------------ */

   const EDITOR_CONFIG = {
    /* Mount point & basic frame */
    container: '#gjs',
    height   : '100%',
    storageManager : false,
  
    /* Enable absolute-layout authoring */
    draggable : true,
    resizable : true,
  
    /* Canvas wrapper element defaults */
    wrapper: {
      removable : false,
      copyable  : false,
      draggable : false,
      style: {
        'min-height': '100%',
        height      : '100%',
        margin      : 0,
        padding     : 0,
        position    : 'relative',
      },
    },
  
    /* Two built-in device views               */
    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Mobile',  width: '320px', widthMedia: '480px' },
      ],
    },
  
    /* External CSS / JS injected into iframe  */
    canvas: {
      styles: [
        'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
        {
          /* ensure <body> fills the frame */
          selectors: ['body'],
          style: {
            'min-height': '100%',
            height      : '100%',
            margin      : 0,
            padding     : 0,
            position    : 'relative',
          },
        },
      ],
      scripts: [
        'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
      ],
      customBadgeLabel: false,
      enableSelection: true,
      enableDragging : true,
      enableResizing : true,
      dragMode       : 'absolute',
    },
  
    /* Hide default Layers panel (still needed for a11y) */
    layerManager: {
      appendTo : '.layers-container',
      container: '.panel__right',
      wrapper  : false,
      panel    : false,
    },
  
    panels: {
      defaults: [
        {
          id       : 'layers',
          el       : '.panel__right',
          buttons  : [],
          appendTo : '.panel__right',
          visible  : true,
          header   : false,
          resizable: false,
          panel    : false,
        },
      ],
    },
  
    /* Asset uploads handled server-side */
    assetManager: {
      upload     : '/api/upload-image',
      uploadName : 'files',
      uploadPath : '/static/uploads/',
      assets     : [],
    },
  
    /* Style Manager sectors & custom props */
    styleManager: {
      appendTo: '#style',
      sectors : [
        /* TEXT SECTOR -------------------------------------------------- */
        {
          name : 'Text',
          open : false,
          buildProps : [
            'font-family', 'font-size', 'font-weight', 'font-style',
            'letter-spacing', 'color', 'line-height',
            'text-align', 'text-decoration', 'text-shadow',
          ],
          properties: [
            {
              property : 'font-family',
              type     : 'select',
              defaults : 'Arial, Helvetica, sans-serif',
              options  : [
                { name: 'Arial',            value: 'Arial, Helvetica, sans-serif' },
                { name: 'Helvetica',        value: 'Helvetica, sans-serif' },
                { name: 'Times New Roman',  value: '"Times New Roman", serif' },
                { name: 'Georgia',          value: 'Georgia, serif' },
                { name: 'Courier New',      value: '"Courier New", monospace' },
                { name: 'Verdana',          value: 'Verdana, sans-serif' },
                { name: 'Montserrat',       value: '"Montserrat", sans-serif' },
                { name: 'Impact',           value: 'impact, sans-serif' },
                { name: 'inherit',          value: 'inherit' },
              ],
            },
            {
              property : 'font-style',
              type     : 'select',
              defaults : 'normal',
              options  : [
                { name: 'Normal',  value: 'normal'  },
                { name: 'Italic',  value: 'italic'  },
                { name: 'Oblique', value: 'oblique' },
              ],
            },
          ],
        },
  
        /* BACKGROUND --------------------------------------------------- */
        {
          name      : 'Background',
          open      : false,
          buildProps: [
            'background-color', 'background-image', 'background-repeat',
            'background-position', 'background-size', 'background-attachment',
          ],
        },
  
        /* TRANSFORM ---------------------------------------------------- */
        {
          name      : 'Transform',
          open      : false,
          buildProps: ['transform'],
        },
  
        /* ANIMATION (custom CSS props) --------------------------------- */
        {
          name : 'Animation',
          open : true,
          buildProps: ['data-anim', 'data-anim-dur', 'data-anim-delay'],
          properties: [
            {
              property   : 'data-anim',
              type       : 'select',
              defaults   : '',
              label      : 'Animation Type',
              changeProp : 1,
              options    : [
                { value:'',            name:'None' },
                { value:'fadeIn',      name:'Fade In' },
                { value:'fadeInDown',  name:'Fade In Down' },
                { value:'fadeInUp',    name:'Fade In Up' },
                { value:'fadeInLeft',  name:'Fade In Left' },
                { value:'fadeInRight', name:'Fade In Right' },
                { value:'slideInLeft', name:'Slide In Left' },
                { value:'slideInRight',name:'Slide In Right' },
                { value:'slideInUp',   name:'Slide In Up' },
                { value:'slideInDown', name:'Slide In Down' },
                { value:'zoomIn',      name:'Zoom In' },
                { value:'zoomInUp',    name:'Zoom In Up' },
                { value:'zoomInDown',  name:'Zoom In Down' },
                { value:'bounceIn',    name:'Bounce In' },
                { value:'bounceInUp',  name:'Bounce In Up' },
                { value:'bounceInDown',name:'Bounce In Down' },
                { value:'rotateIn',    name:'Rotate In' },
                { value:'flipInX',     name:'Flip In X' },
                { value:'flipInY',     name:'Flip In Y' },
              ],
            },
            {
              property : 'data-anim-dur',
              type     : 'number',
              defaults : 1000,
              min      : 100,
              max      : 5000,
              step     : 100,
              label    : 'Duration (ms)',
              changeProp: 1,
            },
            {
              property : 'data-anim-delay',
              type     : 'number',
              defaults : 0,
              min      : 0,
              max      : 5000,
              step     : 100,
              label    : 'Delay (ms)',
              changeProp: 1,
            },
          ],
        },
      ],
    },
  
    /* Block Manager Configuration */
    blockManager: {
      appendTo: '#blocks',
      blocks: [], // Empty array - blocks will be registered at runtime based on mode
      // Disable drag functionality for blocks
      dragMode: false,
    },
  };
  
  /* Freeze so later mutation throws (helps catch accidental edits) */
  const frozenConfig = Object.freeze(EDITOR_CONFIG);
  
  export { frozenConfig as EDITOR_CONFIG };
  export default frozenConfig;
  