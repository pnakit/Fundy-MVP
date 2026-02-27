import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`ErrorBoundary [${this.props.name || 'unknown'}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <h3 style={{
            color: '#ef4444',
            marginBottom: '0.5rem',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            Something went wrong
          </h3>
          <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            {this.props.name ? `Error in ${this.props.name}` : 'An unexpected error occurred'}.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#a5b4fc',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
