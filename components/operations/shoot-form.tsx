"use client"

import { useState } from "react"
import { toast } from "sonner"
import { calculateShootPrice } from "@/lib/pricing"
import { formatCurrency } from "@/lib/pricing"
import type { ShootStatus } from "@/types"

interface Contact {
  id: string
  name: string
  agency: string | null
}

interface Props {
  contacts: Contact[]
  onCreated: () => void
}

const STATUSES: ShootStatus[] = ["booked", "shot", "processing", "delivered", "paid"]

export function ShootForm({ contacts, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sqft, setSqft] = useState("")
  const [isRush, setIsRush] = useState(false)
  const [isTravel, setIsTravel] = useState(false)

  const pricing =
    sqft && !isNaN(Number(sqft)) && Number(sqft) > 0
      ? calculateShootPrice(Number(sqft), isRush, isTravel)
      : null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      contact_id: fd.get("contact_id"),
      address: fd.get("address"),
      sq_ft: Number(fd.get("sq_ft")),
      is_rush: isRush,
      is_travel: isTravel,
      status: fd.get("status") ?? "booked",
      scheduled_at: fd.get("scheduled_at") || null,
      notes: fd.get("notes") || null,
    }
    const res = await fetch("/api/shoots", { method: "POST", body: JSON.stringify(body) })
    setLoading(false)
    if (res.ok) {
      toast.success("Shoot added")
      setOpen(false)
      onCreated()
    } else {
      const j = await res.json()
      toast.error(j.error ?? "Failed to add shoot")
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm"
      >
        + add shoot
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-card p-5 space-y-4 max-w-lg">
      <p className="spatia-label">new shoot</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <label className="spatia-label text-xs text-muted-foreground">client</label>
          <select name="contact_id" required className="w-full bg-background border border-border px-3 py-2 text-sm">
            <option value="">select client</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.agency ? ` — ${c.agency}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 col-span-2">
          <label className="spatia-label text-xs text-muted-foreground">address</label>
          <input name="address" required placeholder="123 Rue Example, Brossard" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">sq ft</label>
          <input
            name="sq_ft"
            type="number"
            min="1"
            required
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
            placeholder="1200"
            className="w-full bg-background border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">scheduled</label>
          <input name="scheduled_at" type="datetime-local" className="w-full bg-background border border-border px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="spatia-label text-xs text-muted-foreground">status</label>
          <select name="status" className="w-full bg-background border border-border px-3 py-2 text-sm">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isRush} onChange={(e) => setIsRush(e.target.checked)} className="accent-foreground" />
            <span className="spatia-label text-xs">rush +$50</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isTravel} onChange={(e) => setIsTravel(e.target.checked)} className="accent-foreground" />
            <span className="spatia-label text-xs">travel +$25</span>
          </label>
        </div>
      </div>

      {pricing && (
        <div className="bg-accent/30 px-3 py-2 text-sm space-y-0.5">
          <p className="spatia-label text-xs text-muted-foreground">price preview</p>
          <p className="font-heading text-lg">{formatCurrency(pricing.total_price)}</p>
          <p className="text-xs text-muted-foreground">
            Tier {pricing.tier} base {formatCurrency(pricing.base_price)}
            {pricing.rush_surcharge > 0 && ` + rush ${formatCurrency(pricing.rush_surcharge)}`}
            {pricing.travel_surcharge > 0 && ` + travel ${formatCurrency(pricing.travel_surcharge)}`}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label className="spatia-label text-xs text-muted-foreground">notes</label>
        <textarea name="notes" rows={2} placeholder="Gate code, key location, etc." className="w-full bg-background border border-border px-3 py-2 text-sm resize-none" />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 transition-opacity text-sm disabled:opacity-50">
          {loading ? "saving..." : "save shoot"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm">
          cancel
        </button>
      </div>
    </form>
  )
}
