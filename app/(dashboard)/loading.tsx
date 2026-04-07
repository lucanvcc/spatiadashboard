import { StatCardSkeleton, ChartSkeleton, CardSkeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <div className="space-y-5 max-w-6xl">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Chart */}
      <ChartSkeleton height={160} />

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
