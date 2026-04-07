import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem, autoResolveActionItems } from "@/lib/action-items"

export async function runTourSlotCheck() {
  return runCronJob("tour-slot-check", async () => {
    const supabase = getSupabaseAdmin()

    const { count: activeTours, error: countError } = await supabase
      .from("tours")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    if (countError) throw new Error(countError.message)

    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "matterport_slot_limit")
      .single()

    const limit = parseInt(setting?.value ?? "25", 10)
    const active = activeTours ?? 0
    const pct = Math.round((active / limit) * 100)

    let actionItemsCreated = 0

    if (active > limit * 0.8) {
      const severity = active >= limit * 0.9 ? "critical" : "warning"

      const created = await upsertActionItem({
        type: "slot_warning",
        severity,
        title: `Matterport: ${active}/${limit} slots actifs`,
        description: "Archiver les visites terminées pour libérer de l'espace.",
        related_entity_type: "tour",
        related_entity_id: null,
        related_url: "/operations/tours",
        source: "cron:tour_slot_check",
        data: { active_count: active, limit, percentage: pct },
      })
      if (created) actionItemsCreated++

      // Legacy alert
      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("type", "slot_warning")
        .eq("dismissed", false)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from("alerts").insert({
          type: "slot_warning",
          message: `Matterport slot usage at ${pct}% — ${active}/${limit} slots active. Archive sold tours to free capacity.`,
          severity: active >= limit ? "critical" : "warning",
        })
      }

      return {
        summary: `${active}/${limit} slots used (${pct}%) — alert created`,
        actionItemsCreated,
      }
    }

    // Below threshold — auto-resolve any existing slot_warning action items
    const resolved = await autoResolveActionItems("slot_warning", "tour", null)

    return {
      summary: `${active}/${limit} slots used (${pct}%) — within limit${resolved > 0 ? `, ${resolved} alert(s) auto-resolved` : ""}`,
      actionItemsCreated: 0,
    }
  })
}
