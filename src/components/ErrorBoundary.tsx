import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Heading shown in the fallback. */
  fallbackTitle?: string;
  /** Called after the user clicks "Try again", before children re-render. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TutorDesk render error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <h2>{this.props.fallbackTitle ?? 'Something went wrong on this page.'}</h2>
        <p>Your data is safe. Try again, or move to another page from the menu.</p>
        <button type="button" className="btn btn-primary" onClick={this.handleReset}>
          Try again
        </button>
      </div>
    );
  }
}
