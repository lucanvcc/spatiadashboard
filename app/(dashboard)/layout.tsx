import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { QuickCapture } from "@/components/layout/quick-capture"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Mobile spacer for fixed topbar */}
        <div className="md:hidden h-14 shrink-0" />
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <KeyboardShortcuts />
      <QuickCapture />
    </div>
  )
}
