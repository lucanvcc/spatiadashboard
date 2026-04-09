"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors spatia-label text-xs print:hidden"
    >
      <Printer size={13} strokeWidth={1.5} />
      imprimer
    </button>
  )
}
