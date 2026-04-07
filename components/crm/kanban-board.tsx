"use client"

import { useState, useCallback } from "react"
import { Contact, ContactStatus, PIPELINE_STAGES } from "@/types/database"
import { KanbanColumn } from "./kanban-column"
import { ContactDrawer } from "./contact-drawer"
import { toast } from "sonner"

interface KanbanBoardProps {
  initialContacts: Contact[]
}

export function KanbanBoard({ initialContacts }: KanbanBoardProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<ContactStatus | null>(null)

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
    </>
  )
}
