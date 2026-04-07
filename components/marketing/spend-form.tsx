"use client"

import { useState } from "react"
import { toast } from "sonner"

type Channel = "meta" | "google" | "instagram_promoted" | "other"

interface Props {
  onCreated: () => void
}

export function SpendForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      date: fd.get("date"),
      channel: fd.get("channel") as Channel,
      campaign_name: fd.get("campaign_name") || null,
      amount_spent: Number(fd.get("amount_spent")),
      impressions: fd.get("impressions") ? Number(fd.get("impressions")) : null,
      clicks: fd.get("clicks") ? Number(fd.get("clicks")) : null,
      leads_generated: fd.get("leads_generated") ? Number(fd.get("leads_generated")) : null,
    }
    const res = await fetch("/api/marketing-spend", { method: "POST", body: JSON.stringify(body) })
    setLoading(false)
    if (res.ok) {
      toast.success("Spend entry added")
      setOpen(false)
      onCreated()
    } else {
      const j = await res.json()
      toast.error(j.error ?? "Failed")
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm"
      >
        + log spend
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-card p-5 space-y-4 max-w-lg">
      <p className="spatia-label">log ad spend</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">date</label>
          <input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">channel</label>
          <select name="channel" className="w-full bg-background border border-border px-3 py-2 text-sm">
            <option value="meta">Meta Ads</option>
            <option value="google">Google Ads</option>
            <option value="instagram_promoted">Instagram Promoted</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="spatia-label text-xs text-muted-foreground">campaign name</label>
          <input name="campaign_name" placeholder="South Shore Agents — Spring" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">amount spent ($)</label>
          <input name="amount_spent" type="number" step="0.01" min="0" required placeholder="25.00" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">impressions</label>
          <input name="impressions" type="number" min="0" placeholder="1200" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">clicks</label>
          <input name="clicks" type="number" min="0" placeholder="45" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">leads generated</label>
          <input name="leads_generated" type="number" min="0" placeholder="3" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-50">
          {loading ? "saving..." : "save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="spatia-label px-4 py-2 border border-border hover:bg-accent text-sm">cancel</button>
      </div>
    </form>
  )
}
