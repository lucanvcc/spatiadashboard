"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Users,
  Mail,
  BarChart2,
  Settings,
  Calendar,
  Wrench,
  LogOut,
  Camera,
  Box,
  Receipt,
  FileText,
  ScanSearch,
  Menu,
  X,
  DollarSign,
  ShieldCheck,
  CreditCard,
  FileUp,
  Terminal,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const NAV_ITEMS: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  sub?: { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[]
  isCommand?: boolean
}[] = [
  { href: "/command", label: "command", icon: Terminal, isCommand: true },
  { href: "/", label: "home", icon: LayoutDashboard },
  { href: "/crm", label: "crm", icon: Users },
  { href: "/outreach", label: "outreach", icon: Mail },
  { href: "/marketing", label: "marketing", icon: BarChart2 },
  {
    href: "/operations",
    label: "operations",
    icon: Wrench,
    sub: [
      { href: "/operations/shoots", label: "shoots", icon: Camera },
      { href: "/operations/tours", label: "matterport", icon: Box },
      { href: "/operations/invoices", label: "invoices", icon: Receipt },
    ],
  },
  {
    href: "/money",
    label: "money",
    icon: DollarSign,
    sub: [
      { href: "/money", label: "overview", icon: DollarSign },
      { href: "/money/taxes", label: "taxes", icon: ShieldCheck },
      { href: "/money/expenses", label: "expenses", icon: CreditCard },
      { href: "/money/import-wave", label: "import wave", icon: FileUp },
    ],
  },
  { href: "/content", label: "content", icon: Calendar },
  { href: "/reports", label: "reports", icon: FileText },
  { href: "/tools/scraper", label: "scraper", icon: ScanSearch },
  { href: "/settings", label: "settings", icon: Settings },
]

function useActionItemCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch("/api/command/action-items?status=active&severity=critical,warning&limit=50")
      .then((r) => r.json())
      .then((data) => setCount(data.action_items?.length ?? 0))
      .catch(() => {})
  }, [])

  return count
}

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const actionCount = useActionItemCount()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, sub, isCommand }) => {
          const isActive = href === "/" ? pathname === "/" : pathname === href || (pathname.startsWith(href + "/") && href !== "/")
          return (
            <div key={href}>
              <Link
                href={sub ? sub[0].href : href}
                onClick={onLinkClick}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-sm",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                <span className="spatia-label flex-1">{label}</span>
                {/* Badge for command center */}
                {isCommand && actionCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-mono bg-red-400 text-black rounded-full shrink-0">
                    {actionCount > 9 ? "9+" : actionCount}
                  </span>
                )}
              </Link>
              {sub && isActive && (
                <div className="ml-2 mt-0.5 space-y-0.5">
                  {sub.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                    const isSubActive =
                      pathname === subHref ||
                      (pathname.startsWith(subHref + "/") && subHref !== "/")
                    return (
                      <Link
                        key={subHref}
                        href={subHref}
                        onClick={onLinkClick}
                        className={cn(
                          "flex items-center gap-3 pl-5 pr-2 py-1.5 text-sm transition-colors rounded-sm",
                          isSubActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        )}
                      >
                        <SubIcon size={12} strokeWidth={1.5} className="shrink-0" />
                        <span className="spatia-label text-xs">{subLabel}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ⌘K hint + sign out */}
      <div className="border-t border-border p-2 space-y-1">
        <div className="px-2 py-1 hidden lg:flex items-center gap-2 text-muted-foreground/40">
          <span className="spatia-label text-[10px]">⌘K</span>
          <span className="spatia-label text-[10px]">commandes</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors rounded-sm w-full"
        >
          <LogOut size={15} strokeWidth={1.5} className="shrink-0" />
          <span className="spatia-label">sign out</span>
        </button>
      </div>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-14 lg:w-52 border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="border border-border w-7 h-7 flex items-center justify-center shrink-0">
              <span className="font-heading text-sm">S</span>
            </div>
            <span className="font-heading text-sm tracking-tight hidden lg:block">spatia</span>
          </div>
        </div>
        <NavContent />
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="border border-border w-7 h-7 flex items-center justify-center shrink-0">
            <span className="font-heading text-sm">S</span>
          </div>
          <span className="font-heading text-sm tracking-tight">spatia</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="relative flex flex-col w-64 bg-sidebar border-r border-border h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="border border-border w-7 h-7 flex items-center justify-center shrink-0">
                  <span className="font-heading text-sm">S</span>
                </div>
                <span className="font-heading text-sm tracking-tight">spatia</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <NavContent onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
