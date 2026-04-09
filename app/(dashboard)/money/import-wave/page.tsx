import { createClient } from "@/lib/supabase/server"
import { WaveImportClient } from "@/components/money/wave-import-client"

async function getContacts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select("id, name, agency")
    .order("name")
  return data ?? []
}

export default async function ImportWavePage() {
  const contacts = await getContacts()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">import wave</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          upload CSV exports from Wave — invoices or expenses
        </p>
      </div>
      <WaveImportClient contacts={contacts} />
    </div>
  )
}
