"use client"

import { formatCurrency } from "@/lib/pricing"

export interface AgingBucket {
  label: string
  count: number
  total: number
  color: string
}

interface InvoiceAgingProps {
  buckets: AgingBucket[]
  avgDaysToPay: number | null
  fastestDays: number | null
  slowestDays: number | null
}

export function InvoiceAging({ buckets, avgDaysToPay, fastestDays, slowestDays }: InvoiceAgingProps) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const totalInvoices = buckets.reduce((s, b) => s + b.count, 0)

  if (totalInvoices === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Aucune facture payée — pas encore de données de vieillissement.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">délai moyen</p>
          <p className="font-mono text-xl mt-0.5">
            {avgDaysToPay !== null ? `${Math.round(avgDaysToPay)}j` : "—"}
          </p>
        </div>
        <div>
          <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">plus rapide</p>
          <p className="font-mono text-xl mt-0.5 text-emerald-400">
            {fastestDays !== null ? `${fastestDays}j` : "—"}
          </p>
        </div>
        <div>
          <p className="spatia-label text-[10px] text-muted-foreground uppercase tracking-widest">plus lent</p>
          <p className="font-mono text-xl mt-0.5 text-amber-400">
            {slowestDays !== null ? `${slowestDays}j` : "—"}
          </p>
        </div>
      </div>

      {/* Waterfall bars */}
      <div className="space-y-2">
        {buckets.map((bucket) => {
          const pct = bucket.count / maxCount
          const valuePct = totalInvoices > 0 ? bucket.count / totalInvoices : 0
          return (
            <div key={bucket.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="spatia-label text-xs text-muted-foreground">{bucket.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{bucket.count} facture{bucket.count !== 1 ? "s" : ""}</span>
                  <span className="font-mono text-xs text-foreground w-20 text-right">{formatCurrency(bucket.total)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-6 bg-border/30 relative overflow-hidden">
                  <div
                    className={`h-full transition-all ${bucket.color}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                  {bucket.count > 0 && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-background/80">
                      {(valuePct * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="spatia-label text-[10px] text-muted-foreground">
        basé sur {totalInvoices} facture{totalInvoices !== 1 ? "s" : ""} payée{totalInvoices !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
