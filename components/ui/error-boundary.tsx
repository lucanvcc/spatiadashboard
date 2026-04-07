"use client"

import { Component, ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="border border-border bg-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={24} strokeWidth={1.5} className="text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-3 py-1.5 border border-border text-xs spatia-label hover:bg-accent transition-colors"
          >
            <RefreshCw size={11} strokeWidth={1.5} />
            retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for convenience
export function WithErrorBoundary({ children, fallback }: Props) {
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>
}
