import { MarketingDashboard } from "@/components/marketing/marketing-dashboard"

export default function MarketingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl tracking-tight">marketing</h1>
        <p className="text-muted-foreground text-xs mt-0.5">ad spend · revenue attribution · channel optimization</p>
      </div>
      <MarketingDashboard />
    </div>
  )
}
