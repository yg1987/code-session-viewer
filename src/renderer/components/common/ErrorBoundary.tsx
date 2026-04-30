import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.context || 'unknown'}]:`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-3 my-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs font-medium text-red-400">Render Error</span>
            {this.props.context && <span className="text-[10px] text-red-400/60">{this.props.context}</span>}
          </div>
          <pre className="text-[10px] text-red-400/80 font-mono overflow-hidden text-ellipsis">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-[10px] text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
