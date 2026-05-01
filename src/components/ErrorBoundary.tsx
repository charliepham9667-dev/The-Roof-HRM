import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  isChunkLoadError: boolean
}

/**
 * Chunk-load failures happen on mobile after a deploy: the user has the old
 * HTML cached, navigates to a route whose hashed JS chunk no longer exists,
 * and React-Lazy throws. Detect the canonical error shapes and treat them as
 * "stale deploy" so we can hard-reload to pick up the new HTML.
 */
function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const message = (error as Error)?.message ?? String(error)
  const name = (error as Error)?.name ?? ""
  return (
    name === "ChunkLoadError" ||
    /Loading chunk \d+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

/**
 * ErrorBoundary - Catches React errors in child tree and renders fallback UI.
 * On chunk-load errors (typical after a deploy on a stale phone PWA), it
 * automatically reloads the page to fetch the new HTML / chunk manifest.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isChunkLoadError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isChunkLoadError: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)

    // Stale-deploy chunk failure: reload once to pick up new HTML. Use a
    // sessionStorage flag to avoid an infinite reload loop if the chunk is
    // genuinely missing on the server.
    if (isChunkLoadError(error)) {
      try {
        const flag = "theroof-chunk-reload-attempted"
        if (typeof window !== "undefined" && !sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, "1")
          window.location.reload()
          return
        }
      } catch {
        // fall through to fallback UI
      }
    }

    try {
      if (typeof window !== "undefined" && navigator.sendBeacon) {
        const payload = JSON.stringify({
          type: "react_error_boundary",
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
          isChunkLoadError: isChunkLoadError(error),
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

      const message = this.state.isChunkLoadError
        ? "A new version of the app is available. Reload to continue."
        : (this.state.error?.message ?? "An unexpected error occurred.")

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm font-medium text-foreground">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-md">{message}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined, isChunkLoadError: false })}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem("theroof-chunk-reload-attempted")
                } catch {
                  // ignore
                }
                window.location.reload()
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
