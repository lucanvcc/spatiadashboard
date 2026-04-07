import type { PricingTier } from "@/types"

export const PRICING: Record<PricingTier, { label: string; sqft: string; price: number }> = {
  1: { label: "Tier 1", sqft: "≤1,500 sq ft", price: 150 },
  2: { label: "Tier 2", sqft: "1,500–2,500 sq ft", price: 200 },
  3: { label: "Tier 3", sqft: "2,500–3,500 sq ft", price: 275 },
  4: { label: "Tier 4", sqft: "3,500+ sq ft", price: 350 },
}

export const RUSH_SURCHARGE = 50
export const TRAVEL_SURCHARGE = 25
export const TRAVEL_THRESHOLD_KM = 30

export const GST_RATE = 0.05
export const QST_RATE = 0.09975

export function getTierFromSqft(sqft: number): PricingTier {
  if (sqft <= 1500) return 1
  if (sqft <= 2500) return 2
  if (sqft <= 3500) return 3
  return 4
}

export function calculateShootPrice(
  sqft: number,
  isRush: boolean,
  isTravelRequired: boolean
): {
  tier: PricingTier
  base_price: number
  rush_surcharge: number
  travel_surcharge: number
  total_price: number
} {
  const tier = getTierFromSqft(sqft)
  const base_price = PRICING[tier].price
  const rush_surcharge = isRush ? RUSH_SURCHARGE : 0
  const travel_surcharge = isTravelRequired ? TRAVEL_SURCHARGE : 0
  const total_price = base_price + rush_surcharge + travel_surcharge

  return { tier, base_price, rush_surcharge, travel_surcharge, total_price }
}

export function calculateTax(subtotal: number): { gst: number; qst: number; total: number } {
  const gst = Math.round(subtotal * GST_RATE * 100) / 100
  const qst = Math.round(subtotal * QST_RATE * 100) / 100
  return { gst, qst, total: subtotal + gst + qst }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount)
}
