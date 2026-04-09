"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Send, CheckCircle, XCircle, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function EmailSettingsPage() {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/settings/email/test", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, message: `Test email sent to ${data.sent_to}` })
        toast.success("Test email sent — check your Zoho inbox")
      } else {
        setTestResult({ ok: false, message: data.error ?? "Test failed" })
        toast.error(data.error ?? "Test failed")
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" })
      toast.error("Network error")
    }
    setTesting(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="font-heading text-xl tracking-tight">email / smtp</h1>
          <p className="text-muted-foreground text-xs mt-0.5">zoho mail config — credentials in .env.local</p>
        </div>
      </div>

      {/* Config display */}
      <div className="border border-border p-5 space-y-4">
        <p className="spatia-label text-xs text-muted-foreground">smtp configuration</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/50">
            {[
              ["Host", "smtp.zoho.com"],
              ["Port", "465 (SSL)"],
              ["From name", "Luca — Spatia"],
              ["ZOHO_SMTP_USER", ".env.local → your Zoho email"],
              ["ZOHO_SMTP_PASSWORD", ".env.local → Zoho app-specific password"],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="py-2 pr-4 spatia-label text-xs text-muted-foreground whitespace-nowrap">{label}</td>
                <td className="py-2 text-xs font-mono text-foreground/80">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CASL reminder */}
      <div className="border border-border bg-amber-500/5 p-4 space-y-1.5">
        <p className="spatia-label text-xs text-amber-400">casl compliance</p>
        <p className="text-xs text-muted-foreground">
          Every outreach email automatically appends an unsubscribe line. Implied consent only
          (publicly listed business contacts). One follow-up max. Consent basis is logged per contact.
        </p>
      </div>

      {/* Unsubscribe line preview */}
      <div className="border border-border p-4 space-y-2">
        <p className="spatia-label text-xs text-muted-foreground">auto-appended unsubscribe line</p>
        <p className="text-xs font-mono text-muted-foreground/70 whitespace-pre-wrap">
          {`---\nPour ne plus recevoir de courriels de Spatia, répondez avec « Se désabonner » / To unsubscribe, reply with "Unsubscribe".`}
        </p>
      </div>

      {/* Test send */}
      <div className="border border-border p-5 space-y-4">
        <p className="spatia-label text-xs text-muted-foreground">test smtp connection</p>
        <p className="text-xs text-muted-foreground">
          Sends a test email to your ZOHO_SMTP_USER address to confirm the connection is working.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Send size={12} strokeWidth={1.5} />
            {testing ? "sending..." : "send test email"}
          </button>
          {testResult && (
            <div className={`flex items-center gap-1.5 text-xs ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>
              {testResult.ok ? <CheckCircle size={12} strokeWidth={1.5} /> : <XCircle size={12} strokeWidth={1.5} />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Zoho link */}
      <a
        href="https://accounts.zoho.com/home#security/app-passwords"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ExternalLink size={11} strokeWidth={1.5} />
        generate zoho app-specific password →
      </a>
    </div>
  )
}
