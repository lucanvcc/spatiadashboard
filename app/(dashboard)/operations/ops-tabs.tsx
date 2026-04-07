"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/operations/shoots", label: "shoots" },
  { href: "/operations/tours", label: "matterport" },
  { href: "/operations/invoices", label: "invoices" },
]

export function OpsTabs() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`spatia-label px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            pathname.startsWith(t.href)
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
