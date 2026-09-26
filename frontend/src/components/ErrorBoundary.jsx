import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', height: '100vh', width: '100vw',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#fafafa', fontFamily: "'Inter', system-ui, sans-serif",
          flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center'
        }}>
          <h2 style={{ color: '#111111', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#525252', maxWidth: 400, fontSize: 14 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#111111', color: '#ffffff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              transition: 'all 0.2s'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
