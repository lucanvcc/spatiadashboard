"use client"

import { useEffect, useState } from "react"
import { OutreachEmail } from "@/types/database"
import { EmailCard } from "@/components/outreach/email-card"
import Link from "next/link"
import { BarChart2, Megaphone } from "lucide-react"

export default function OutreachPage() {
  const [emails, setEmails] = useState<OutreachEmail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/outreach/emails?status=pending_review")
      .then((r) => r.json())
      .then((data) => {
        setEmails(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  function handleStatusChange(id: string, newStatus: string, updates?: Partial<OutreachEmail>) {
    if (newStatus === "sent" || newStatus === "rejected") {
      setEmails((prev) => prev.filter((e) => e.id !== id))
    } else {
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates, status: newStatus as OutreachEmail["status"] } : e))
      )
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h1 className="font-heading text-xl tracking-tight">outreach queue</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "loading..." : `${emails.length} email${emails.length !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/outreach/campaigns"
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Megaphone size={12} strokeWidth={1.5} />
            campaigns
          </Link>
          <Link
            href="/outreach/analytics"
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <BarChart2 size={12} strokeWidth={1.5} />
            analytics
          </Link>
        </div>
      </div>

      {/* Queue */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border bg-card p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">no emails awaiting review</p>
          <Link href="/outreach/campaigns" className="text-xs text-foreground hover:text-muted-foreground transition-colors">
            create a campaign to generate drafts →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
