"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/pricing"
import { GST_RATE, QST_RATE } from "@/lib/pricing"
import type { InvoiceStatus } from "@/types"

interface Contact {
  id: string
  name: string
  agency: string | null
}

interface Invoice {
  id: string
  contact_id: string
  shoot_id: string | null
  wave_invoice_id: string | null
  amount: number
  discount: number
  subtotal: number
  gst: number
  qst: number
  total: number
  status: InvoiceStatus
  due_at: string | null
  paid_at: string | null
  created_at: string
  contacts: { name: string; agency: string | null } | null
  shoots: { address: string } | null
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-400",
  paid: "text-emerald-400",
  overdue: "text-red-400",
  cancelled: "text-muted-foreground",
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export function InvoicesTracker({ contacts }: { contacts: Contact[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all")
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [discount, setDiscount] = useState("0")

  const load = useCallback(async () => {
    const url = filter === "all" ? "/api/invoices" : `/api/invoices?status=${filter}`
    const res = await fetch(url)
    if (res.ok) setInvoices(await res.json())
  }, [filter])

  useEffect(() => { load() }, [load])

  const subtotal = Math.max(0, Number(amount) - Number(discount || 0))
  const gst = Math.round(subtotal * GST_RATE * 100) / 100
  const qst = Math.round(subtotal * QST_RATE * 100) / 100
  const total = subtotal + gst + qst

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0)
  const outstanding = invoices.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const totalGst = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.gst, 0)
  const totalQst = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.qst, 0)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      contact_id: fd.get("contact_id"),
      wave_invoice_id: fd.get("wave_invoice_id") || null,
      amount: Number(fd.get("amount")),
      discount: Number(fd.get("discount") || 0),
      status: fd.get("status") ?? "sent",
      due_at: fd.get("due_at") || null,
    }
    const res = await fetch("/api/invoices", { method: "POST", body: JSON.stringify(body) })
    setLoading(false)
    if (res.ok) { toast.success("Invoice added"); setAddOpen(false); load() }
    else { const j = await res.json(); toast.error(j.error ?? "Failed") }
  }

  async function markPaid(id: string) {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "paid" }),
    })
    if (res.ok) { toast.success("Marked as paid"); load() }
    else toast.error("Failed")
  }

  async function markOverdue(id: string) {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "overdue" }),
    })
    if (res.ok) { toast.success("Marked as overdue"); load() }
    else toast.error("Failed")
  }

  const displayed = filter === "all" ? invoices : invoices.filter((i) => i.status === filter)

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">collected</p>
          <p className="font-heading text-xl">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">outstanding</p>
          <p className={`font-heading text-xl ${outstanding > 0 ? "text-amber-400" : ""}`}>{formatCurrency(outstanding)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">GST collected</p>
          <p className="font-heading text-xl">{formatCurrency(totalGst)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">QST collected</p>
          <p className="font-heading text-xl">{formatCurrency(totalQst)}</p>
        </div>
      </div>

      {/* Overdue alerts */}
      {invoices.filter((i) => i.status === "overdue").length > 0 && (
        <div className="border border-red-400/30 bg-red-400/5 px-4 py-3">
          <p className="spatia-label text-xs text-red-400">
            ⚠ {invoices.filter((i) => i.status === "overdue").length} overdue invoice{invoices.filter((i) => i.status === "overdue").length > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Filters + Add */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAddOpen(!addOpen)} className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm">
            + add invoice
          </button>
          {(["all", "draft", "sent", "paid", "overdue", "cancelled"] as const).map((s) => (
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

        {addOpen && (
          <form onSubmit={handleAdd} className="border border-border bg-card p-5 space-y-4">
            <p className="spatia-label text-sm">new invoice</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="spatia-label text-xs text-muted-foreground">client</label>
                <select name="contact_id" required className="w-full bg-background border border-border px-3 py-2 text-sm">
                  <option value="">select client</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.agency ? ` — ${c.agency}` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">amount ($)</label>
                <input name="amount" type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200.00" className="w-full bg-background border border-border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">discount ($)</label>
                <input name="discount" type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-full bg-background border border-border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">status</label>
                <select name="status" className="w-full bg-background border border-border px-3 py-2 text-sm">
                  <option value="sent">sent</option>
                  <option value="draft">draft</option>
                  <option value="paid">paid</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">due date</label>
                <input name="due_at" type="date" className="w-full bg-background border border-border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="spatia-label text-xs text-muted-foreground">Wave invoice ID (optional)</label>
                <input name="wave_invoice_id" placeholder="INV-001" className="w-full bg-background border border-border px-3 py-2 text-sm" />
              </div>
            </div>
            {amount && Number(amount) > 0 && (
              <div className="bg-accent/30 px-3 py-2 text-sm space-y-0.5">
                <p className="spatia-label text-xs text-muted-foreground">tax preview (GST 5% + QST 9.975%)</p>
                <p className="font-heading text-base">{formatCurrency(total)}</p>
                <p className="text-xs text-muted-foreground">subtotal {formatCurrency(subtotal)} + GST {formatCurrency(gst)} + QST {formatCurrency(qst)}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-50">
                {loading ? "saving..." : "save invoice"}
              </button>
              <button type="button" onClick={() => setAddOpen(false)} className="spatia-label px-4 py-2 border border-border hover:bg-accent text-sm">cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Invoice list */}
      {displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">no invoices found</p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {displayed.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{inv.contacts?.name ?? "—"}</p>
                  <span className={`spatia-label text-xs ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                  {inv.status === "sent" && inv.due_at && daysSince(inv.due_at) > 0 && (
                    <span className="spatia-label text-xs text-red-400">{daysSince(inv.due_at)}d overdue</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.shoots?.address ?? (inv.wave_invoice_id ? `Wave ${inv.wave_invoice_id}` : "manual entry")}
                  {inv.due_at && ` · due ${new Date(inv.due_at).toLocaleDateString("en-CA")}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-heading text-base">{formatCurrency(inv.total)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(inv.subtotal)} + tax</p>
                </div>
                {inv.status === "sent" && (
                  <>
                    <button onClick={() => markPaid(inv.id)} className="spatia-label text-xs px-3 py-1 border border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                      mark paid
                    </button>
                    <button onClick={() => markOverdue(inv.id)} className="spatia-label text-xs px-3 py-1 border border-border text-muted-foreground hover:text-foreground transition-colors">
                      overdue
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
