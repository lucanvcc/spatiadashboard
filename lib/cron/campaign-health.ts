import { runCronJob, getSupabaseAdmin } from "./run-job"
import { upsertActionItem } from "@/lib/action-items"

export async function runCampaignHealth() {
  return runCronJob("campaign-health", async () => {
    const supabase = getSupabaseAdmin()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

    // Get Kill/Scale thresholds from settings
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "kill_scale_kill_cpr_threshold",
        "kill_scale_kill_min_spend",
        "kill_scale_scale_roas_threshold",
        "kill_scale_scale_min_bookings",
      ])

    const settings: Record<string, number> = {}
    for (const row of settingsRows ?? []) {
      settings[row.key] = parseFloat(row.value ?? "0")
    }

    const killCprThreshold = settings["kill_scale_kill_cpr_threshold"] ?? 25
    const killMinSpend = settings["kill_scale_kill_min_spend"] ?? 50
    const scaleRoasThreshold = settings["kill_scale_scale_roas_threshold"] ?? 3
    const scaleMinBookings = settings["kill_scale_scale_min_bookings"] ?? 1

    // Get ad spend by campaign in last 7 days
    const { data: spendRows } = await supabase
      .from("marketing_spend")
      .select("campaign_name, amount_spent, clicks, impressions")
      .gte("date", sevenDaysAgoStr)
      .not("campaign_name", "is", null)

    if (!spendRows || spendRows.length === 0) {
      return { summary: "no ad spend data in last 7 days", actionItemsCreated: 0 }
    }

    // Aggregate by campaign
    const campaignMap: Record<string, {
      spend: number; clicks: number; impressions: number
    }> = {}

    for (const row of spendRows) {
      const name = row.campaign_name!
      if (!campaignMap[name]) campaignMap[name] = { spend: 0, clicks: 0, impressions: 0 }
      campaignMap[name].spend += row.amount_spent ?? 0
      campaignMap[name].clicks += row.clicks ?? 0
      campaignMap[name].impressions += row.impressions ?? 0
    }

    // Get booked shoots attributed to each campaign (last 7 days)
    const { data: attributions } = await supabase
      .from("revenue_events")
      .select("source_channel, amount")
      .gte("date", sevenDaysAgoStr)
      .not("source_channel", "is", null)

    const attributionMap: Record<string, { bookings: number; revenue: number }> = {}
    for (const row of attributions ?? []) {
      const ch = row.source_channel!
      if (!attributionMap[ch]) attributionMap[ch] = { bookings: 0, revenue: 0 }
      attributionMap[ch].bookings++
      attributionMap[ch].revenue += row.amount ?? 0
    }

    // Also check ad_campaigns table for campaign IDs
    const { data: adCampaigns } = await supabase
      .from("ad_campaigns")
      .select("id, name")
      .eq("status", "active")

    const campaignIdMap: Record<string, string> = {}
    for (const c of adCampaigns ?? []) {
      if (c.name) campaignIdMap[c.name] = c.id
    }

    let actionItemsCreated = 0

    for (const [campaignName, stats] of Object.entries(campaignMap)) {
      const results = stats.clicks // use clicks as proxy for results
      const cpr = results > 0 ? stats.spend / results : null
      const attribution = attributionMap[campaignName] ?? { bookings: 0, revenue: 0 }
      const roas = stats.spend > 0 && attribution.revenue > 0
        ? attribution.revenue / stats.spend
        : null

      const campaignId = campaignIdMap[campaignName] ?? null

      // Kill criteria: spent enough, cost per result too high, no bookings
      const isKill =
        stats.spend >= killMinSpend &&
        cpr !== null &&
        cpr > killCprThreshold &&
        attribution.bookings === 0

      // Scale criteria: positive ROAS and bookings
      const isScale =
        roas !== null &&
        roas >= scaleRoasThreshold &&
        attribution.bookings >= scaleMinBookings

      if (isKill) {
        const created = await upsertActionItem({
          type: "campaign_waste",
          severity: "warning",
          title: `Campagne à arrêter: ${campaignName}`,
          description: `$${stats.spend.toFixed(0)} dépensé, ${results} résultats, aucun shoot réservé.`,
          related_entity_type: campaignId ? "campaign" : null,
          related_entity_id: campaignId,
          related_url: "/marketing",
          source: "cron:campaign_health",
          data: {
            campaign_name: campaignName,
            spend_7d: stats.spend,
            results_7d: results,
            cost_per_result: cpr,
            booked_shoots: attribution.bookings,
            roas,
          },
        })
        if (created) actionItemsCreated++
      } else if (isScale) {
        const created = await upsertActionItem({
          type: "campaign_scale",
          severity: "success",
          title: `Campagne à scaler: ${campaignName}`,
          description: `ROAS ${roas!.toFixed(1)}×, coût/résultat${cpr ? ` $${cpr.toFixed(0)}` : " n/a"}. Augmenter le budget.`,
          related_entity_type: campaignId ? "campaign" : null,
          related_entity_id: campaignId,
          related_url: "/marketing",
          source: "cron:campaign_health",
          data: {
            campaign_name: campaignName,
            spend_7d: stats.spend,
            results_7d: results,
            cost_per_result: cpr,
            booked_shoots: attribution.bookings,
            roas,
          },
        })
        if (created) actionItemsCreated++
      }
    }

    const campaignCount = Object.keys(campaignMap).length
    return {
      summary: `evaluated ${campaignCount} campaigns, ${actionItemsCreated} action items created`,
      actionItemsCreated,
    }
  })
}
