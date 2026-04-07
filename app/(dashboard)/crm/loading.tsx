import { KanbanSkeleton } from "@/components/ui/skeleton"

export default function CrmLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse bg-muted/50 rounded-sm" />
      <KanbanSkeleton cols={5} />
    </div>
  )
}
