"use client"

import { useState } from "react"
import { toast } from "sonner"

export function CalendarLink({ feedUrl }: { feedUrl: string }) {
  const [open, setOpen] = useState(false)

  // webcal:// makes Apple Calendar / iOS Calendar open the subscription dialog directly
  const webcalUrl = feedUrl.replace(/^https?/, "webcal")

  function copyUrl() {
    navigator.clipboard.writeText(feedUrl)
    toast.success("Feed URL copied")
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="spatia-label text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors flex items-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        sync to apple calendar
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 border border-border bg-card p-4 space-y-4 shadow-lg">
          <div className="space-y-1">
            <p className="spatia-label text-xs">subscribe on ios / macos</p>
            <p className="text-xs text-muted-foreground">
              tap the button below on your iPhone or Mac to open the calendar subscription dialog directly.
            </p>
          </div>

          <a
            href={webcalUrl}
            className="block spatia-label text-xs px-4 py-2.5 bg-foreground text-background hover:opacity-80 transition-opacity text-center"
          >
            open in apple calendar
          </a>

          <div className="space-y-2">
            <p className="spatia-label text-xs text-muted-foreground">or subscribe manually</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              1. Calendar app → File → New Calendar Subscription<br />
              2. paste this URL:<br />
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-border/30 px-2 py-1.5 truncate font-mono">
                {feedUrl}
              </code>
              <button
                onClick={copyUrl}
                className="spatia-label text-xs px-2 py-1.5 border border-border hover:bg-accent transition-colors shrink-0"
              >
                copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              3. in the next dialog, set <strong className="text-foreground">Auto-refresh: Every 5 Minutes</strong> — this is the most frequent Apple allows.
            </p>
          </div>

          <div className="border-t border-border pt-3 space-y-1">
            <p className="spatia-label text-xs text-muted-foreground">already subscribed?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              on mac: Calendar → Settings → Accounts → select the feed → set Auto-refresh to Every 5 Minutes.<br />
              on iphone: Settings → Calendar → Accounts → Subscribed Calendars → select Spatia Shoots → refresh every 5 minutes isn't available on iOS — iOS polls subscribed calendars every ~15 min automatically.
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="spatia-label text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            close
          </button>
        </div>
      )}
    </div>
  )
}
