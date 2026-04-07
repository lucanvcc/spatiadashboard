"use client"

import { Contact } from "@/types/database"
import { cn } from "@/lib/utils"
import { Building2, Mail, Phone } from "lucide-react"

interface ContactCardProps {
  contact: Contact
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}

export function ContactCard({ contact, onClick, onDragStart }: ContactCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "border border-border bg-card p-3 space-y-2 cursor-pointer",
        "hover:border-foreground/20 transition-colors select-none",
        "active:opacity-60"
      )}
    >
      <p className="text-sm font-medium leading-tight truncate">{contact.name}</p>

      {contact.agency && (
        <div className="flex items-center gap-1.5">
          <Building2 size={10} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{contact.agency}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {contact.email && (
          <div className="flex items-center gap-1">
            <Mail size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-1">
            <Phone size={10} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{contact.phone}</span>
          </div>
        )}
      </div>

      {contact.areas_served && contact.areas_served.length > 0 && (
        <p className="text-xs text-muted-foreground/70">{contact.areas_served[0]}</p>
      )}
    </div>
  )
}
