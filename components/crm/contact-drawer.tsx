"use client"

import { useEffect, useState } from "react"
import { Contact, ContactStatus, OutreachEmail, PIPELINE_STAGES } from "@/types/database"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Mail, Phone, Building2, MapPin, Pencil, Check, X, Plus, ChevronDown } from "lucide-react"

interface ContactDetail {
  contact: Contact
  emails: (OutreachEmail & { campaigns?: { id: string; name: string } | null })[]
  notes: { id: string; content: string; created_at: string }[]
}

interface ContactDrawerProps {
  contactId: string | null
  open: boolean
  onClose: () => void
  onContactUpdated: (updated: Contact) => void
}

export function ContactDrawer({ contactId, open, onClose, onContactUpdated }: ContactDrawerProps) {
  const [data, setData] = useState<ContactDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Contact>>({})
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [composing, setComposing] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; subject_template: string; body_template: string; variables_schema: string[] | null }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [composeVars, setComposeVars] = useState<Record<string, string>>({})
  const [composeSubject, setComposeSubject] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [sendingDraft, setSendingDraft] = useState(false)

  useEffect(() => {
    if (!contactId || !open) return
    setLoading(true)
    setEditing(false)
    fetch(`/api/contacts/${contactId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setForm(d.contact)
      })
      .finally(() => setLoading(false))
  }, [contactId, open])

  async function handleSave() {
    if (!contactId) return
    setSaving(true)
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    if (res.ok) {
      setData((d) => d ? { ...d, contact: updated } : d)
      onContactUpdated(updated)
      setEditing(false)
      toast.success("Contact updated")
    } else {
      toast.error(updated.error ?? "Failed to save")
    }
    setSaving(false)
  }

  useEffect(() => {
    if (composing && templates.length === 0) {
      fetch("/api/outreach/templates")
        .then((r) => r.json())
        .then((d) => setTemplates(Array.isArray(d) ? d : []))
    }
  }, [composing, templates.length])

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return
    setSelectedTemplate(templateId)
    // Pre-fill contact-known variables
    const contact = data?.contact
    const defaults: Record<string, string> = {
      agent_name: contact?.name?.split(" ")[0] ?? "",
      agency: contact?.agency ?? "",
    }
    setComposeVars(defaults)
    // Substitute known vars, leave unknowns as placeholders
    function fill(str: string) {
      return str.replace(/\{(\w+)\}/g, (_, key) => defaults[key] ?? `{${key}}`)
    }
    setComposeSubject(fill(t.subject_template))
    setComposeBody(fill(t.body_template))
  }

  function updateVar(key: string, value: string) {
    const newVars = { ...composeVars, [key]: value }
    setComposeVars(newVars)
    const t = templates.find((x) => x.id === selectedTemplate)
    if (!t) return
    function fill(str: string) {
      return str.replace(/\{(\w+)\}/g, (_, k) => newVars[k] ?? `{${k}}`)
    }
    setComposeSubject(fill(t.subject_template))
    setComposeBody(fill(t.body_template))
  }

  async function handleCreateDraft() {
    if (!contactId || !composeSubject.trim() || !composeBody.trim()) return
    setSendingDraft(true)
    const res = await fetch("/api/outreach/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        status: "pending_review",
        is_followup: false,
      }),
    })
    if (res.ok) {
      const draft = await res.json()
      toast.success("Draft created — review in outreach queue")
      setData((d) => d ? { ...d, emails: [{ ...draft, contacts: d.contact, campaigns: null }, ...d.emails] } : d)
      setComposing(false)
      setSelectedTemplate("")
      setComposeSubject("")
      setComposeBody("")
      setComposeVars({})
    } else {
      const d = await res.json()
      toast.error(d.error ?? "Failed to create draft")
    }
    setSendingDraft(false)
  }

  async function handleAddNote() {
    if (!newNote.trim() || !contactId) return
    setSavingNote(true)
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, content: newNote.trim(), category: "crm" }),
    })
    if (res.ok) {
      const note = await res.json()
      setData((d) => d ? { ...d, notes: [note, ...d.notes] } : d)
      setNewNote("")
      toast.success("Note added")
    }
    setSavingNote(false)
  }

  const statusLabel = PIPELINE_STAGES.find((s) => s.key === data?.contact.status)?.label

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[520px] overflow-y-auto p-0">
        {loading || !data ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            loading...
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 py-5 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <SheetTitle className="font-heading text-lg">{data.contact.name}</SheetTitle>
                  {data.contact.agency && (
                    <p className="text-sm text-muted-foreground">{data.contact.agency}</p>
                  )}
                  {statusLabel && (
                    <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                  className="shrink-0"
                >
                  {editing ? <X size={14} /> : <Pencil size={14} />}
                </Button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {/* Contact info */}
              <div className="px-6 py-4 space-y-4 border-b border-border">
                <p className="spatia-label">contact info</p>

                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="spatia-label">name</Label>
                        <Input
                          value={form.name ?? ""}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="spatia-label">agency</Label>
                        <Input
                          value={form.agency ?? ""}
                          onChange={(e) => setForm({ ...form, agency: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="spatia-label">email</Label>
                        <Input
                          value={form.email ?? ""}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="spatia-label">phone</Label>
                        <Input
                          value={form.phone ?? ""}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="spatia-label">areas served</Label>
                        <Input
                          value={form.areas_served?.join(", ") ?? ""}
                          onChange={(e) => setForm({ ...form, areas_served: e.target.value ? e.target.value.split(",").map(s => s.trim()) : [] })}
                          placeholder="Brossard, Longueuil..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="spatia-label">stage</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) => v && setForm({ ...form, status: v as ContactStatus })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STAGES.map((s) => (
                              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="spatia-label">notes</Label>
                      <Textarea
                        value={form.notes ?? ""}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        rows={3}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                        <Check size={12} /> {saving ? "saving..." : "save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(data.contact) }}>
                        cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                        <span>{data.contact.email}</span>
                      </div>
                    )}
                    {data.contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                        <span>{data.contact.phone}</span>
                      </div>
                    )}
                    {data.contact.areas_served && data.contact.areas_served.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                        <span>{data.contact.areas_served.join(", ")}</span>
                      </div>
                    )}
                    {data.contact.agency && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 size={12} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                        <span>{data.contact.agency}</span>
                      </div>
                    )}
                    {data.contact.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{data.contact.notes}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Email history */}
              <div className="px-6 py-4 space-y-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <p className="spatia-label">email history ({data.emails.length})</p>
                  <button
                    onClick={() => setComposing((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {composing ? <X size={11} strokeWidth={1.5} /> : <Plus size={11} strokeWidth={1.5} />}
                    {composing ? "cancel" : "compose"}
                  </button>
                </div>

                {composing && (
                  <div className="border border-border p-3 space-y-3 bg-muted/5">
                    <div className="space-y-1.5">
                      <p className="spatia-label text-xs text-muted-foreground">template</p>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => applyTemplate(e.target.value)}
                        className="w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">— pick a template —</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedTemplate && (() => {
                      const t = templates.find((x) => x.id === selectedTemplate)
                      const vars = t?.variables_schema ?? []
                      const fillable = vars.filter((v) => !["agent_name", "agency"].includes(v))
                      return fillable.length > 0 ? (
                        <div className="space-y-2">
                          <p className="spatia-label text-xs text-muted-foreground">fill variables</p>
                          {fillable.map((v) => (
                            <div key={v} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{"{" + v + "}"}</span>
                              <input
                                value={composeVars[v] ?? ""}
                                onChange={(e) => updateVar(v, e.target.value)}
                                placeholder={v.replace(/_/g, " ")}
                                className="flex-1 border border-border bg-background px-2 py-1 text-xs focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}

                    {selectedTemplate && (
                      <>
                        <div className="space-y-1">
                          <p className="spatia-label text-xs text-muted-foreground">subject preview</p>
                          <input
                            value={composeSubject}
                            onChange={(e) => setComposeSubject(e.target.value)}
                            className="w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="spatia-label text-xs text-muted-foreground">body preview</p>
                          <textarea
                            value={composeBody}
                            onChange={(e) => setComposeBody(e.target.value)}
                            rows={6}
                            className="w-full border border-border bg-background px-2 py-1.5 text-xs font-mono resize-y focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleCreateDraft}
                          disabled={sendingDraft || !composeSubject.trim() || !composeBody.trim()}
                          className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          <Mail size={11} strokeWidth={1.5} />
                          {sendingDraft ? "creating draft..." : "create draft for review"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {data.emails.length === 0 ? (
                  <p className="text-xs text-muted-foreground">no emails yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.emails.map((e) => (
                      <div key={e.id} className="border border-border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{e.subject}</p>
                          <EmailStatusBadge status={e.status} />
                        </div>
                        {e.campaigns && (
                          <p className="text-xs text-muted-foreground">{e.campaigns.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">{e.body}</p>
                        {e.sent_at && (
                          <p className="text-xs text-muted-foreground/60">
                            sent {new Date(e.sent_at).toLocaleDateString("fr-CA")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="px-6 py-4 space-y-3">
                <p className="spatia-label">notes ({data.notes.length})</p>
                <div className="flex gap-2">
                  <Input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                    add
                  </Button>
                </div>
                {data.notes.map((n) => (
                  <div key={n.id} className="text-sm text-muted-foreground border-l border-border pl-3">
                    <p>{n.content}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function EmailStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending_review: "border-amber-500/30 text-amber-400",
    sent: "border-blue-500/30 text-blue-400",
    opened: "border-emerald-500/30 text-emerald-400",
    replied: "border-green-500/30 text-green-400",
    rejected: "border-red-500/30 text-red-400",
    bounced: "border-red-500/30 text-red-400",
  }
  return (
    <span className={`text-xs border px-1.5 py-0.5 rounded-sm ${variants[status] ?? "border-border text-muted-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  )
}
