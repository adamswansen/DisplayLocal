import React from 'react';
import CanvasBuilder from '../components/CanvasBuilder/CanvasBuilder';

export default function Display() {
  return (
    <div className="container-fluid p-3">
      <div>
        <div className="display-container">
          <CanvasBuilder />
        </div>
      </div>
    </div>
  );
}
