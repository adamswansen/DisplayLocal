/* ──────────────────────────────────────────────────────────────
   blocks.js
   ------------------------------------------------------------------
   GrapesJS custom block definitions.
   ------------------------------------------------------------------ */

   export const blocks = [
  { 
    id: 'name', 
    label: 'Name', 
    content: '<span data-placeholder="name" data-block-type="name">{{name}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-name', title: 'Click to add Name' } 
  },
  { 
    id: 'first_name', 
    label: 'First Name', 
    content: '<span data-placeholder="first_name" data-block-type="first_name">{{first_name}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-first-name', title: 'Click to add First Name' } 
  },
  { 
    id: 'last_name', 
    label: 'Last Name', 
    content: '<span data-placeholder="last_name" data-block-type="last_name">{{last_name}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-last-name', title: 'Click to add Last Name' } 
  },
  { 
    id: 'age', 
    label: 'Age', 
    content: '<span data-placeholder="age" data-block-type="age">{{age}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-age', title: 'Click to add Age' } 
  },
  { 
    id: 'gender', 
    label: 'Gender', 
    content: '<span data-placeholder="gender" data-block-type="gender">{{gender}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-gender', title: 'Click to add Gender' } 
  },
  { 
    id: 'city', 
    label: 'City', 
    content: '<span data-placeholder="city" data-block-type="city">{{city}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-city', title: 'Click to add City' } 
  },
  { 
    id: 'state', 
    label: 'State', 
    content: '<span data-placeholder="state" data-block-type="state">{{state}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-state', title: 'Click to add State' } 
  },
  { 
    id: 'country', 
    label: 'Country', 
    content: '<span data-placeholder="country" data-block-type="country">{{country}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-country', title: 'Click to add Country' } 
  },
  { 
    id: 'division', 
    label: 'Division', 
    content: '<span data-placeholder="division" data-block-type="division">{{division}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-division', title: 'Click to add Division' } 
  },
  { 
    id: 'team_name', 
    label: 'Team Name', 
    content: '<span data-placeholder="team_name" data-block-type="team_name">{{team_name}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-team-name', title: 'Click to add Team Name' } 
  },
  { 
    id: 'custom-message', 
    label: 'Custom Message', 
    content: '<span data-placeholder="message" data-block-type="custom_message">{{message}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-custom-message', title: 'Click to add Custom Message' } 
  },
    
      // Timing blocks available only in pre-race mode
  { 
    id: 'pace', 
    label: 'Pace', 
    content: '<span data-placeholder="pace" data-block-type="pace">{{pace}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-pace', title: 'Click to add Pace' },
    mode: 'pre-race'
  },
  { 
    id: 'gun_pace', 
    label: 'Gun Pace', 
    content: '<span data-placeholder="gun_pace" data-block-type="gun_pace">{{gun_pace}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-gun-pace', title: 'Click to add Gun Pace' },
    mode: 'pre-race'
  },
  { 
    id: 'chip_time', 
    label: 'Chip Time', 
    content: '<span data-placeholder="chip_time" data-block-type="chip_time">{{chip_time}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-chip-time', title: 'Click to add Chip Time' },
    mode: 'pre-race'
  },
  { 
    id: 'gun_time', 
    label: 'Gun Time', 
    content: '<span data-placeholder="gun_time" data-block-type="gun_time">{{gun_time}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-gun-time', title: 'Click to add Gun Time' },
    mode: 'pre-race'
  },
  { 
    id: 'overall_rank', 
    label: 'Overall Rank', 
    content: '<span data-placeholder="overall_rank" data-block-type="overall_rank">{{overall_rank}}</span>', 
    category: 'Race Data',
    attributes: { class: 'gjs-block block-overall-rank', title: 'Click to add Overall Rank' },
    mode: 'pre-race'
  },
  
  // Results mode blocks (final results only)
  { 
    id: 'net_time', 
    label: 'Net Time', 
    content: '<span data-placeholder="finish_time" data-block-type="net_time">{{finish_time}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-net-time', title: 'Click to add Net Time' },
    mode: 'results'
  },
  { 
    id: 'gross_time', 
    label: 'Gross Time', 
    content: '<span data-placeholder="gun_time" data-block-type="gross_time">{{gun_time}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-gross-time', title: 'Click to add Gross Time' },
    mode: 'results'
  },
  { 
    id: 'finish_rank', 
    label: 'Finish Rank', 
    content: '<span data-placeholder="overall_rank" data-block-type="finish_rank">{{overall_rank}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-finish-rank', title: 'Click to add Finish Rank' },
    mode: 'results'
  },
  { 
    id: 'division_rank', 
    label: 'Division Rank', 
    content: '<span data-placeholder="division_rank" data-block-type="division_rank">{{division_rank}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-division-rank', title: 'Click to add Division Rank' },
    mode: 'results'
  },
  { 
    id: 'pace_per_mile', 
    label: 'Pace per Mile', 
    content: '<span data-placeholder="pace" data-block-type="pace_per_mile">{{pace}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-pace-per-mile', title: 'Click to add Pace per Mile' },
    mode: 'results'
  },
  { 
    id: 'gun_pace_per_mile', 
    label: 'Gun Pace per Mile', 
    content: '<span data-placeholder="gun_pace" data-block-type="gun_pace_per_mile">{{gun_pace}}</span>', 
    category: 'Results',
    attributes: { class: 'gjs-block block-gun-pace-per-mile', title: 'Click to add Gun Pace per Mile' },
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