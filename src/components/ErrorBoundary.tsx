import { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
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
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-paper p-8">
          <h1
            className="font-serif text-[28px] text-ink mb-3"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "wght" 380' }}
          >
            Something went wrong
          </h1>
          <p className="text-[14px] text-ink-muted mb-6 max-w-[400px] text-center">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-ink text-paper hover:bg-coral-deep transition-colors text-[13px]"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
