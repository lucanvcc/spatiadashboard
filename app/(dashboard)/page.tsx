import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { AlertTriangle, Camera, Users } from "lucide-react"
import { TrendSection } from "@/components/charts/trend-section"
import { UnifiedCalendar } from "@/components/dashboard/unified-calendar"

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
    supabase.from("revenue_events").select("amount").gte("date", startOfMonth.split("T")[0]),
    supabase
      .from("revenue_events")
      .select("amount")
      .gte("date", startOfLastMonth.split("T")[0])
      .lte("date", endOfLastMonth.split("T")[0]),
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

  const revenueMtd = (revenueEvents ?? []).reduce((s, r) => s + r.amount, 0)
  const revenueLastMonth = (lastMonthRevenue ?? []).reduce((s, r) => s + r.amount, 0)

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

async function getContacts() {
  const supabase = await createClient()
  const { data } = await supabase.from("contacts").select("id, name").order("name")
  return data ?? []
}

export default async function HomePage() {
  const [stats, shoots, contacts] = await Promise.all([getDashboardStats(), getUpcomingShoots(), getContacts()])

  const revTrend = pct(stats.revenue_mtd, stats.revenue_last_month)
  const shootTrend = pct(stats.shoots_mtd, stats.shoots_last_month)

  const alerts: string[] = []
  if (stats.emails_awaiting_review > 0)
    alerts.push(`${stats.emails_awaiting_review} email${stats.emails_awaiting_review > 1 ? "s" : ""} awaiting review`)
  if (stats.overdue_invoices > 0)
    alerts.push(`${stats.overdue_invoices} invoice${stats.overdue_invoices > 1 ? "s" : ""} overdue`)
  if (stats.tours_on_sold_listings > 0)
    alerts.push(`${stats.tours_on_sold_listings} Matterport tour${stats.tours_on_sold_listings > 1 ? "s" : ""} on sold listings — archive?`)

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
          value={`${stats.matterport_slots_used} active`}
          sub="check plan limit"
        />
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
            {alerts.map((text, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <AlertTriangle size={12} strokeWidth={1.5} className="text-amber-400 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
