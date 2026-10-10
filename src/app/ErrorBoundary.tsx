import React, { Component, type ReactNode } from 'react';
import { AppScreen } from '../ui/components/AppScreen';
import { ErrorView } from '../ui/components/ErrorView';
import { describeError, logger } from '../infrastructure/logger';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// The one class component in the app: React catches render errors only through the class lifecycle
// methods `getDerivedStateFromError` and `componentDidCatch`; there is no hook equivalent (React 19).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    logger.error('ui.uncaught', { error: describeError(error) });
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppScreen edges={['top', 'bottom']}>
          <ErrorView
            title="Something went wrong"
            message="The screen hit an unexpected problem."
            onRetry={() => this.setState({ hasError: false })}
          />
        </AppScreen>
      );
    }
    return this.props.children;
  }
}
