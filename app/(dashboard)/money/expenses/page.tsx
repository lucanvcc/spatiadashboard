import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/pricing"
import { ExpensesClient } from "@/components/money/expenses-client"

async function getExpenseSummary() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3)

  const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10)
  const startOfQtr = new Date(year, quarter * 3, 1).toISOString().slice(0, 10)
  const startOfYear = `${year}-01-01`

  const [{ data: expensesMtd }, { data: expensesQtd }, { data: expensesYtd }] = await Promise.all([
    supabase.from("expenses").select("amount").gte("date", startOfMonth),
    supabase.from("expenses").select("amount").gte("date", startOfQtr),
    supabase.from("expenses").select("amount").gte("date", startOfYear),
  ])

  return {
    mtd: (expensesMtd ?? []).reduce((s, e) => s + e.amount, 0),
    qtd: (expensesQtd ?? []).reduce((s, e) => s + e.amount, 0),
    ytd: (expensesYtd ?? []).reduce((s, e) => s + e.amount, 0),
  }
}

export default async function ExpensesPage() {
  const summary = await getExpenseSummary()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">expenses</h1>
        <p className="text-muted-foreground text-xs mt-0.5">manual entry · wave import · GST/QST input tax credits</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">expenses mtd</p>
          <p className="font-heading text-xl">{formatCurrency(summary.mtd)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">expenses qtd</p>
          <p className="font-heading text-xl">{formatCurrency(summary.qtd)}</p>
        </div>
        <div className="border border-border bg-card p-4 space-y-1">
          <p className="spatia-label text-xs text-muted-foreground">expenses ytd</p>
          <p className="font-heading text-xl">{formatCurrency(summary.ytd)}</p>
        </div>
      </div>

      {/* Client component handles table + add form */}
      <ExpensesClient />
    </div>
  )
}
