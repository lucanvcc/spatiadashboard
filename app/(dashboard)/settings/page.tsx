import Link from "next/link"
import { Clock, Mail, Sliders, Database, DollarSign, Box, AlertCircle } from "lucide-react"

// Check if API credentials are configured
const WAVE_CONNECTED = !!(process.env.WAVE_ACCESS_TOKEN)
const MATTERPORT_CONNECTED = !!(process.env.MATTERPORT_TOKEN_ID && process.env.MATTERPORT_TOKEN_SECRET)

const sections = [
  {
    href: "/settings/cron",
    icon: Clock,
    title: "automation engine",
    description: "cron jobs — status, manual triggers, enable/disable",
    status: null,
  },
  {
    href: "/settings/email",
    icon: Mail,
    title: "email / smtp",
    description: "zoho smtp config, test send, casl unsubscribe line",
    status: null,
  },
  {
    href: "/settings/goals",
    icon: Sliders,
    title: "goals & limits",
    description: "revenue targets, outreach quotas, matterport slot limit",
    status: null,
  },
  {
    href: "/settings/export",
    icon: Database,
    title: "export & danger zone",
    description: "csv export all data, purge old logs",
    status: null,
  },
  {
    href: "/settings/wave",
    icon: DollarSign,
    title: "wave financial",
    description: WAVE_CONNECTED
      ? "connecté — synchronisation auto des factures et transactions"
      : "non connecté — import manuel uniquement",
    status: WAVE_CONNECTED ? "connected" : "disconnected",
  },
  {
    href: "/settings/matterport",
    icon: Box,
    title: "matterport api",
    description: MATTERPORT_CONNECTED
      ? "connecté — synchronisation auto des espaces toutes les 12h"
      : "non connecté — suivi manuel des slots",
    status: MATTERPORT_CONNECTED ? "connected" : "disconnected",
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl tracking-tight">settings</h1>
        <p className="text-muted-foreground text-sm mt-1">configure the command center</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon
          const inner = (
            <div className="flex items-start gap-3 p-4 border border-border rounded-sm hover:bg-muted/10 transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.title}</span>
                  {s.status === "disconnected" && (
                    <span className="inline-flex items-center gap-1 text-[10px] spatia-label text-amber-400">
                      <AlertCircle size={9} strokeWidth={1.5} />
                      setup
                    </span>
                  )}
                  {s.status === "connected" && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
              </div>
            </div>
          )
          return (
            <Link key={s.title} href={s.href}>{inner}</Link>
          )
        })}
      </div>
    </div>
  )
}
