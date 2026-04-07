import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem } from "@/lib/action-items"

export async function runShootToday() {
  return runCronJob("shoot-today", async () => {
    const supabase = getSupabaseAdmin()

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    // End of tomorrow for expires_at
    const endOfTomorrow = new Date(tomorrow)
    endOfTomorrow.setHours(23, 59, 59, 999)

    // Today's shoots
    const { data: todayShoots } = await supabase
      .from("shoots")
      .select("id, address, sq_ft, tier, price, scheduled_at, contacts(name)")
      .in("status", ["booked", "confirmed"])
      .gte("scheduled_at", `${todayStr}T00:00:00.000Z`)
      .lte("scheduled_at", `${todayStr}T23:59:59.999Z`)

    // Tomorrow's shoots
    const { data: tomorrowShoots } = await supabase
      .from("shoots")
      .select("id, address, sq_ft, tier, price, scheduled_at, contacts(name)")
      .in("status", ["booked", "confirmed"])
      .gte("scheduled_at", `${tomorrowStr}T00:00:00.000Z`)
      .lte("scheduled_at", `${tomorrowStr}T23:59:59.999Z`)

    let actionItemsCreated = 0

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    for (const shoot of todayShoots ?? []) {
      const contactName =
        shoot.contacts && !Array.isArray(shoot.contacts)
          ? (shoot.contacts as { name: string }).name
          : null

      const created = await upsertActionItem({
        type: "shoot_today",
        severity: "info",
        title: `Shoot aujourd'hui: ${shoot.address}`,
        description: [
          contactName,
          shoot.sq_ft ? `${shoot.sq_ft} pi²` : null,
          shoot.tier ? `Tier ${shoot.tier}` : null,
        ]
          .filter(Boolean)
          .join(", "),
        related_entity_type: "shoot",
        related_entity_id: shoot.id,
        related_url: `/operations/shoots`,
        source: "cron:shoot_today",
        expires_at: endOfToday.toISOString(),
        data: {
          contact_name: contactName,
          address: shoot.address,
          sq_ft: shoot.sq_ft,
          tier: shoot.tier,
          price: shoot.price,
          scheduled_time: shoot.scheduled_at,
        },
      })
      if (created) actionItemsCreated++
    }

    for (const shoot of tomorrowShoots ?? []) {
      const contactName =
        shoot.contacts && !Array.isArray(shoot.contacts)
          ? (shoot.contacts as { name: string }).name
          : null

      const created = await upsertActionItem({
        type: "shoot_tomorrow",
        severity: "info",
        title: `Shoot demain: ${shoot.address}`,
        description: [
          contactName,
          shoot.sq_ft ? `${shoot.sq_ft} pi²` : null,
          shoot.tier ? `Tier ${shoot.tier}` : null,
        ]
          .filter(Boolean)
          .join(", "),
        related_entity_type: "shoot",
        related_entity_id: shoot.id,
        related_url: `/operations/shoots`,
        source: "cron:shoot_today",
        expires_at: endOfTomorrow.toISOString(),
        data: {
          contact_name: contactName,
          address: shoot.address,
          sq_ft: shoot.sq_ft,
          tier: shoot.tier,
          price: shoot.price,
          scheduled_time: shoot.scheduled_at,
        },
      })
      if (created) actionItemsCreated++
    }

    const totalShoots = (todayShoots?.length ?? 0) + (tomorrowShoots?.length ?? 0)
    return {
      summary: `${todayShoots?.length ?? 0} today, ${tomorrowShoots?.length ?? 0} tomorrow — ${actionItemsCreated} action items created`,
      actionItemsCreated,
    }
  })
}
