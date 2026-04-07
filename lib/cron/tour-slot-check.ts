import { runCronJob, getSupabaseAdmin } from "./run-job"

export async function runTourSlotCheck() {
  return runCronJob("tour-slot-check", async () => {
    const supabase = getSupabaseAdmin()

    // Count active tours
    const { count: activeTours, error: countError } = await supabase
      .from("tours")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    if (countError) throw new Error(countError.message)

    // Get slot limit from settings
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "matterport_slot_limit")
      .single()

    const limit = parseInt(setting?.value ?? "25", 10)
    const active = activeTours ?? 0
    const pct = Math.round((active / limit) * 100)

    if (active > limit * 0.8) {
      // Check for existing unresolved slot warning
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

      return `${active}/${limit} slots used (${pct}%) — alert created`
    }

    return `${active}/${limit} slots used (${pct}%) — within limit`
  })
}
