"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Play, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react"

interface JobStatus {
  name: string
  schedule: string
  description: string
  enabled: boolean
  lastRun: {
    status: "success" | "error"
    summary: string
    ranAt: string
    durationMs: number
  } | null
}

interface CronLog {
  job_name: string
  status: "success" | "error"
  result_summary: string
  ran_at: string
  duration_ms: number
}

export default function CronSettingsPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([])
  const [logs, setLogs] = useState<CronLog[]>([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function fetchStatus() {
    const res = await fetch("/api/cron/status")
    if (!res.ok) return
    const data = await res.json()
    setJobs(data.jobs ?? [])
    setLogs(data.recentLogs ?? [])
  }

  useEffect(() => { fetchStatus() }, [])

  async function triggerJob(jobName: string) {
    setRunning(jobName)
    try {
      const res = await fetch(`/api/cron/trigger/${jobName}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "failed")
      toast.success(`${jobName} — ${data.summary}`)
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "trigger failed")
    } finally {
      setRunning(null)
    }
  }

  function toggleJob(jobName: string, enabled: boolean) {
    startTransition(async () => {
      const res = await fetch("/api/cron/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobName, enabled }),
      })
      if (!res.ok) { toast.error("toggle failed"); return }
      setJobs((prev) =>
        prev.map((j) => (j.name === jobName ? { ...j, enabled } : j))
      )
      toast.success(`${jobName} ${enabled ? "enabled" : "disabled"}`)
    })
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs > 0) return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return "just now"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl tracking-tight">automation engine</h1>
        <p className="text-muted-foreground text-sm mt-1">
          background jobs — run nightly, check status, trigger manually
        </p>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">job</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">schedule</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">last run</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">result</th>
              <th className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground text-right">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  loading...
                </td>
              </tr>
            )}
            {jobs.map((job) => (
              <tr key={job.name} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs">{job.name}</div>
                  <div className="text-muted-foreground text-xs mt-0.5 hidden sm:block">{job.description}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                  {job.schedule}
                </td>
                <td className="px-4 py-3 text-xs">
                  {job.lastRun ? (
                    <div className="flex items-center gap-1.5">
                      {job.lastRun.status === "success" ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="text-muted-foreground">
                        {formatRelative(job.lastRun.ranAt)}
                      </span>
                      <span className="text-muted-foreground/50">
                        · {formatDuration(job.lastRun.durationMs)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">never</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate hidden lg:table-cell">
                  {job.lastRun?.summary ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Enable/disable toggle */}
                    <button
                      onClick={() => toggleJob(job.name, !job.enabled)}
                      disabled={isPending}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        job.enabled ? "bg-foreground" : "bg-muted"
                      }`}
                      title={job.enabled ? "disable job" : "enable job"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                          job.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Run now */}
                    <button
                      onClick={() => triggerJob(job.name)}
                      disabled={running === job.name}
                      className="flex items-center gap-1 px-2 py-1 border border-border rounded-sm text-xs hover:bg-muted/30 transition-colors disabled:opacity-50"
                      title="run now"
                    >
                      {running === job.name ? (
                        <Clock className="w-3 h-3 animate-pulse" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      run
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent logs */}
      <div className="border border-border rounded-sm overflow-hidden">
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/10 transition-colors"
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            recent runs ({logs.length})
          </span>
          {logsOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {logsOpen && (
          <div className="divide-y divide-border border-t border-border">
            {logs.length === 0 && (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">no logs yet</div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                {log.status === "success" ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-foreground">{log.job_name}</span>
                  <span className="text-muted-foreground ml-2">{log.result_summary}</span>
                </div>
                <div className="text-muted-foreground/60 shrink-0">
                  {new Date(log.ran_at).toLocaleString("fr-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
