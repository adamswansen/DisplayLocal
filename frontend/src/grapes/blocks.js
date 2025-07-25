/* ──────────────────────────────────────────────────────────────
   blocks.js
   ------------------------------------------------------------------
   GrapesJS custom block definitions.
   ------------------------------------------------------------------ */

   export const blocks = [
    { 
      id: 'name', 
      label: 'Name', 
      content: '<span data-placeholder="name">{{name}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Name' } 
    },
    { 
      id: 'first_name', 
      label: 'First Name', 
      content: '<span data-placeholder="first_name">{{first_name}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add First Name' } 
    },
    { 
      id: 'last_name', 
      label: 'Last Name', 
      content: '<span data-placeholder="last_name">{{last_name}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Last Name' } 
    },
    { 
      id: 'age', 
      label: 'Age', 
      content: '<span data-placeholder="age">{{age}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Age' } 
    },
    { 
      id: 'gender', 
      label: 'Gender', 
      content: '<span data-placeholder="gender">{{gender}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Gender' } 
    },
    { 
      id: 'city', 
      label: 'City', 
      content: '<span data-placeholder="city">{{city}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add City' } 
    },
    { 
      id: 'state', 
      label: 'State', 
      content: '<span data-placeholder="state">{{state}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add State' } 
    },
    { 
      id: 'country', 
      label: 'Country', 
      content: '<span data-placeholder="country">{{country}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Country' } 
    },
    { 
      id: 'division', 
      label: 'Division', 
      content: '<span data-placeholder="division">{{division}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Division' } 
    },
    { 
      id: 'team_name', 
      label: 'Team Name', 
      content: '<span data-placeholder="team_name">{{team_name}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Team Name' } 
    },
    { 
      id: 'custom-message', 
      label: 'Custom Message', 
      content: '<span data-placeholder="message">{{message}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Custom Message' } 
    },
    
    // Timing blocks available only in pre-race mode
    { 
      id: 'pace', 
      label: 'Pace', 
      content: '<span data-placeholder="pace">{{pace}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Pace' },
      mode: 'pre-race'
    },
    { 
      id: 'gun_pace', 
      label: 'Gun Pace', 
      content: '<span data-placeholder="gun_pace">{{gun_pace}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Gun Pace' },
      mode: 'pre-race'
    },
    { 
      id: 'chip_time', 
      label: 'Chip Time', 
      content: '<span data-placeholder="chip_time">{{chip_time}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Chip Time' },
      mode: 'pre-race'
    },
    { 
      id: 'gun_time', 
      label: 'Gun Time', 
      content: '<span data-placeholder="gun_time">{{gun_time}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Gun Time' },
      mode: 'pre-race'
    },
    { 
      id: 'overall_rank', 
      label: 'Overall Rank', 
      content: '<span data-placeholder="overall_rank">{{overall_rank}}</span>', 
      category: 'Race Data',
      attributes: { class: 'gjs-block', title: 'Click to add Overall Rank' },
      mode: 'pre-race'
    },
    
    // Results mode blocks (final results only)
    { 
      id: 'net_time', 
      label: 'Net Time', 
      content: '<span data-placeholder="finish_time">{{finish_time}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Net Time' },
      mode: 'results'
    },
    { 
      id: 'gross_time', 
      label: 'Gross Time', 
      content: '<span data-placeholder="gun_time">{{gun_time}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Gross Time' },
      mode: 'results'
    },
    { 
      id: 'finish_rank', 
      label: 'Finish Rank', 
      content: '<span data-placeholder="overall_rank">{{overall_rank}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Finish Rank' },
      mode: 'results'
    },
    { 
      id: 'division_rank', 
      label: 'Division Rank', 
      content: '<span data-placeholder="division_rank">{{division_rank}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Division Rank' },
      mode: 'results'
    },
    { 
      id: 'pace_per_mile', 
      label: 'Pace per Mile', 
      content: '<span data-placeholder="pace">{{pace}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Pace per Mile' },
      mode: 'results'
    },
    { 
      id: 'gun_pace_per_mile', 
      label: 'Gun Pace per Mile', 
      content: '<span data-placeholder="gun_pace">{{gun_pace}}</span>', 
      category: 'Results',
      attributes: { class: 'gjs-block', title: 'Click to add Gun Pace per Mile' },
      mode: 'results'
    }
    // Note: Image blocks are now generated dynamically from user uploads
   ];
   
   /**
    * Get blocks filtered by mode
    * @param {string} mode - 'pre-race' or 'results'
    * @returns {Array} Array of block definitions for the specified mode
    */
   export function getBlocksForMode(mode) {
     console.log('getBlocksForMode called with mode:', mode);
     if (!mode) {
       console.log('No mode specified, returning all blocks');
       return blocks;
     }
     
     const filteredBlocks = blocks.filter(block => {
       // If block has no mode specified, include it in all modes
       if (!block.mode) {
         return true;
       }
       // Otherwise, only include if mode matches
       return block.mode === mode;
     });
     
     console.log(`Filtered ${filteredBlocks.length} blocks for ${mode} mode`);
     return filteredBlocks;
   }
   
   /**
    * Generate image blocks from user images
    * @param {Array} userImages - Array of user image objects
    * @returns {Array} Array of image block definitions
    */
   export function generateImageBlocks(userImages) {
     if (!userImages || !Array.isArray(userImages)) {
       return [];
     }
   
     return userImages.map(image => ({
       id: image.id,
       label: `
         <div class="gjs-block-image" data-image-id="${image.id}">
           <div class="image-block-thumbnail">
             <img src="${image.thumbnail}" alt="${image.displayName}" class="image-block-thumbnail-img" />
           </div>
           <div class="image-block-label">${image.displayName}</div>
           <div class="image-block-dimensions">${image.dimensions.width} × ${image.dimensions.height}</div>
         </div>
       `,
       content: `<img src="${image.url}" alt="${image.displayName}" style="max-width: 100%; height: auto;" />`,
       category: 'Images',
       attributes: { 
         class: 'gjs-block', 
         title: `Click to add ${image.displayName}`,
         'data-image-url': image.url,
         'data-image-dimensions': JSON.stringify(image.dimensions),
         'data-image-filename': image.filename,
         'data-image-id': image.id
       }
     }));
   }
   
   export default blocks; 