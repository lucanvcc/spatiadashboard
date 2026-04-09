"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/pricing"
import type { Expense, ExpenseCategory } from "@/types"

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "equipment", label: "equipment" },
  { value: "software", label: "software" },
  { value: "matterport_subscription", label: "matterport" },
  { value: "marketing", label: "marketing" },
  { value: "travel", label: "travel" },
  { value: "other", label: "other" },
]

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  equipment: "text-blue-400",
  software: "text-purple-400",
  matterport_subscription: "text-emerald-400",
  marketing: "text-amber-400",
  travel: "text-orange-400",
  other: "text-muted-foreground",
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all")

  const load = useCallback(async () => {
    setLoading(true)
    const url =
      filterCategory === "all"
        ? "/api/money/expenses?limit=200"
        : `/api/money/expenses?category=${filterCategory}&limit=200`
    const res = await fetch(url)
    if (res.ok) setExpenses(await res.json())
    setLoading(false)
  }, [filterCategory])

  useEffect(() => {
    load()
  }, [load])

  // Category breakdown
  const breakdown: Record<string, number> = {}
  for (const e of expenses) {
    breakdown[e.category] = (breakdown[e.category] ?? 0) + e.amount
  }
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      date: fd.get("date") as string,
      category: fd.get("category") as string,
      description: fd.get("description") as string,
      amount: parseFloat(fd.get("amount") as string),
      gst_paid: parseFloat((fd.get("gst_paid") as string) || "0"),
      qst_paid: parseFloat((fd.get("qst_paid") as string) || "0"),
      vendor: (fd.get("vendor") as string) || undefined,
      receipt_url: (fd.get("receipt_url") as string) || undefined,
    }
    const res = await fetch("/api/money/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Expense added")
      setAddOpen(false)
      ;(e.target as HTMLFormElement).reset()
      load()
    } else {
      const j = await res.json()
      toast.error(j.error ?? "Failed to add expense")
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/money/expenses/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Expense deleted")
      load()
    } else {
      toast.error("Failed to delete")
    }
  }

  const displayed = expenses

  return (
    <div className="space-y-5">
      {/* Category breakdown */}
      {totalExpenses > 0 && (
        <div className="border border-border bg-card p-5 space-y-3">
          <p className="spatia-label text-xs text-muted-foreground">by category</p>
          <div className="space-y-2">
            {Object.entries(breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-3">
                  <p className={`spatia-label text-xs w-32 shrink-0 ${CATEGORY_COLORS[cat as ExpenseCategory] ?? "text-muted-foreground"}`}>
                    {cat.replace("_", " ")}
                  </p>
                  <div className="flex-1 h-4 bg-border/30">
                    <div
                      className="h-full bg-foreground/25 transition-all"
                      style={{ width: `${(amt / totalExpenses) * 100}%` }}
                    />
                  </div>
                  <p className="spatia-label text-xs tabular-nums shrink-0">{formatCurrency(amt)}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddOpen(!addOpen)}
            className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm"
          >
            + add expense
          </button>
          <button
            onClick={() => setFilterCategory("all")}
            className={`spatia-label px-3 py-1.5 text-xs border transition-colors ${
              filterCategory === "all"
                ? "border-foreground bg-accent text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            all
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`spatia-label px-3 py-1.5 text-xs border transition-colors ${
                filterCategory === c.value
                  ? "border-foreground bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {addOpen && (
          <form
            onSubmit={handleAdd}
            className="border border-border bg-card p-5 space-y-4"
          >
            <p className="spatia-label text-sm">new expense</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">date</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">category</label>
                <select
                  name="category"
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="spatia-label text-xs text-muted-foreground">description</label>
                <input
                  name="description"
                  required
                  placeholder="e.g. Matterport monthly plan"
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">amount ($)</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">vendor</label>
                <input
                  name="vendor"
                  placeholder="e.g. Matterport Inc."
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">GST paid ($)</label>
                <input
                  name="gst_paid"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="spatia-label text-xs text-muted-foreground">QST paid ($)</label>
                <input
                  name="qst_paid"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="spatia-label text-xs text-muted-foreground">receipt URL (optional)</label>
                <input
                  name="receipt_url"
                  type="url"
                  placeholder="https://..."
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 text-sm disabled:opacity-50"
              >
                {saving ? "saving..." : "save expense"}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="spatia-label px-4 py-2 border border-border hover:bg-accent text-sm"
              >
                cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground text-sm animate-pulse">loading...</div>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">no expenses found</p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {displayed.map((exp) => (
            <div key={exp.id} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm">{exp.description}</p>
                  <span
                    className={`spatia-label text-xs ${CATEGORY_COLORS[exp.category] ?? "text-muted-foreground"}`}
                  >
                    {exp.category.replace("_", " ")}
                  </span>
                  {exp.source_system !== "manual" && (
                    <span className="spatia-label text-xs text-muted-foreground/60">wave</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(exp.date)}
                  {exp.vendor ? ` · ${exp.vendor}` : ""}
                  {exp.gst_paid > 0 || exp.qst_paid > 0
                    ? ` · GST ${formatCurrency(exp.gst_paid)} + QST ${formatCurrency(exp.qst_paid)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-heading text-base">{formatCurrency(exp.amount)}</p>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="spatia-label text-xs text-muted-foreground hover:text-red-400 transition-colors px-2 py-1"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
