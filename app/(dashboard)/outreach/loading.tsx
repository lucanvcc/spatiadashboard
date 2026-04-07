import { TableSkeleton, StatCardSkeleton } from "@/components/ui/skeleton"

export default function OutreachLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="border border-border bg-card">
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  )
}
