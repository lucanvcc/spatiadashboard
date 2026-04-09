import { MoneyTabs } from "@/components/money/money-tabs"

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <MoneyTabs />
      {children}
    </div>
  )
}
