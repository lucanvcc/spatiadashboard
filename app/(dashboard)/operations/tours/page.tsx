import { ToursManager } from "@/components/operations/tours-manager"

export default function ToursPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl tracking-tight">matterport slots</h1>
        <p className="text-muted-foreground text-xs mt-0.5">active tours, slot utilization, archive recommendations</p>
      </div>
      <ToursManager />
    </div>
  )
}
