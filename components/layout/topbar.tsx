"use client"

import { usePathname } from "next/navigation"

const PAGE_TITLES: Record<string, string> = {
  "/": "home",
  "/crm": "crm",
  "/outreach": "outreach",
  "/marketing": "marketing",
  "/operations": "operations",
  "/content": "content",
  "/settings": "settings",
}

function getTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)) return title
  }
  return "spatia"
}

export function Topbar() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <header className="hidden md:flex h-14 border-b border-border items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <h2 className="spatia-label">{title}</h2>
      <span className="spatia-label">{dateStr}</span>
    </header>
  )
}
