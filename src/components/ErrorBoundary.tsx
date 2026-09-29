import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches a render crash anywhere below it and shows a way out instead of a blank page. Saved work
 * is on the server, so reloading is safe.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Griha crashed while rendering', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <p className="font-display text-xl font-semibold text-text">Something went wrong on this page</p>
        <p className="max-w-md text-sm text-text-muted">
          Your saved work is safe. Reload to carry on; if it keeps happening, go back to your projects.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Reload
          </button>
          <a href="/" className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-2">
            Go to projects
          </a>
        </div>
      </div>
    )
  }
}
