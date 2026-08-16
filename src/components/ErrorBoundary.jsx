// ============================================================
// Error Boundary — shows a friendly message instead of a blank
// white screen when a runtime error happens.
// ============================================================
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container" style={{ paddingTop: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            The app hit an unexpected error. Please refresh the page.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
