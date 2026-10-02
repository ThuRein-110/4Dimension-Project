import { Component, type ErrorInfo, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application rendering failed', error, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="app-loading" role="alert"><h1>Workspace unavailable</h1><p>A rendering error interrupted this view. Your saved projects remain on this PC.</p><button onClick={() => location.reload()}>Reload workspace</button></main>;
    return this.props.children;
  }
}
