import React from 'react';
import InspectorView from './components/InspectorView.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#ff4757', fontFamily: 'monospace', background: '#0f0f13', height: '100vh' }}>
          <h2 style={{ marginBottom: 12 }}>TweakLens crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ccc', fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#6d6dfa', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <InspectorView />
    </ErrorBoundary>
  );
}
