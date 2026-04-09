"use client"

import { useState } from "react"
import { Plus, X, FileText, Users, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"

type CaptureMode = "note" | "contact" | "expense"

const MODES: { id: CaptureMode; label: string; icon: typeof FileText }[] = [
  { id: "note", label: "Note", icon: FileText },
  { id: "contact", label: "Contact", icon: Users },
  { id: "expense", label: "Dépense", icon: CreditCard },
]

const NOTE_CATEGORIES = ["general", "crm", "strategy", "ops", "finance", "ideas"] as const

export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CaptureMode>("note")
  const [loading, setLoading] = useState(false)

  // Note fields
  const [noteContent, setNoteContent] = useState("")
  const [noteCategory, setNoteCategory] = useState<typeof NOTE_CATEGORIES[number]>("general")

  // Contact fields
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactAgency, setContactAgency] = useState("")

  // Expense fields
  const [expenseDesc, setExpenseDesc] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseCategory, setExpenseCategory] = useState("other")

  function reset() {
    setNoteContent("")
    setNoteCategory("general")
    setContactName("")
    setContactEmail("")
    setContactAgency("")
    setExpenseDesc("")
    setExpenseAmount("")
    setExpenseCategory("other")
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function submit() {
    setLoading(true)
    try {
      if (mode === "note") {
        if (!noteContent.trim()) { toast.error("Note vide."); return }
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent.trim(), category: noteCategory }),
        })
        if (!res.ok) throw new Error("failed")
        toast.success("Note enregistrée.")
      } else if (mode === "contact") {
        if (!contactName.trim()) { toast.error("Nom requis."); return }
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName.trim(),
            email: contactEmail.trim() || null,
            agency: contactAgency.trim() || null,
            status: "new_lead",
            language: "fr",
            consent_basis: "implied",
          }),
        })
        if (!res.ok) throw new Error("failed")
        toast.success("Contact ajouté.")
      } else if (mode === "expense") {
        if (!expenseDesc.trim() || !expenseAmount) { toast.error("Description et montant requis."); return }
        const amount = parseFloat(expenseAmount)
        if (isNaN(amount) || amount <= 0) { toast.error("Montant invalide."); return }
        const res = await fetch("/api/money/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: expenseDesc.trim(),
            amount,
            category: expenseCategory,
            date: new Date().toISOString().slice(0, 10),
          }),
        })
        if (!res.ok) throw new Error("failed")
        toast.success("Dépense enregistrée.")
      }
      close()
    } catch {
      toast.error("Erreur — réessaie.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
        title="Capture rapide (Alt+N)"
        aria-label="Quick capture"
      >
        <Plus size={18} strokeWidth={1.5} />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:pt-0 pt-auto">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div
            className="relative bg-card border border-border w-full max-w-sm mx-4 mb-4 sm:mb-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-1">
                {MODES.map((m) => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors ${
                        mode === m.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={11} strokeWidth={1.5} />
                      <span className="spatia-label">{m.label}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={close} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3">
              {mode === "note" && (
                <>
                  <textarea
                    autoFocus
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Ta note ici…"
                    rows={4}
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none resize-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
                    }}
                  />
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value as typeof NOTE_CATEGORIES[number])}
                    className="w-full bg-background border border-border px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-foreground/40 transition-colors"
                  >
                    {NOTE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}

              {mode === "contact" && (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nom complet *"
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                  />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Courriel"
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                  />
                  <input
                    type="text"
                    value={contactAgency}
                    onChange={(e) => setContactAgency(e.target.value)}
                    placeholder="Agence"
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                  />
                </>
              )}

              {mode === "expense" && (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="Description *"
                    className="w-full bg-background border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="Montant $ *"
                      min="0"
                      step="0.01"
                      className="flex-1 bg-background border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40 transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter") submit() }}
                    />
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="flex-1 bg-background border border-border px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-foreground/40 transition-colors"
                    >
                      {["matterport", "equipment", "travel", "marketing", "software", "other"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="spatia-label text-[10px] text-muted-foreground/40">
                {mode === "note" ? "⌘↵ sauvegarder" : "↵ sauvegarder"}
              </span>
              <button
                onClick={submit}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-1.5 bg-foreground text-background text-xs spatia-label hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
