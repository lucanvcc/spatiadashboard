import { createClient } from "@/lib/supabase/server"
import { KanbanBoard } from "@/components/crm/kanban-board"
import { Contact, PIPELINE_STAGES } from "@/types/database"
import Link from "next/link"
import { Upload, UserPlus } from "lucide-react"
import { Suspense } from "react"

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending: false })

  const allContacts: Contact[] = contacts ?? []

  // Stage counts for header
  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, { key }) => {
    acc[key] = allContacts.filter((c) => c.status === key).length
    return acc
  }, {} as Record<string, number>)

  const activeLeads = allContacts.filter(
    (c) => !["churned", "paying_client"].includes(c.status)
  ).length

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <h1 className="font-heading text-xl tracking-tight">crm — contact pipeline</h1>
          <p className="text-xs text-muted-foreground">
            {allContacts.length} contacts · {activeLeads} active · {stageCounts["client"] ?? 0} paying clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/crm?new=1"
            className="flex items-center gap-2 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <UserPlus size={12} strokeWidth={1.5} />
            nouveau
          </Link>
          <Link
            href="/crm/import"
            className="flex items-center gap-2 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Upload size={12} strokeWidth={1.5} />
            import csv
          </Link>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <KanbanBoard initialContacts={allContacts} />
        </Suspense>
      </div>
    </div>
  )
}
