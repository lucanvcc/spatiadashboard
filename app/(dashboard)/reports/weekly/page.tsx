import { Suspense } from "react"
import { WeeklyReportView } from "./report-view"

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm animate-pulse">loading report...</div>}>
      <WeeklyReportView week={params.week} />
    </Suspense>
  )
}
