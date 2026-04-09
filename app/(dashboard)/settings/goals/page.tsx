"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

interface GoalSettings {
  monthly_revenue_goal: string
  weekly_outreach_target: string
  matterport_slot_limit: string
  posting_frequency_per_week: string
  monthly_break_even: string
}

const DEFAULT: GoalSettings = {
  monthly_revenue_goal: "3000",
  weekly_outreach_target: "20",
  matterport_slot_limit: "25",
  posting_frequency_per_week: "3",
  monthly_break_even: "300",
}

export default function GoalsPage() {
  const [form, setForm] = useState<GoalSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          monthly_revenue_goal: data.monthly_revenue_goal ?? DEFAULT.monthly_revenue_goal,
          weekly_outreach_target: data.weekly_outreach_target ?? DEFAULT.weekly_outreach_target,
          matterport_slot_limit: data.matterport_slot_limit ?? DEFAULT.matterport_slot_limit,
          posting_frequency_per_week: data.posting_frequency_per_week ?? DEFAULT.posting_frequency_per_week,
          monthly_break_even: data.monthly_break_even ?? DEFAULT.monthly_break_even,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success("Goals saved")
    } else {
      const d = await res.json()
      toast.error(d.error ?? "Failed to save")
    }
    setSaving(false)
  }

  function field(key: keyof GoalSettings, label: string, hint: string, prefix?: string, suffix?: string) {
    return (
      <div className="space-y-1.5">
        <label className="spatia-label text-xs text-muted-foreground">{label}</label>
        <div className="flex items-center gap-2">
          {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            min="0"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            className="border border-border bg-background px-3 py-2 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            disabled={loading}
          />
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <p className="text-xs text-muted-foreground/60">{hint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="font-heading text-xl tracking-tight">goals & limits</h1>
          <p className="text-muted-foreground text-xs mt-0.5">targets and plan limits — used across the dashboard</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">loading...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          <section className="space-y-5">
            <p className="spatia-label text-xs text-muted-foreground border-b border-border pb-2">revenue</p>
            {field("monthly_revenue_goal", "monthly revenue goal", "Dashboard progress bar + weekly report target", "$", "CAD/month")}
          </section>

          <section className="space-y-5">
            <p className="spatia-label text-xs text-muted-foreground border-b border-border pb-2">outreach</p>
            {field("weekly_outreach_target", "weekly outreach target", "Emails to send per week — cron reminder threshold", undefined, "emails/week")}
          </section>

          <section className="space-y-5">
            <p className="spatia-label text-xs text-muted-foreground border-b border-border pb-2">matterport</p>
            {field("matterport_slot_limit", "matterport slot limit", "Your plan's active tour limit — alert fires at 80%", undefined, "active slots")}
          </section>

          <section className="space-y-5">
            <p className="spatia-label text-xs text-muted-foreground border-b border-border pb-2">content</p>
            {field("posting_frequency_per_week", "posting frequency", "Target posts per week for content calendar pacing", undefined, "posts/week")}
          </section>

          <section className="space-y-5">
            <p className="spatia-label text-xs text-muted-foreground border-b border-border pb-2">break-even</p>
            {field("monthly_break_even", "monthly fixed costs", "Matterport subscription + gas + misc — used to calculate break-even shoot count on command center", "$", "CAD/month")}
          </section>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Save size={13} strokeWidth={1.5} />
            {saving ? "saving..." : "save goals"}
          </button>
        </form>
      )}
    </div>
  )
}
