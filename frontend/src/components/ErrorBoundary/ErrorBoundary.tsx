import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error caught by ErrorBoundary:', error, info)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="error-boundary">
        <main className="error-boundary__main">
          <div className="error-boundary__brand">Ophelos</div>
          <article className="error-boundary__card" role="alert">
            <header className="error-boundary__header">
              <span className="error-boundary__badge">Error</span>
              <h1 className="error-boundary__title">Something went wrong</h1>
              <p className="error-boundary__sub">
                An unexpected error occurred. Please reload the page and try again.
              </p>
            </header>
            <button
              type="button"
              className="error-boundary__button"
              onClick={this.handleReload}
            >
              Reload
            </button>
          </article>
        </main>
      </div>
    )
  }
}
