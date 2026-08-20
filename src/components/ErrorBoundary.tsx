import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-8 text-center dark:bg-brand-900 text-brand-900 dark:text-white">
          <div className="mb-4 text-red-500 rounded-full bg-red-500/10 p-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold">Something went wrong</h2>
          <p className="mb-8 max-w-md text-brand-900/60 dark:text-white/60">
            {this.state.error?.message || 'An unexpected error occurred in this view.'}
          </p>
          <button 
            className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-brand-500 hover:shadow-xl active:scale-[0.98]" 
            onClick={() => {
              this.setState({ hasError: false, error: null })
              this.props.onReset?.()
            }}
          >
            Clear Session & Go Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
