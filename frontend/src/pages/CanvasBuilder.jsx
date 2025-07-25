import React from 'react';
import useGrapesEditor from '../hooks/useGrapesEditor';
import CanvasBuilder from '../components/CanvasBuilder/CanvasBuilder';
/*import CanvasToolbar from '../components/CanvasToolbar';
import DimensionWizard from '../components/DimensionWizard';
import CanvasRightPanel from '../components/CanvasRightPanel';
import ImageCropModal from '../components/ImageCropModal';
import MessageManager from '../components/MessageManager';
import '../components/CanvasBuilder.css';
*/
export default function CanvasBuilderPage() {
  const editor = useGrapesEditor();

  return (
    <div className="canvas-builder">
      {/* Wizard */}
      <DimensionWizard
        isOpen={editor.showDimensionWizard}
        targetWidth={editor.targetWidth}
        targetHeight={editor.targetHeight}
        setTargetWidth={editor.setTargetWidth}
        setTargetHeight={editor.setTargetHeight}
        presets={editor.dimensionPresets}
        onCancel={() => editor.setShowDimensionWizard(false)}
        onConfirm={editor.handleNewTemplate /* actually creates canvas inside hook */}
      />

      {/* Toolbar */}
      <CanvasToolbar
        onUndo={editor.undo}
        onRedo={editor.redo}
        onOpenAssets={editor.openAssets}
        onDisplayMode={editor.displayMode}
        onZoomIn={editor.handleZoomIn}
        onZoomOut={editor.handleZoomOut}
        zoomLevel={editor.zoomLevel}
        onSave={editor.handleSave}
        onSaveAs={editor.handleSaveAs}
        onNew={editor.handleNewTemplate}
        onDelete={editor.handleDelete}
        templates={editor.templates}
        currentTemplateName={editor.currentTemplateName}
        onLoadTemplate={editor.handleLoadTemplate}
        showSaveDropdown={editor.showSaveDropdown}
        setShowSaveDropdown={editor.setShowSaveDropdown}
        duration={editor.localDuration}
        onDurationChange={editor.handleDurationChange}
        onOpenMessages={() => editor.setIsMessageManagerOpen(true)}
      />

      {/* Workspace */}
      <div className="canvas-builder__workspace">
        <div id="blocks" className="canvas-builder__blocks" />
        <div id="gjs" className="canvas-builder__editor" />
        <CanvasRightPanel />
      </div>

      {/* Modals & overlays */}
      <ImageCropModal
        isOpen={editor.showCropModal}
        onClose={() => editor.setShowCropModal(false)}
        imageUrl={editor.cropImageData?.imageUrl}
        targetWidth={editor.cropImageData?.targetWidth}
        targetHeight={editor.cropImageData?.targetHeight}
        onCropComplete={() => {}}
      />
      <MessageManager
        isOpen={editor.isMessageManagerOpen}
        onClose={() => editor.setIsMessageManagerOpen(false)}
      />
    </div>
  );
} 