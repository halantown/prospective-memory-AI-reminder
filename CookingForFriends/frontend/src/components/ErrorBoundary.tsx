import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  participantId?: string | null
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            An unexpected error occurred. Please contact the experimenter.
          </p>
          {this.props.participantId && (
            <p className="mt-4 rounded bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
              Participant: {this.props.participantId}
            </p>
          )}
          <p className="mt-3 rounded bg-red-50 px-3 py-2 font-mono text-xs text-red-600 text-left break-all">
            {this.state.error.message}
          </p>
          <button
            className="mt-4 rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
