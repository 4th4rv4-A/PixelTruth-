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
    console.error('PixelTruth crashed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-16 p-8 rounded-lg frame bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl border border-red-500/30 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="text-sm text-ink-600 dark:text-ink-400">
            PixelTruth hit an unexpected error, likely from a file it couldn't process.
            Your other files and data are untouched — nothing was uploaded or lost.
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-md bg-safelight-500 hover:bg-safelight-400 text-ink-50 font-medium transition-colors cursor-pointer shadow-sm"
          >
            Try again
          </button>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg overflow-auto max-h-40">
              {this.state.error?.stack || this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
