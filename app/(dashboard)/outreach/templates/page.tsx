"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ArrowLeft, X, Save, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"

interface EmailTemplate {
  id: string
  name: string
  subject_template: string
  body_template: string
  language: "fr" | "en" | "bilingual"
  variables_schema: string[] | null
  created_at: string
  updated_at: string
}

const LANG_LABEL: Record<string, string> = { fr: "FR", en: "EN", bilingual: "FR+EN" }

function extractVars(text: string): string[] {
  const matches = text.match(/\{(\w+)\}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1, -1)))]
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<EmailTemplate>
  onSave: (t: EmailTemplate) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [subject, setSubject] = useState(initial?.subject_template ?? "")
  const [body, setBody] = useState(initial?.body_template ?? "")
  const [lang, setLang] = useState<string>(initial?.language ?? "fr")
  const [saving, setSaving] = useState(false)

  const vars = extractVars(subject + " " + body)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Name, subject, and body are required")
      return
    }
    setSaving(true)
    const payload = {
      name: name.trim(),
      subject_template: subject.trim(),
      body_template: body.trim(),
      language: lang,
      variables_schema: vars.length > 0 ? vars : null,
    }
    const isEdit = !!initial?.id
    const res = await fetch(
      isEdit ? `/api/outreach/templates/${initial!.id}` : "/api/outreach/templates",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
    const data = await res.json()
    if (res.ok) {
      toast.success(isEdit ? "Template updated" : "Template created")
      onSave(data)
    } else {
      toast.error(data.error ?? "Failed to save")
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border p-5 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <p className="spatia-label text-xs text-muted-foreground">
          {initial?.id ? "edit template" : "new template"}
        </p>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <label className="spatia-label text-xs text-muted-foreground">name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cold Outreach FR"
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <label className="spatia-label text-xs text-muted-foreground">language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
          >
            <option value="fr">French</option>
            <option value="en">English</option>
            <option value="bilingual">Bilingual</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="spatia-label text-xs text-muted-foreground">
          subject line{" "}
          <span className="text-muted-foreground/50">— use {"{variable}"} for placeholders</span>
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Votre annonce au {listing_address}"
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      <div className="space-y-1.5">
        <label className="spatia-label text-xs text-muted-foreground">body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={`Bonjour {agent_name},\n\n{compliment}\n\n...`}
          className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 font-mono resize-y"
        />
      </div>

      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="spatia-label text-xs text-muted-foreground">variables detected:</span>
          {vars.map((v) => (
            <span key={v} className="text-xs font-mono bg-muted/20 border border-border px-1.5 py-0.5">
              {"{" + v + "}"}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-accent transition-colors disabled:opacity-50"
        >
          <Save size={12} strokeWidth={1.5} />
          {saving ? "saving..." : "save template"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
        >
          cancel
        </button>
      </div>
    </form>
  )
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: EmailTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{template.name}</p>
              <span className="text-xs border border-border px-1 py-0.5 text-muted-foreground shrink-0">
                {LANG_LABEL[template.language] ?? template.language}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{template.subject_template}</p>
          </div>
          {expanded ? (
            <ChevronUp size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div>
            <p className="spatia-label text-xs text-muted-foreground mb-1">subject</p>
            <p className="text-sm font-mono">{template.subject_template}</p>
          </div>
          <div>
            <p className="spatia-label text-xs text-muted-foreground mb-1">body</p>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/10 p-3 border border-border">
              {template.body_template}
            </pre>
          </div>
          {template.variables_schema && template.variables_schema.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="spatia-label text-xs text-muted-foreground">variables:</span>
              {template.variables_schema.map((v: string) => (
                <span key={v} className="text-xs font-mono bg-muted/20 border border-border px-1.5 py-0.5">
                  {"{" + v + "}"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/outreach/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  function handleCreated(t: EmailTemplate) {
    setTemplates((prev) => [t, ...prev])
    setCreating(false)
  }

  function handleUpdated(t: EmailTemplate) {
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? t : x)))
    setEditId(null)
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    const res = await fetch(`/api/outreach/templates/${id}`, { method: "DELETE" })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Template deleted")
    } else {
      toast.error("Failed to delete")
    }
    setConfirmDeleteId(null)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/outreach" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="font-heading text-xl tracking-tight">email templates</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? "loading..." : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 hover:bg-accent transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
            new template
          </button>
        )}
      </div>

      {creating && (
        <TemplateForm
          onSave={handleCreated}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">loading...</div>
      ) : templates.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          no templates yet — create your first one above
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) =>
            editId === t.id ? (
              <TemplateForm
                key={t.id}
                initial={t}
                onSave={handleUpdated}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div key={t.id} className="relative">
                <TemplateRow
                  template={t}
                  onEdit={() => setEditId(t.id)}
                  onDelete={() => handleDelete(t.id)}
                />
                {confirmDeleteId === t.id && (
                  <div className="absolute right-2 top-2 flex items-center gap-1.5 bg-background border border-red-500/30 px-2 py-1.5 z-10">
                    <span className="text-xs text-red-400">delete this template?</span>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      no
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          <span className="spatia-label">tip:</span> use {"{agent_name}"}, {"{agency}"}, {"{listing_address}"}, {"{compliment}"}, {"{cta}"} as placeholders. They are filled when composing an email from the CRM.
        </p>
      </div>
    </div>
  )
}
