"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const NAV_ITEMS: { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; sub?: { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[] }[] = [
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
  { href: "/content", label: "content", icon: Calendar },
  { href: "/settings", label: "settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-14 lg:w-52 border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="border border-border w-7 h-7 flex items-center justify-center shrink-0">
            <span className="font-heading text-sm">S</span>
          </div>
          <span className="font-heading text-sm tracking-tight hidden lg:block">spatia</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, sub }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <div key={href}>
              <Link
                href={sub ? sub[0].href : href}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-sm",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon size={15} strokeWidth={1.5} className="shrink-0" />
                <span className="hidden lg:block spatia-label">{label}</span>
              </Link>
              {sub && isActive && (
                <div className="ml-2 mt-0.5 space-y-0.5 hidden lg:block">
                  {sub.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                    const isSubActive = pathname.startsWith(subHref)
                    return (
                      <Link
                        key={subHref}
                        href={subHref}
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

      {/* Sign out */}
      <div className="border-t border-border p-2">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors rounded-sm w-full"
        >
          <LogOut size={15} strokeWidth={1.5} className="shrink-0" />
          <span className="hidden lg:block spatia-label">sign out</span>
        </button>
      </div>
    </aside>
  )
}
