import React from 'react'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode }, State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#e11d48' }}>오류 발생 / Error</h2>
          <pre style={{
            background: '#f1f5f9',
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack?.slice(0, 500)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: '8px 16px' }}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
