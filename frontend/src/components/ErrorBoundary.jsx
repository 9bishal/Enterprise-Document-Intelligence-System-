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
          backgroundColor: '#f6f5f1', fontFamily: "'Inter', system-ui, sans-serif",
          flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center'
        }}>
          <h2 style={{ color: '#c8a44d', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#5b6472', maxWidth: 400, fontSize: 14 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#243252', color: '#f6f5f1',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
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
