import { createClient } from "@/lib/supabase/server"
import { InvoicesTracker } from "@/components/operations/invoices-tracker"

async function getContacts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, name, agency")
    .order("name")
  return data ?? []
}

export default async function MoneyInvoicesPage() {
  const contacts = await getContacts()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl tracking-tight">invoices</h1>
        <p className="text-muted-foreground text-xs mt-0.5">manual entry · GST 5% + QST 9.975% · wave sync</p>
      </div>
      <InvoicesTracker contacts={contacts} />
    </div>
  )
}
