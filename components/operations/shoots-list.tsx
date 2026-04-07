"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { ShootForm } from "./shoot-form"
import { formatCurrency } from "@/lib/pricing"
import type { ShootStatus } from "@/types"

interface Contact {
  id: string
  name: string
  email: string
  agency: string | null
}

interface Shoot {
  id: string
  address: string
  sq_ft: number
  tier: number
  total_price: number
  status: ShootStatus
  scheduled_at: string | null
  delivered_at: string | null
  matterport_url: string | null
  notes: string | null
  contacts: { name: string; agency: string | null } | null
}

const STATUS_ORDER: ShootStatus[] = ["booked", "shot", "processing", "delivered", "paid"]

const STATUS_COLORS: Record<ShootStatus, string> = {
  booked: "text-blue-400",
  shot: "text-yellow-400",
  processing: "text-amber-400",
  delivered: "text-emerald-400",
  paid: "text-emerald-600",
}

function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function ShootsList({ contacts }: { contacts: Contact[] }) {
  const [shoots, setShoots] = useState<Shoot[]>([])
  const [filter, setFilter] = useState<ShootStatus | "all">("all")
  const [editingMatterport, setEditingMatterport] = useState<string | null>(null)
  const [matterportUrl, setMatterportUrl] = useState("")

  const load = useCallback(async () => {
    const url = filter === "all" ? "/api/shoots" : `/api/shoots?status=${filter}`
    const res = await fetch(url)
    if (res.ok) setShoots(await res.json())
  }, [filter])

  useEffect(() => { load() }, [load])

  async function advanceStatus(shoot: Shoot) {
    const idx = STATUS_ORDER.indexOf(shoot.status)
    if (idx === STATUS_ORDER.length - 1) return
    const next = STATUS_ORDER[idx + 1]
    const updates: Record<string, unknown> = { status: next }
    if (next === "delivered") updates.delivered_at = new Date().toISOString()
    if (next === "paid") updates.paid_at = new Date().toISOString()
    const res = await fetch(`/api/shoots/${shoot.id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })
    if (res.ok) { toast.success(`Status → ${next}`); load() }
    else toast.error("Failed to update")
  }

  async function saveMatterport(id: string) {
    const res = await fetch(`/api/shoots/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ matterport_url: matterportUrl }),
    })
    if (res.ok) { toast.success("URL saved"); setEditingMatterport(null); load() }
    else toast.error("Failed")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <ShootForm contacts={contacts} onCreated={load} />
        <div className="flex gap-1">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`spatia-label px-3 py-1.5 text-xs border transition-colors ${
                filter === s ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {shoots.length === 0 ? (
        <p className="text-muted-foreground text-sm">no shoots found</p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {shoots.map((shoot) => (
            <div key={shoot.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{shoot.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {shoot.contacts?.name ?? "—"}{shoot.contacts?.agency ? ` · ${shoot.contacts.agency}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="font-heading text-base">{formatCurrency(shoot.total_price)}</p>
                  <p className="text-xs text-muted-foreground">Tier {shoot.tier} · {shoot.sq_ft.toLocaleString()} sq ft</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className={`spatia-label text-xs ${STATUS_COLORS[shoot.status]}`}>
                  {shoot.status}
                </span>
                {shoot.scheduled_at && (
                  <span className="text-xs text-muted-foreground">{fmtDate(shoot.scheduled_at)}</span>
                )}
                {shoot.matterport_url && (
                  <a href={shoot.matterport_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 underline">
                    tour ↗
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {shoot.status !== "paid" && (
                  <button
                    onClick={() => advanceStatus(shoot)}
                    className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors"
                  >
                    → {STATUS_ORDER[STATUS_ORDER.indexOf(shoot.status) + 1]}
                  </button>
                )}
                {(shoot.status === "delivered" || shoot.status === "paid") && !shoot.matterport_url && (
                  editingMatterport === shoot.id ? (
                    <div className="flex gap-1">
                      <input
                        value={matterportUrl}
                        onChange={(e) => setMatterportUrl(e.target.value)}
                        placeholder="https://my.matterport.com/show/?m=..."
                        className="bg-background border border-border px-2 py-1 text-xs w-64"
                      />
                      <button onClick={() => saveMatterport(shoot.id)} className="spatia-label text-xs px-2 py-1 bg-foreground text-background">save</button>
                      <button onClick={() => setEditingMatterport(null)} className="spatia-label text-xs px-2 py-1 border border-border">cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingMatterport(shoot.id); setMatterportUrl("") }}
                      className="spatia-label text-xs px-3 py-1 border border-border hover:bg-accent transition-colors text-muted-foreground"
                    >
                      + matterport url
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
