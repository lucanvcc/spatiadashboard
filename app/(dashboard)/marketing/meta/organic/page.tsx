import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Upload } from "lucide-react"

async function getOrganicData() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10)
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: mtdMetrics },
    { data: last90Metrics },
    { data: recentPosts },
  ] = await Promise.all([
    // This month's organic metrics
    supabase
      .from("social_post_metrics")
      .select("likes, comments, saves, shares, reach, impressions, profile_visits, platform, date")
      .gte("date", startOfMonth),

    // 90-day history for chart
    supabase
      .from("social_post_metrics")
      .select("date, likes, comments, saves, shares, reach, impressions, platform")
      .gte("date", last90)
      .order("date", { ascending: true }),

    // Recent posts with content calendar join
    supabase
      .from("social_post_metrics")
      .select("id, post_id, platform, date, likes, comments, saves, shares, reach, impressions, profile_visits, content_calendar_id, content_calendar(caption_en, caption_fr, content_type, pillar)")
      .gte("date", last90)
      .order("date", { ascending: false })
      .limit(20),
  ])

  // ── MTD aggregates ─────────────────────────────────────────────────────────
  const mtd = mtdMetrics ?? []
  const totalLikes = mtd.reduce((s, r) => s + (r.likes ?? 0), 0)
  const totalComments = mtd.reduce((s, r) => s + (r.comments ?? 0), 0)
  const totalSaves = mtd.reduce((s, r) => s + (r.saves ?? 0), 0)
  const totalShares = mtd.reduce((s, r) => s + (r.shares ?? 0), 0)
  const totalReach = mtd.reduce((s, r) => s + (r.reach ?? 0), 0)
  const totalImpressions = mtd.reduce((s, r) => s + (r.impressions ?? 0), 0)
  const totalEngagement = totalLikes + totalComments + totalSaves + totalShares
  const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0
  const postCount = mtd.length

  // ── By platform ────────────────────────────────────────────────────────────
  const byPlatform: Record<string, { posts: number; engagement: number; reach: number }> = {}
  for (const r of mtd) {
    const p = r.platform ?? "other"
    if (!byPlatform[p]) byPlatform[p] = { posts: 0, engagement: 0, reach: 0 }
    byPlatform[p].posts += 1
    byPlatform[p].engagement += (r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.shares ?? 0)
    byPlatform[p].reach += r.reach ?? 0
  }

  // ── Weekly chart (group by week) ────────────────────────────────────────────
  const byWeek: Record<string, { engagement: number; reach: number; posts: number }> = {}
  for (const r of last90Metrics ?? []) {
    // ISO week key: YYYY-Www
    const d = new Date(r.date)
    const dow = d.getDay() || 7
    d.setDate(d.getDate() + 4 - dow)
    const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1))
    const wNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    const key = `${d.getFullYear()}-W${String(wNum).padStart(2, "0")}`
    if (!byWeek[key]) byWeek[key] = { engagement: 0, reach: 0, posts: 0 }
    byWeek[key].engagement += (r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.shares ?? 0)
    byWeek[key].reach += r.reach ?? 0
    byWeek[key].posts += 1
  }
  const chartRows = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, ...v }))

  const maxEngagement = Math.max(...chartRows.map((r) => r.engagement), 1)

  return {
    totalLikes,
    totalComments,
    totalSaves,
    totalShares,
    totalReach,
    totalImpressions,
    totalEngagement,
    avgEngagementRate,
    postCount,
    byPlatform,
    chartRows,
    maxEngagement,
    recentPosts: recentPosts ?? [],
  }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border bg-card p-4 space-y-1.5">
      <p className="spatia-label text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const PILLAR_LABELS: Record<string, string> = {
  the_work: "the work",
  the_edge: "the edge",
  the_process: "the process",
  the_proof: "the proof",
  the_culture: "the culture",
}

