import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Auto-reload the app if a dynamic import / chunk load fails (e.g., after a new deployment)
    const errorStr = error?.toString() || '';
    const isChunkError = 
      errorStr.includes('Failed to fetch dynamically imported module') ||
      errorStr.includes('Importing a module script failed') ||
      (error && error.name === 'ChunkLoadError');

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      // Only reload if the last reload was more than 10 seconds ago to prevent infinite loops
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          background: 'var(--surface)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '300px', lineHeight: '1.6' }}>
            The application encountered an unexpected error.
          </p>
          <div style={{
            marginTop: '24px',
            padding: '12px',
            background: 'var(--surface-warm)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--danger)',
            fontFamily: 'monospace',
            textAlign: 'left',
            maxWidth: '90%',
            overflow: 'auto'
          }}>
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '30px',
              padding: '10px 24px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
