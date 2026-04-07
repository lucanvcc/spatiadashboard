import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-muted/50 rounded-sm", className)}
      {...props}
    />
  )
}

// ── Preset layout skeletons ────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="border border-border bg-card p-5 space-y-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-2 w-24" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  )
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-2.5 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}

export function KanbanSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="w-64 shrink-0 space-y-3">
          <Skeleton className="h-2.5 w-20" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export { Skeleton }
