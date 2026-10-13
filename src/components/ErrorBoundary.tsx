import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';

type ErrorBoundaryProps = {
  /** Fallback rendered when a descendant throws during render. */
  fallback?: ReactNode;
  /** Called with the caught error for logging / telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Reusable error boundary. A render failure in one module (Tickets, KB, Vault,
 * Admin, ...) shows the fallback instead of white-screening the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <ModuleCrashFallback
            module="This module"
            error={this.state.error}
            onReset={this.reset}
          />
        )
      );
    }
    return this.props.children;
  }
}

export function ModuleCrashFallback({
  module,
  error,
  onReset,
}: {
  module: string;
  error?: Error | null;
  onReset?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-foreground">{module} crashed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong while rendering this view. Your other modules are
          unaffected.
        </p>
        {error?.message ? (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground break-words">
            {error.message}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button variant="outline" onClick={onReset}>
            Reload module
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
