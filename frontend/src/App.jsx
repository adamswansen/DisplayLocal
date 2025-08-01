import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import CanvasBuilder from './components/CanvasBuilder/CanvasBuilder';
import BuilderErrorBoundary from './components/BuilderErrorBoundary';
import FullscreenDisplay from './pages/FullscreenDisplay';
import RunnerDisplayPage from './pages/RunnerDisplayPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/builder"
        element={(
          <BuilderErrorBoundary>
            <CanvasBuilder />
          </BuilderErrorBoundary>
        )}
      />
      <Route path="/display" element={<FullscreenDisplay />} />
      <Route path="/runner-display" element={<RunnerDisplayPage />} />
    </Routes>
  );
}
