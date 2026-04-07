"use client"

import { Contact, ContactStatus } from "@/types/database"
import { ContactCard } from "./contact-card"
import { cn } from "@/lib/utils"

interface KanbanColumnProps {
  stage: ContactStatus
  label: string
  contacts: Contact[]
  onContactClick: (contact: Contact) => void
  onDrop: (contactId: string, newStage: ContactStatus) => void
  dragOverStage: ContactStatus | null
  setDragOverStage: (stage: ContactStatus | null) => void
  onDragStart: (contactId: string) => void
}

export function KanbanColumn({
  stage,
  label,
  contacts,
  onContactClick,
  onDrop,
  dragOverStage,
  setDragOverStage,
  onDragStart,
}: KanbanColumnProps) {
  const isOver = dragOverStage === stage

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOverStage(stage)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStage(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const contactId = e.dataTransfer.getData("contactId")
    if (contactId) onDrop(contactId, stage)
    setDragOverStage(null)
  }

  return (
    <div
      className={cn(
        "flex flex-col min-w-[220px] w-[220px] border border-border",
        isOver && "border-foreground/40 bg-card/80"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="spatia-label">{label}</span>
        <span className="text-xs text-muted-foreground">{contacts.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">
        {contacts.length === 0 ? (
          <div className="h-12 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/40">—</span>
          </div>
        ) : (
          contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onClick={() => onContactClick(contact)}
              onDragStart={(e) => {
                e.dataTransfer.setData("contactId", contact.id)
                onDragStart(contact.id)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
