import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Estimated shoot duration by tier (drive + setup + scan + breakdown):
// Tier 1 (≤1500sqft): ~2.5h total
// Tier 2 (1500-2500sqft): ~3h total
// Tier 3 (2500-3500sqft): ~3.5h total
// Tier 4 (3500+sqft): ~4h total

const TIER_HOURS: Record<number, number> = {
  1: 2.5,
  2: 3,
  3: 3.5,
  4: 4,
}

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 ≤1500sqft",
  2: "Tier 2 1500–2500",
  3: "Tier 3 2500–3500",
  4: "Tier 4 3500+",
}

export async function GET() {
  const supabase = await createClient()

  const { data: shoots } = await supabase
    .from("shoots")
    .select("tier, total_price, base_price, status")
    .in("status", ["delivered", "paid"])
    .not("tier", "is", null)

  if (!shoots || shoots.length === 0) {
    return NextResponse.json({ tiers: [], totalShoots: 0 })
  }

  // Group by tier
  const byTier: Record<number, { count: number; totalRevenue: number; totalHours: number }> = {}

  for (const shoot of shoots) {
    const tier = shoot.tier ?? 1
    const price = shoot.total_price ?? shoot.base_price ?? 0
    const hours = TIER_HOURS[tier] ?? 3

    if (!byTier[tier]) byTier[tier] = { count: 0, totalRevenue: 0, totalHours: 0 }
    byTier[tier].count++
    byTier[tier].totalRevenue += price
    byTier[tier].totalHours += hours
  }

  const tiers = Object.entries(byTier)
    .map(([tier, data]) => ({
      tier: parseInt(tier),
      label: TIER_LABELS[parseInt(tier)] ?? `Tier ${tier}`,
      count: data.count,
      avgRevenue: data.count > 0 ? data.totalRevenue / data.count : 0,
      estimatedHours: TIER_HOURS[parseInt(tier)] ?? 3,
      revenuePerHour: data.totalHours > 0 ? data.totalRevenue / data.totalHours : 0,
    }))
    .sort((a, b) => b.revenuePerHour - a.revenuePerHour)

  const overallRevenue = shoots.reduce((s, sh) => s + (sh.total_price ?? sh.base_price ?? 0), 0)
  const overallHours = shoots.reduce((s, sh) => s + (TIER_HOURS[sh.tier ?? 1] ?? 3), 0)
  const overallRph = overallHours > 0 ? overallRevenue / overallHours : 0

  return NextResponse.json({
    tiers,
    totalShoots: shoots.length,
    overallRevenuePerHour: overallRph,
  })
}
