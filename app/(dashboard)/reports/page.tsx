import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { FileText, ChevronRight } from "lucide-react"

async function getReports() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("weekly_reports")
    .select("id, week_number, year, created_at, data_json")
    .order("year", { ascending: false })
    .order("week_number", { ascending: false })
    .limit(52)
  return data ?? []
}

function weekDateRange(year: number, weekNum: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (weekNum - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-CA", { month: "short", day: "numeric" })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

export default async function ReportsPage() {
  const reports = await getReports()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">weekly reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          generated every monday at 7am — data from the prior week
        </p>
      </div>

      {/* Current week link */}
      <div className="border border-border bg-card p-4 flex items-center justify-between group hover:bg-accent/20 transition-colors">
        <div className="flex items-center gap-3">
          <FileText size={14} strokeWidth={1.5} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">current week</p>
            <p className="text-xs text-muted-foreground">live data — always up to date</p>
          </div>
        </div>
        <Link
          href="/reports/weekly"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          view <ChevronRight size={12} />
        </Link>
      </div>

      {/* Stored reports */}
      {reports.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          no reports generated yet — runs every monday at 7am
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
                  week
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                  dates
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
                  revenue
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                  emails
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                  shoots
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => {
                const data = r.data_json as any
                const weekStr = `${r.year}-${String(r.week_number).padStart(2, "0")}`
                return (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-muted-foreground">W{r.week_number}</p>
                      <p className="text-xs text-foreground">{r.year}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {weekDateRange(r.year, r.week_number)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {data?.revenue?.total != null
                        ? `$${Number(data.revenue.total).toFixed(0)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {data?.outreach?.emails_sent ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {data?.shoots?.completed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/reports/weekly?week=${weekStr}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        view →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
