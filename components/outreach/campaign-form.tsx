"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { PIPELINE_STAGES } from "@/types/database"

interface CampaignFormProps {
  open: boolean
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (campaign: any) => void
}

export function CampaignForm({ open, onClose, onCreated }: CampaignFormProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState("cold_outreach")
  const [template, setTemplate] = useState("")
  const [filterAgency, setFilterAgency] = useState("")
  const [filterArea, setFilterArea] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    const res = await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        template: template.trim() || null,
        target_criteria: {
          agency: filterAgency.trim() || null,
          area: filterArea.trim() || null,
          status: filterStatus || null,
        },
      }),
    })

    const data = await res.json()
    if (res.ok) {
      toast.success("Campaign created")
      onCreated(data)
      setName("")
      setTemplate("")
      setFilterAgency("")
      setFilterArea("")
      setFilterStatus("")
      onClose()
    } else {
      toast.error(data.error ?? "Failed to create campaign")
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">new campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="spatia-label">campaign name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Courtiers Brossard — Avril"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="spatia-label">type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "cold_outreach")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="reactivation">Reactivation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="spatia-label">context hint for AI drafting (optional)</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="ex: Mentionner le printemps comme bon moment pour les visites virtuelles..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="border border-border p-3 space-y-3">
            <p className="spatia-label">target contact filters</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="spatia-label text-xs">agency (contains)</Label>
                <Input
                  value={filterAgency}
                  onChange={(e) => setFilterAgency(e.target.value)}
                  placeholder="ex: Re/Max"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="spatia-label text-xs">area (contains)</Label>
                <Input
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  placeholder="ex: Brossard"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="spatia-label text-xs">pipeline stage</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="all stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">all stages</SelectItem>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "creating..." : "create campaign"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
