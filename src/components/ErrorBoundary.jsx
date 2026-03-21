/**
 * ErrorBoundary — Reusable React error boundary.
 * Catches render-time errors and shows a styled fallback matching the
 * UNREDACTED design system (IBM Plex Mono / Playfair Display).
 *
 * Usage:
 *   <ErrorBoundary label="Map">
 *     <USPoliticalMap ... />
 *   </ErrorBoundary>
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info?.componentStack || '');
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { label = 'Section', theme } = this.props;
    const t = theme || {};

    return (
      <div
        style={{
          padding: '24px 20px',
          background: t.card || '#111',
          border: `1px solid ${t.warn || '#ef4444'}`,
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          minHeight: 80,
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: t.warn || '#ef4444',
            letterSpacing: '1px',
          }}
        >
          ⚠ {label.toUpperCase()} FAILED TO RENDER
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 12,
            fontStyle: 'italic',
            color: t.mid || '#888',
            textAlign: 'center',
            maxWidth: 400,
          }}
        >
          {this.state.errorMessage}
        </div>
        <button
          onClick={this.handleRetry}
          style={{
            padding: '6px 16px',
            background: 'transparent',
            border: `1px solid ${t.border || '#333'}`,
            borderRadius: 4,
            color: t.hi || '#fff',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: '1px',
            cursor: 'pointer',
          }}
        >
          RETRY
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
