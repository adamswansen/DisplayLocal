import React from 'react';

export default class BuilderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error in CanvasBuilder:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="canvas-builder">
          <p>An error occurred. Please try again later.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
