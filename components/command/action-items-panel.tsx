"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Check,
  X,
  RefreshCw,
  Mail,
  DollarSign,
  Box,
  BarChart2,
  Camera,
  TrendingUp,
} from "lucide-react"
import type { AnyActionItem, ActionItemType } from "@/types/action-items"

type ActionItemSeverity = "critical" | "warning" | "info" | "success"

const SEVERITY_ORDER: Record<ActionItemSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
}

const SEVERITY_CONFIG: Record<ActionItemSeverity, {
  accent: string
  bg: string
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}> = {
  critical: {
    accent: "bg-red-400",
    bg: "bg-red-400/5",
    label: "critique",
    Icon: AlertCircle,
  },
  warning: {
    accent: "bg-amber-400",
    bg: "bg-amber-400/5",
    label: "attention",
    Icon: AlertTriangle,
  },
  info: {
    accent: "bg-blue-400/60",
    bg: "",
    label: "info",
    Icon: Info,
  },
  success: {
    accent: "bg-emerald-400",
    bg: "bg-emerald-400/5",
    label: "opportunité",
    Icon: TrendingUp,
  },
}

function typeIcon(type: ActionItemType) {
  const props = { size: 12, strokeWidth: 1.5, className: "shrink-0 text-muted-foreground" }
  switch (type) {
    case "followup_due": return <Mail {...props} />
    case "invoice_overdue": return <DollarSign {...props} />
    case "slot_warning": return <Box {...props} />
    case "campaign_waste":
    case "campaign_scale": return <BarChart2 {...props} />
    case "shoot_today":
    case "shoot_tomorrow": return <Camera {...props} />
    default: return <AlertTriangle {...props} />
  }
}

function quickActionLabel(type: ActionItemType): string | null {
  switch (type) {
    case "followup_due": return "Ouvrir courriel"
    case "invoice_overdue": return "Marquer payée"
    case "campaign_waste":
    case "campaign_scale": return "Voir campagne"
    case "slot_warning": return "Gérer tours"
    default: return null
  }
}

function quickActionUrl(item: AnyActionItem): string | null {
  switch (item.type) {
    case "followup_due": return item.related_entity_id ? `/outreach?contact=${item.related_entity_id}` : "/outreach"
    case "campaign_waste":
    case "campaign_scale": return "/marketing"
    case "slot_warning": return "/operations/tours"
    default: return null
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}j`
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return "maintenant"
}

interface ActionItemCardProps {
  item: AnyActionItem
  onAction: (id: string, action: "resolve" | "dismiss") => Promise<void>
}

function ActionItemCard({ item, onAction }: ActionItemCardProps) {
  const router = useRouter()
  const sev = item.severity as ActionItemSeverity
  const config = SEVERITY_CONFIG[sev] ?? SEVERITY_CONFIG.info
  const [loading, setLoading] = useState<"resolve" | "dismiss" | null>(null)

  async function handleAction(action: "resolve" | "dismiss") {
    setLoading(action)
    await onAction(item.id, action)
    setLoading(null)
  }

  function handleNavigate(url: string) {
    router.push(url)
  }

  return (
    <div className={`relative flex gap-3 p-3.5 border border-border/60 ${config.bg} group`}>
      {/* Severity accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${config.accent}`} />

      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        {typeIcon(item.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => item.related_url && handleNavigate(item.related_url)}
            className="text-sm font-medium text-left leading-snug hover:underline underline-offset-2 text-foreground line-clamp-2"
          >
            {item.title}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">
            {timeAgo(item.created_at)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          {/* Quick action */}
          {quickActionLabel(item.type) && quickActionUrl(item) && (
            <button
              onClick={() => handleNavigate(quickActionUrl(item)!)}
              className="spatia-label text-[10px] px-2 py-0.5 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {quickActionLabel(item.type)}
            </button>
          )}

          {/* Resolve */}
          <button
            onClick={() => handleAction("resolve")}
            disabled={loading !== null}
            className="flex items-center gap-1 spatia-label text-[10px] px-2 py-0.5 border border-border/60 text-muted-foreground hover:text-emerald-400 hover:border-emerald-400/40 transition-colors disabled:opacity-50"
          >
            {loading === "resolve" ? (
              <RefreshCw size={9} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Check size={9} strokeWidth={2} />
            )}
            Résolu
          </button>

          {/* Dismiss */}
          <button
            onClick={() => handleAction("dismiss")}
            disabled={loading !== null}
            className="flex items-center gap-1 spatia-label text-[10px] px-2 py-0.5 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
          >
            {loading === "dismiss" ? (
              <RefreshCw size={9} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <X size={9} strokeWidth={2} />
            )}
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}

export function ActionItemsPanel() {
  const [items, setItems] = useState<AnyActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/command/action-items?status=active&limit=50")
      if (!res.ok) throw new Error("failed to load")
      const data = await res.json()
      setItems(data.action_items ?? [])
    } catch {
      setError("Impossible de charger les actions.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function handleAction(id: string, action: "resolve" | "dismiss") {
    try {
      const res = await fetch(`/api/command/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("failed")
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success(action === "resolve" ? "Action résolue." : "Reportée.")
    } catch {
      toast.error("Erreur lors de la mise à jour.")
    }
  }

  // Group by severity
  const grouped = items.reduce<Record<string, AnyActionItem[]>>((acc, item) => {
    const sev = item.severity as ActionItemSeverity
    if (!acc[sev]) acc[sev] = []
    acc[sev].push(item)
    return acc
  }, {})

  const severities: ActionItemSeverity[] = ["critical", "warning", "info", "success"]

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} strokeWidth={1.5} className="text-muted-foreground" />
          <p className="spatia-label text-xs text-muted-foreground">aujourd&apos;hui</p>
        </div>
        {!loading && items.length > 0 && (
          <span className="spatia-label text-[10px] text-muted-foreground">
            {items.length} action{items.length > 1 ? "s" : ""} en attente
          </span>
        )}
      </div>

      {loading && (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted/20 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="px-5 py-12 text-center space-y-2">
          <CheckCircle2 size={24} strokeWidth={1} className="text-emerald-400/60 mx-auto" />
          <p className="text-sm text-muted-foreground">Rien à signaler. Bonne journée.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="divide-y divide-border/40">
          {severities.map((sev) => {
            const group = grouped[sev] ?? []
            if (group.length === 0) return null
            const config = SEVERITY_CONFIG[sev]
            return (
              <div key={sev}>
                <div className="px-5 py-2 bg-muted/10">
                  <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">
                    {config.label} ({group.length})
                  </p>
                </div>
                <div className="divide-y divide-border/30 px-3 pb-2 pt-1 space-y-1">
                  {group.map((item) => (
                    <ActionItemCard key={item.id} item={item} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
