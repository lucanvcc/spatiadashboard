"use client"

import { useEffect, useState } from "react"
import { Campaign } from "@/types/database"
import { CampaignForm } from "@/components/outreach/campaign-form"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Plus, Zap, ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/outreach/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  function handleCreated(campaign: Campaign) {
    setCampaigns((prev) => [campaign, ...prev])
  }

  async function handleGenerate(campaign: Campaign) {
    setGenerating(campaign.id)
    const res = await fetch(`/api/outreach/campaigns/${campaign.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_hint: campaign.template }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`${data.generated} email drafts generated — review in outreach queue`)
    } else {
      toast.error(data.error ?? "Generation failed")
    }
    setGenerating(null)
  }

  async function handleStatusToggle(campaign: Campaign) {
    const newStatus = campaign.status === "active" ? "paused" : "active"
    const res = await fetch(`/api/outreach/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus as Campaign["status"] } : c))
      )
    } else {
      toast.error("Failed to update campaign")
    }
  }

  const statusColor: Record<string, string> = {
    draft: "text-muted-foreground",
    active: "text-emerald-400",
    paused: "text-amber-400",
    completed: "text-muted-foreground",
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/outreach" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="font-heading text-xl tracking-tight">campaigns</h1>
            <p className="text-xs text-muted-foreground">{campaigns.length} campaigns</p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm" className="gap-1.5">
          <Plus size={12} /> new campaign
        </Button>
      </div>

      {/* Campaigns list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="border border-border bg-card p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">no campaigns yet</p>
          <button
            onClick={() => setFormOpen(true)}
            className="text-xs text-foreground hover:text-muted-foreground transition-colors"
          >
            create your first campaign →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const stats = campaign.stats as { sent?: number; opened?: number; replied?: number; booked?: number } | null
            const criteria = campaign.target_criteria as Record<string, string | null> | null

            return (
              <div key={campaign.id} className="border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{campaign.name}</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${statusColor[campaign.status]}`}>{campaign.status}</span>
                      <span className="text-xs text-muted-foreground">{campaign.type?.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerate(campaign)}
                      disabled={generating === campaign.id}
                      className="gap-1.5 text-xs"
                    >
                      <Zap size={11} />
                      {generating === campaign.id ? "generating..." : "generate drafts"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatusToggle(campaign)}
                      className="text-xs"
                    >
                      {campaign.status === "active" ? "pause" : "activate"}
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                {criteria && (Object.values(criteria).some(Boolean)) && (
                  <div className="flex flex-wrap gap-2">
                    {criteria.agency && (
                      <span className="text-xs border border-border px-2 py-0.5 text-muted-foreground">
                        agency: {criteria.agency}
                      </span>
                    )}
                    {criteria.area && (
                      <span className="text-xs border border-border px-2 py-0.5 text-muted-foreground">
                        area: {criteria.area}
                      </span>
                    )}
                    {criteria.status && (
                      <span className="text-xs border border-border px-2 py-0.5 text-muted-foreground">
                        stage: {criteria.status}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                {stats && (
                  <div className="flex items-center gap-6 pt-1 border-t border-border">
                    <div className="text-center">
                      <p className="text-sm font-medium">{stats.sent ?? 0}</p>
                      <p className="spatia-label text-[10px]">sent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{stats.opened ?? 0}</p>
                      <p className="spatia-label text-[10px]">opened</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{stats.replied ?? 0}</p>
                      <p className="spatia-label text-[10px]">replied</p>
                    </div>
                    {(stats.sent ?? 0) > 0 && (
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {Math.round(((stats.replied ?? 0) / (stats.sent ?? 1)) * 100)}%
                        </p>
                        <p className="spatia-label text-[10px]">reply rate</p>
                      </div>
                    )}
                    <Link
                      href="/outreach"
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink size={10} /> view queue
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <CampaignForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
