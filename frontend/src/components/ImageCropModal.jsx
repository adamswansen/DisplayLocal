import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropModal.css';

export default function ImageCropModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  targetWidth, 
  targetHeight,
  onCropComplete 
}) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        targetWidth / targetHeight,
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }, [targetWidth, targetHeight]);

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions to target size
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Calculate crop dimensions in pixels
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    // Draw the cropped image
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
        onClose();
      }
    }, 'image/jpeg', 0.95);
  };

  if (!isOpen) return null;

  return (
    <div className="image-crop-modal-backdrop">
      <div className="image-crop-modal">
        <div className="image-crop-modal-header">
          <h2>Crop Image</h2>
          <p>Adjust the crop area to match the target dimensions: {targetWidth} × {targetHeight}</p>
        </div>
        
        <div className="image-crop-modal-content">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={targetWidth / targetHeight}
            className="image-crop-container"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={onImageLoad}
              alt="Crop preview"
            />
          </ReactCrop>
        </div>

        <div className="image-crop-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleCropComplete}
            disabled={!completedCrop}
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
} 