"use client"

import { useState } from "react"
import { OutreachEmail } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Check, X, Pencil, Send, Building2 } from "lucide-react"

interface EmailCardProps {
  email: OutreachEmail
  onStatusChange: (id: string, status: string, updates?: Partial<OutreachEmail>) => void
}

export function EmailCard({ email, onStatusChange }: EmailCardProps) {
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(email.subject)
  const [body, setBody] = useState(email.body)
  const [loading, setLoading] = useState<"approve" | "reject" | "save" | null>(null)

  const contact = email.contacts as { name: string; email: string; agency?: string } | undefined

  async function handleApprove() {
    setLoading("approve")
    // First save edits if any
    if (editing) {
      const saveRes = await fetch(`/api/outreach/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      })
      if (!saveRes.ok) {
        toast.error("Failed to save edits")
        setLoading(null)
        return
      }
    }

    // Send
    const res = await fetch(`/api/outreach/emails/${email.id}/send`, { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Email sent to ${contact?.email}`)
      onStatusChange(email.id, "sent", { subject, body })
    } else {
      toast.error(data.error ?? "Failed to send")
    }
    setLoading(null)
  }

  async function handleReject() {
    setLoading("reject")
    const res = await fetch(`/api/outreach/emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    })
    if (res.ok) {
      toast.success("Email rejected")
      onStatusChange(email.id, "rejected")
    } else {
      toast.error("Failed to reject")
    }
    setLoading(null)
  }

  async function handleSaveEdit() {
    setLoading("save")
    const res = await fetch(`/api/outreach/emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    })
    if (res.ok) {
      toast.success("Draft saved")
      setEditing(false)
    } else {
      toast.error("Failed to save")
    }
    setLoading(null)
  }

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      {/* Contact info */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{contact?.name ?? "Unknown"}</p>
          {contact?.agency && (
            <div className="flex items-center gap-1">
              <Building2 size={10} strokeWidth={1.5} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{contact.agency}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{contact?.email}</p>
        </div>
        {email.campaigns && (
          <span className="text-xs text-muted-foreground border border-border px-2 py-0.5">
            {(email.campaigns as { name: string }).name}
          </span>
        )}
      </div>

      {/* Subject + body */}
      {editing ? (
        <div className="space-y-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-8 text-sm font-medium"
            placeholder="Subject"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="text-sm resize-none"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{subject}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
          <p className="text-xs text-muted-foreground/50 border-t border-border pt-2">
            + unsubscribe line appended automatically on send (CASL)
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={loading === "save"}
              className="gap-1"
            >
              <Check size={12} /> {loading === "save" ? "saving..." : "save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setSubject(email.subject); setBody(email.body) }}>
              cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={!!loading}
              className="gap-1.5"
            >
              <Send size={12} /> {loading === "approve" ? "sending..." : "approve & send"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={!!loading}
              className="gap-1.5"
            >
              <Pencil size={12} /> edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReject}
              disabled={!!loading}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X size={12} /> {loading === "reject" ? "rejecting..." : "reject"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
