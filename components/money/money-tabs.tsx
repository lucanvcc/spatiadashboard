"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/money", label: "overview" },
  { href: "/money/invoices", label: "invoices" },
  { href: "/money/taxes", label: "taxes" },
  { href: "/money/expenses", label: "expenses" },
  { href: "/money/import-wave", label: "import wave" },
]

export function MoneyTabs() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const isActive =
          t.href === "/money"
            ? pathname === "/money"
            : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`spatia-label px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
