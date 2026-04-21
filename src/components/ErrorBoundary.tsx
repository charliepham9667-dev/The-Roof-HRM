import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * ErrorBoundary - Catches React errors in child tree and renders fallback UI
 * Prevents the whole app from crashing when a component throws
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
    try {
      if (typeof window !== "undefined" && navigator.sendBeacon) {
        const payload = JSON.stringify({
          type: "react_error_boundary",
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
        })
        navigator.sendBeacon("/api/client-error", payload)
      }
    } catch {
      // Keep boundary resilient even if telemetry fails.
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
