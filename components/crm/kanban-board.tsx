"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Contact, ContactStatus, PIPELINE_STAGES } from "@/types/database"
import { KanbanColumn } from "./kanban-column"
import { ContactDrawer } from "./contact-drawer"
import { toast } from "sonner"
import { X } from "lucide-react"

interface KanbanBoardProps {
  initialContacts: Contact[]
}

// ─── Quick-add Contact Form ───────────────────────────────────────────────────

function NewContactDialog({ onCreated, onClose }: { onCreated: (c: Contact) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get("name"),
      email: fd.get("email") || null,
      phone: fd.get("phone") || null,
      agency: fd.get("agency") || null,
      areas_served: ["Rive-Sud", "Grand Montréal"],
      status: "new_lead",
      language: "fr",
    }
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      toast.success("Contact ajouté.")
      onCreated(data.contact ?? data)
      onClose()
    } else {
      const j = await res.json()
      toast.error(j.error ?? "Erreur lors de la création")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-card border border-border w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="spatia-label text-sm">nouveau contact</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="spatia-label text-xs text-muted-foreground">nom *</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="Marie Tremblay"
              className="w-full bg-background border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">courriel</label>
              <input
                name="email"
                type="email"
                placeholder="marie@remax.ca"
                className="w-full bg-background border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="spatia-label text-xs text-muted-foreground">téléphone</label>
              <input
                name="phone"
                type="tel"
                placeholder="514-555-0000"
                className="w-full bg-background border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="spatia-label text-xs text-muted-foreground">agence</label>
            <input
              name="agency"
              placeholder="RE/MAX, Sutton, Via Capitale..."
              className="w-full bg-background border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <span className="spatia-label">défauts:</span>
            <span>Langue FR · Rive-Sud + Grand Montréal</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="spatia-label px-4 py-2 bg-foreground text-background hover:opacity-80 transition-opacity text-sm disabled:opacity-50"
            >
              {loading ? "..." : "créer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="spatia-label px-4 py-2 border border-border hover:bg-accent transition-colors text-sm"
            >
              annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function KanbanBoard({ initialContacts }: KanbanBoardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<ContactStatus | null>(null)
  const [newContactOpen, setNewContactOpen] = useState(false)

  // Open new contact dialog when ?new=1 is in URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setNewContactOpen(true)
    }
  }, [searchParams])

  function closeNewContact() {
    setNewContactOpen(false)
    // Remove ?new=1 from URL without navigation
    const params = new URLSearchParams(searchParams.toString())
    params.delete("new")
    const newUrl = params.toString() ? `/crm?${params}` : "/crm"
    router.replace(newUrl, { scroll: false })
  }

  function handleContactCreated(contact: Contact) {
    setContacts((prev) => [contact, ...prev])
  }

  const contactsByStage = PIPELINE_STAGES.reduce<Record<string, Contact[]>>((acc, { key }) => {
    acc[key] = contacts.filter((c) => c.status === key)
    return acc
  }, {} as Record<string, Contact[]>)

  const handleDrop = useCallback(
    async (contactId: string, newStage: ContactStatus) => {
      const contact = contacts.find((c) => c.id === contactId)
      if (!contact || contact.status === newStage) return

      // Optimistic update
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: newStage, updated_at: new Date().toISOString() } : c))
      )

      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStage }),
      })

      if (!res.ok) {
        // Revert on error
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, status: contact.status } : c))
        )
        toast.error("Failed to move contact")
      }
    },
    [contacts]
  )

  function handleContactClick(contact: Contact) {
    setSelectedContactId(contact.id)
    setDrawerOpen(true)
  }

  function handleContactUpdated(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(({ key, label }) => (
          <KanbanColumn
            key={key}
            stage={key}
            label={label}
            contacts={contactsByStage[key] ?? []}
            onContactClick={handleContactClick}
            onDrop={handleDrop}
            dragOverStage={dragOverStage}
            setDragOverStage={setDragOverStage}
            onDragStart={() => {}}
          />
        ))}
      </div>

      <ContactDrawer
        contactId={selectedContactId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onContactUpdated={handleContactUpdated}
      />

      {newContactOpen && (
        <NewContactDialog
          onCreated={handleContactCreated}
          onClose={closeNewContact}
        />
      )}
    </>
  )
}
