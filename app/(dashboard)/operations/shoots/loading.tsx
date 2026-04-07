import { TableSkeleton, StatCardSkeleton } from "@/components/ui/skeleton"

export default function ShootsLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="border border-border bg-card">
        <TableSkeleton rows={6} cols={6} />
      </div>
    </div>
  )
}