export default async function MetaOrganicPage() {
  const data = await getOrganicData()

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl tracking-tight">organic reach</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            instagram · tiktok · engagement · saves · reach
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marketing/meta"
            className="spatia-label text-xs border border-border px-3 py-2 hover:bg-accent transition-colors text-muted-foreground"
          >
            ← paid ads
          </Link>
          <Link
            href="/marketing/meta-import"
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Upload size={12} strokeWidth={1.5} />
            import
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="posts tracked (mtd)"
          value={data.postCount.toString()}
          sub="social_post_metrics"
        />
        <StatCard
          label="total engagement"
          value={data.totalEngagement.toLocaleString()}
          sub={`likes + comments + saves + shares`}
        />
        <StatCard
          label="avg engagement rate"
          value={`${data.avgEngagementRate.toFixed(2)}%`}
          sub={`${data.totalReach.toLocaleString()} reach`}
        />
        <StatCard
          label="saves"
          value={data.totalSaves.toLocaleString()}
          sub={`${data.totalComments} comments · ${data.totalShares} shares`}
        />
      </div>

      {/* Weekly engagement chart */}
      {data.chartRows.length > 0 && (
        <div className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label text-xs text-muted-foreground">weekly engagement — 90 days</p>
          <div className="flex items-end gap-1 h-24">
            {data.chartRows.map((row) => (
              <div key={row.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full bg-foreground/20 hover:bg-foreground/40 transition-colors"
                  style={{
                    height: `${Math.max((row.engagement / data.maxEngagement) * 88, 2)}px`,
                  }}
                  title={`${row.week}: ${row.engagement} engagement · ${row.posts} posts`}
                />
                <p className="spatia-label text-[9px] text-muted-foreground/60 truncate w-full text-center">
                  {row.week.slice(5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By platform breakdown */}
      {Object.keys(data.byPlatform).length > 0 && (
        <div className="border border-border bg-card p-5 space-y-4">
          <p className="spatia-label text-xs text-muted-foreground">by platform — month to date</p>
          <div className="space-y-3">
            {Object.entries(data.byPlatform)
              .sort(([, a], [, b]) => b.engagement - a.engagement)
              .map(([platform, stats]) => {
                const maxEng = Math.max(...Object.values(data.byPlatform).map((v) => v.engagement), 1)
                const engRate = stats.reach > 0 ? ((stats.engagement / stats.reach) * 100).toFixed(2) : "—"
                return (
                  <div key={platform} className="flex items-center gap-3">
                    <p className="spatia-label text-xs text-muted-foreground w-24 shrink-0 capitalize">
                      {platform.replace("_", " ")}
                    </p>
                    <div className="flex-1 h-5 bg-border/30">
                      <div
                        className="h-full bg-foreground/20 transition-all"
                        style={{ width: `${(stats.engagement / maxEng) * 100}%` }}
                      />
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="spatia-label text-xs">{stats.engagement.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground/60">{engRate}% er</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Recent posts */}
      {data.recentPosts.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <p className="spatia-label text-xs text-muted-foreground">recent posts — 90 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["date", "platform", "pillar", "likes", "comments", "saves", "reach", "eng rate"].map(
                    (h) => (
                      <th
                        key={h}
                        className="spatia-label text-xs text-muted-foreground font-normal px-5 py-2 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentPosts.map((p: any) => {
                  const eng =
                    (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)
                  const er = p.reach > 0 ? ((eng / p.reach) * 100).toFixed(1) + "%" : "—"
                  const pillar =
                    p.content_calendar?.pillar
                      ? PILLAR_LABELS[p.content_calendar.pillar] ?? p.content_calendar.pillar
                      : "—"
                  return (
                    <tr key={p.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-5 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="px-5 py-2.5 capitalize text-xs">{p.platform}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{pillar}</td>
                      <td className="px-5 py-2.5 tabular-nums">{p.likes ?? 0}</td>
                      <td className="px-5 py-2.5 tabular-nums">{p.comments ?? 0}</td>
                      <td className="px-5 py-2.5 tabular-nums">{p.saves ?? 0}</td>
                      <td className="px-5 py-2.5 tabular-nums">
                        {p.reach != null ? p.reach.toLocaleString() : "—"}
                      </td>
                      <td
                        className={`px-5 py-2.5 tabular-nums text-xs ${
                          parseFloat(er) >= 5
                            ? "text-emerald-400"
                            : parseFloat(er) >= 2
                            ? ""
                            : "text-muted-foreground"
                        }`}
                      >
                        {er}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.recentPosts.length === 0 && (
        <div className="border border-border bg-card p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">no organic data yet</p>
          <p className="text-xs text-muted-foreground">
            import instagram insights CSV to populate — data lands in{" "}
            <code className="text-foreground/60">social_post_metrics</code>
          </p>
          <Link
            href="/marketing/meta-import"
            className="inline-flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Upload size={12} strokeWidth={1.5} />
            import instagram insights
          </Link>
        </div>
      )}
    </div>
  )
}
