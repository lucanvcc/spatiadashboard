import Link from "next/link"
import { Clock, Mail, Sliders, Database } from "lucide-react"

const sections = [
  {
    href: "/settings/cron",
    icon: Clock,
    title: "automation engine",
    description: "cron jobs — status, manual triggers, enable/disable",
  },
  {
    href: "#",
    icon: Mail,
    title: "email / smtp",
    description: "zoho smtp config, signature, test send",
    disabled: true,
  },
  {
    href: "#",
    icon: Sliders,
    title: "goals & limits",
    description: "revenue targets, outreach quotas, matterport slot limit",
    disabled: true,
  },
  {
    href: "#",
    icon: Database,
    title: "export & danger zone",
    description: "csv export all data, purge old logs",
    disabled: true,
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
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
              </div>
            </div>
          )
          return s.disabled ? (
            <div key={s.title} className="opacity-40 cursor-not-allowed">{inner}</div>
          ) : (
            <Link key={s.title} href={s.href}>{inner}</Link>
          )
        })}
      </div>
    </div>
  )
}
