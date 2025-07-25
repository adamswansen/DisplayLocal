/* ──────────────────────────────────────────────────────────────
   imageService.js
   ------------------------------------------------------------------
   Service for fetching and managing user images from the backend.
   Handles API calls to get user images with thumbnails and metadata.
   ------------------------------------------------------------------ */

/**
 * Fetch all user images from the backend
 * @returns {Promise<Array>} Array of image objects with metadata
 */
export async function fetchUserImages() {
  try {
    const response = await fetch('/api/user-images');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.images || [];
  } catch (error) {
    console.error('Failed to fetch user images:', error);
    return [];
  }
}

/**
 * Generate a clean display name from filename
 * @param {string} filename - The original filename
 * @returns {string} Clean display name
 */
export function generateDisplayName(filename) {
  if (!filename) return 'Unknown Image';
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Replace underscores and hyphens with spaces
  const cleanName = nameWithoutExt.replace(/[_-]/g, ' ');
  
  // Capitalize each word
  return cleanName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get image category based on filename or dimensions
 * @param {Object} image - Image object with metadata
 * @returns {string} Category name
 */
export function getImageCategory(image) {
  const { filename, dimensions } = image;
  const lowerFilename = filename.toLowerCase();
  
  // Check for logo files
  if (lowerFilename.includes('logo') || lowerFilename.includes('brand')) {
    return 'Logos';
  }
  
  // Check for background files
  if (lowerFilename.includes('bg') || lowerFilename.includes('background')) {
    return 'Backgrounds';
  }
  
  // Categorize by aspect ratio
  if (dimensions && dimensions.width && dimensions.height) {
    const ratio = dimensions.width / dimensions.height;
    
    if (ratio > 2) {
      return 'Wide Images';
    } else if (ratio < 0.5) {
      return 'Tall Images';
    } else if (Math.abs(ratio - 1) < 0.1) {
      return 'Square Images';
    }
  }
  
  return 'Other Images';
}

/**
 * Group images by category
 * @param {Array} images - Array of image objects
 * @returns {Object} Images grouped by category
 */
export function groupImagesByCategory(images) {
  const grouped = {};
  
  images.forEach(image => {
    const category = getImageCategory(image);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(image);
  });
  
  return grouped;
} 