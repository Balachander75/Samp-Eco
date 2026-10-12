import React from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional: render inside a sub-panel (compact variant) */
  variant?: "page" | "panel";
  /** Optional: override the fallback message */
  message?: string;
}

/**
 * Production-grade React Error Boundary.
 * Catches JS runtime errors in the component tree and renders a
 * context-aware, ERP-themed fallback UI instead of a blank screen.
 *
 * Design follows the Navneet SAMP ERP design system:
 * - Obsidian/zinc neutrals, cobalt-blue accent
 * - Mono code for technical details
 * - 4–6px radii, 1px borders, no shadows
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production you'd send to Sentry / logging service here
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  private handleReload = () => window.location.reload();
  private handleHome = () => { window.location.href = "/dashboard"; };
  private toggleDetails = () => this.setState((s) => ({ showDetails: !s.showDetails }));

  render() {
    if (!this.state.hasError) return this.props.children;

    const { variant = "page", message } = this.props;
    const { error, errorInfo, showDetails } = this.state;

    if (variant === "panel") {
      return <PanelErrorFallback error={error} onRetry={this.handleReload} />;
    }

    return (
      <PageErrorFallback
        error={error}
        errorInfo={errorInfo}
        showDetails={showDetails}
        message={message}
        onReload={this.handleReload}
        onHome={this.handleHome}
        onToggleDetails={this.toggleDetails}
      />
    );
  }
}

// ---------------------------------------------------------------------------
// Full-page fallback
// ---------------------------------------------------------------------------
function PageErrorFallback({
  error,
  errorInfo,
  showDetails,
  message,
  onReload,
  onHome,
  onToggleDetails,
}: {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
  message?: string;
  onReload: () => void;
  onHome: () => void;
  onToggleDetails: () => void;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--surface-lowest, white)] dark:bg-[var(--surface-base, black)] p-6">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[var(--surface-low, rgb(24, 24, 27))] overflow-hidden">
          {/* Top accent bar */}
          <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600" />

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="shrink-0 w-10 h-10 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>

              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                  Application Error
                </h1>
                <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {message ||
                    "An unexpected error occurred in the interface. Your data is safe — this is a display issue only."}
                </p>
              </div>
            </div>
          </div>

          {/* Error name */}
          {error && (
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                Error Reference
              </p>
              <p className="text-[13px] font-mono text-red-600 dark:text-red-400 break-all">
                {error.name}: {error.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={onReload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[var(--accent-primary, rgb(37, 99, 235))] hover:bg-[var(--accent-primary-hover, rgb(29, 78, 216))] text-white text-[13px] font-semibold transition-colors cursor-pointer border border-[var(--accent-primary-hover, rgb(29, 78, 216))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Page
            </button>
            <button
              onClick={onHome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 text-[13px] font-semibold transition-colors cursor-pointer border border-zinc-200 dark:border-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <Home className="w-3.5 h-3.5" />
              Go to Dashboard
            </button>

            {/* Details toggle */}
            {(error?.stack || errorInfo?.componentStack) && (
              <button
                onClick={onToggleDetails}
                className="ml-auto inline-flex items-center gap-1 text-[12px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showDetails ? (
                  <>
                    Hide details <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Show details <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Collapsible stack trace */}
          {showDetails && (
            <div className="border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-[var(--surface-base, black)]">
              <div className="px-6 py-4">
                <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                  Stack Trace
                </p>
                <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-64 overflow-y-auto">
                  {error?.stack || "No stack trace available."}
                </pre>
                {errorInfo?.componentStack && (
                  <>
                    <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-4 mb-2">
                      Component Stack
                    </p>
                    <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
              Navneet SAMP ERP · v1.0
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
              {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact panel-level fallback (used inside a desk section)
// ---------------------------------------------------------------------------
function PanelErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="w-8 h-8 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
          Failed to load this section
        </p>
        {error && (
          <p className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400 mt-1 break-all">
            {error.message}
          </p>
        )}
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-primary, rgb(37, 99, 235))] hover:bg-[var(--accent-primary-hover, rgb(29, 78, 216))] text-white text-[12px] font-semibold transition-colors cursor-pointer border border-[var(--accent-primary-hover, rgb(29, 78, 216))]"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

export default ErrorBoundary;
