"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[dashboard error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center">
      <AlertCircle size={28} strokeWidth={1} className="text-destructive" />
      <div className="space-y-1.5">
        <p className="font-heading text-lg">Something went wrong</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message ?? "An unexpected error occurred loading this page."}
        </p>
        {error.digest && (
          <p className="spatia-label text-xs text-muted-foreground/50">ref: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 border border-border text-sm hover:bg-accent transition-colors"
      >
        <RefreshCw size={13} strokeWidth={1.5} />
        retry
      </button>
    </div>
  )
}
