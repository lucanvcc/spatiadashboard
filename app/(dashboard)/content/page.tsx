import { ContentCalendar } from "@/components/content/content-calendar"

export default function ContentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl tracking-tight">content</h1>
        <p className="text-muted-foreground text-xs mt-0.5">5-pillar instagram calendar · bilingual · ai captions</p>
      </div>
      <ContentCalendar />
    </div>
  )
}
