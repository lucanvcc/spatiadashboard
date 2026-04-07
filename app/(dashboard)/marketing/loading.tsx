import { StatCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton"

export default function MarketingLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartSkeleton height={180} />
        <ChartSkeleton height={180} />
      </div>
      <div className="border border-border bg-card">
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  )
}
