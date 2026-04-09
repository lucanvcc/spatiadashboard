import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { AlertTriangle, AlertCircle, Info, Camera, Users, DollarSign } from "lucide-react"
import { TrendSection } from "@/components/charts/trend-section"
import { UnifiedCalendar } from "@/components/dashboard/unified-calendar"
import { getActiveAlerts, type Alert } from "@/lib/alerts"

async function getMatterportLimit(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.from("settings").select("value").eq("key", "matterport_slot_limit").single()
  return parseInt(data?.value ?? "25", 10)
}

async function getDashboardStats() {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  const [
    { data: revenueEvents },
    { data: lastMonthRevenue },
    { data: shootsMtd },
    { data: shootsLastMonth },
    { data: contacts },
    { data: tours },
    { data: pendingEmails },
    { data: overdueInvoices },
    { count: toursOnSoldCount },
  ] = await Promise.all([
    supabase.from("invoices").select("total").eq("status", "paid").gte("paid_at", startOfMonth),
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", startOfLastMonth)
      .lte("paid_at", endOfLastMonth),
    supabase.from("shoots").select("id").gte("created_at", startOfMonth).eq("status", "booked"),
    supabase
      .from("shoots")
      .select("id")
      .gte("created_at", startOfLastMonth)
      .lte("created_at", endOfLastMonth),
    supabase.from("contacts").select("id, status"),
    supabase.from("tours").select("id, status"),
    supabase.from("outreach_emails").select("id").eq("status", "pending_review"),
    supabase.from("invoices").select("id").eq("status", "overdue"),
    supabase
      .from("tours")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .not("listing_id", "is", null),
  ])

  const revenueMtd = (revenueEvents ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
  const revenueLastMonth = (lastMonthRevenue ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  const allContacts = contacts ?? []
  const pipelineTotal = allContacts.filter((c) => c.status !== "churned").length
  const activeLeads = allContacts.filter(
    (c) => !["churned", "paying_client", "trial_shoot"].includes(c.status)
  ).length

  // Funnel counts
  const funnel = {
    new_lead: allContacts.filter((c) => c.status === "new_lead").length,
    first_email_sent: allContacts.filter((c) => ["first_email_sent", "followup_sent"].includes(c.status)).length,
    replied: allContacts.filter((c) => ["replied", "meeting_booked"].includes(c.status)).length,
    booked: allContacts.filter((c) => ["trial_shoot", "paying_client"].includes(c.status)).length,
  }

  return {
    revenue_mtd: revenueMtd,
    revenue_last_month: revenueLastMonth,
    shoots_mtd: shootsMtd?.length ?? 0,
    shoots_last_month: shootsLastMonth?.length ?? 0,
    pipeline_total: pipelineTotal,
    active_leads: activeLeads,
    matterport_slots_used: (tours ?? []).filter((t) => t.status === "active").length,
    emails_awaiting_review: pendingEmails?.length ?? 0,
    overdue_invoices: overdueInvoices?.length ?? 0,
    tours_on_sold_listings: toursOnSoldCount ?? 0,
    funnel,
  }
}

async function getUpcomingShoots() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("shoots")
    .select("id, address, scheduled_at, status, contacts(name)")
    .in("status", ["booked"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5)
  return data ?? []
}

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string
  sub?: string
  trend?: "up" | "down" | null
}) {
  return (
    <div className="border border-border bg-card p-5 space-y-2">
      <p className="spatia-label text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl tracking-tight">{value}</p>
      {sub && (
        <p className={`text-xs ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

function pct(a: number, b: number) {
  if (b === 0) return null
  const p = ((a - b) / b) * 100
  return { value: Math.abs(p).toFixed(0) + "%", trend: p >= 0 ? ("up" as const) : ("down" as const) }
}

async function getMoneyWidgetData() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10)
  const yearStart = `${year}-01-01`

  const [{ data: paidMtd }, { data: outstanding }, { data: ytdInvoices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth),
    supabase.from("invoices").select("total").in("status", ["sent", "overdue"]),
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", yearStart),
  ])

  const revenueMtd = (paidMtd ?? []).reduce((s, i) => s + i.total, 0)
  const outstandingTotal = (outstanding ?? []).reduce((s, i) => s + i.total, 0)
  const ytdRevenue = (ytdInvoices ?? []).reduce((s, i) => s + i.total, 0)
  const thresholdPct = Math.min((ytdRevenue / 30000) * 100, 100)

  return { revenueMtd, outstandingTotal, ytdRevenue, thresholdPct }
}

async function getContacts() {
  const supabase = await createClient()
  const { data } = await supabase.from("contacts").select("id, name").order("name")
  return data ?? []
}

export default async function HomePage() {
  const [stats, shoots, contacts, alerts, money, slotLimit] = await Promise.all([
    getDashboardStats(),
    getUpcomingShoots(),
    getContacts(),
    getActiveAlerts(),
    getMoneyWidgetData(),
    getMatterportLimit(),
  ])

  const revTrend = pct(stats.revenue_mtd, stats.revenue_last_month)
  const shootTrend = pct(stats.shoots_mtd, stats.shoots_last_month)

  const funnelSteps = [
    { label: "new", count: stats.funnel.new_lead },
    { label: "contacted", count: stats.funnel.first_email_sent },
    { label: "replied", count: stats.funnel.replied },
    { label: "client", count: stats.funnel.booked },
  ]
  const maxFunnel = Math.max(...funnelSteps.map((s) => s.count), 1)

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="revenue mtd"
          value={formatCurrency(stats.revenue_mtd)}
          sub={revTrend ? `${revTrend.trend === "up" ? "▲" : "▼"} ${revTrend.value} vs last month` : "no data last month"}
          trend={revTrend?.trend}
        />
        <StatCard
          label="shoots mtd"
          value={stats.shoots_mtd.toString()}
          sub={shootTrend ? `${shootTrend.trend === "up" ? "▲" : "▼"} ${shootTrend.value} vs last month` : undefined}
          trend={shootTrend?.trend}
        />
        <StatCard
          label="pipeline"
          value={stats.pipeline_total.toString()}
          sub={`${stats.active_leads} active leads`}
        />
        <StatCard
          label="matterport slots"
          value={`${stats.matterport_slots_used} / ${slotLimit}`}
          sub={stats.matterport_slots_used / slotLimit >= 0.8 ? "⚠ near limit" : `${slotLimit - stats.matterport_slots_used} slots free`}
          trend={stats.matterport_slots_used / slotLimit >= 0.8 ? "down" : null}
        />
      </div>

      {/* Money widgets */}
      <div className="border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">financial snapshot</p>
          </div>
          <a href="/money" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">
            view money →
          </a>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="spatia-label text-xs text-muted-foreground">revenue mtd</p>
            <p className="font-heading text-lg mt-0.5">{formatCurrency(money.revenueMtd)}</p>
          </div>
          <div>
            <p className="spatia-label text-xs text-muted-foreground">outstanding</p>
            <p className={`font-heading text-lg mt-0.5 ${money.outstandingTotal > 0 ? "text-amber-400" : ""}`}>
              {formatCurrency(money.outstandingTotal)}
            </p>
          </div>
          <div>
            <p className="spatia-label text-xs text-muted-foreground">$30k threshold</p>
            <p className={`font-heading text-lg mt-0.5 ${money.thresholdPct >= 80 ? "text-red-400" : money.thresholdPct >= 60 ? "text-amber-400" : ""}`}>
              {money.thresholdPct.toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-border/40">
          <div
            className={`h-full transition-all ${
              money.thresholdPct >= 80 ? "bg-red-400" : money.thresholdPct >= 60 ? "bg-amber-400" : "bg-foreground/40"
            }`}
            style={{ width: `${Math.min(money.thresholdPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Revenue vs Spend chart */}
      <TrendSection />

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Outreach funnel */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">outreach pipeline</p>
          </div>
          <div className="space-y-2">
            {funnelSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <p className="spatia-label text-xs text-muted-foreground w-20 shrink-0">{step.label}</p>
                <div className="flex-1 h-5 bg-border/40 relative">
                  <div
                    className="h-full bg-foreground/20 transition-all"
                    style={{ width: `${(step.count / maxFunnel) * 100}%` }}
                  />
                </div>
                <p className="spatia-label text-xs w-6 text-right">{step.count}</p>
              </div>
            ))}
          </div>
          <a href="/crm" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">
            view crm →
          </a>
        </div>

        {/* Upcoming shoots */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Camera size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">upcoming shoots</p>
          </div>
          {shoots.length === 0 ? (
            <p className="text-sm text-muted-foreground">no upcoming shoots booked</p>
          ) : (
            <ul className="space-y-2">
              {shoots.map((s: any) => (
                <li key={s.id} className="flex items-start justify-between text-sm">
                  <span className="text-foreground truncate">{s.address}</span>
                  <span className="text-muted-foreground text-xs shrink-0 ml-2">
                    {s.scheduled_at
                      ? new Date(s.scheduled_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                      : "TBD"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a href="/operations/shoots" className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors">
            view shoots →
          </a>
        </div>
      </div>

      {/* Unified Calendar */}
      <div>
        <p className="spatia-label text-xs text-muted-foreground mb-3">calendar</p>
        <UnifiedCalendar contacts={contacts} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="spatia-label text-xs text-muted-foreground">actions needed</p>
          </div>
          <ul className="space-y-2">
            {alerts.map((alert, i) => {
              const Icon =
                alert.severity === "critical"
                  ? AlertCircle
                  : alert.severity === "info"
                  ? Info
                  : AlertTriangle
              const iconColor =
                alert.severity === "critical"
                  ? "text-red-400"
                  : alert.severity === "info"
                  ? "text-blue-400"
                  : "text-amber-400"
              return (
                <li key={i}>
                  <a
                    href={alert.action_url}
                    className="flex items-start gap-2 group hover:opacity-80 transition-opacity"
                  >
                    <Icon size={12} strokeWidth={1.5} className={`${iconColor} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug group-hover:underline underline-offset-2">
                        {alert.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {alert.description}
                      </p>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>
          <a
            href="/reports/weekly"
            className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors block"
          >
            view weekly report →
          </a>
        </div>
      )}
    </div>
  )
}
