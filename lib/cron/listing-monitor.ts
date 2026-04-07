import { runCronJob, getSupabaseAdmin } from "./run-job"

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkListing(url: string): Promise<"sold" | "active" | "unknown"> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": randomUA() },
      signal: AbortSignal.timeout(10000),
    })
    // Centris redirects sold listings
    if (res.status >= 300 && res.status < 400) return "sold"
    if (res.status === 200) {
      const text = await res.text()
      if (text.toLowerCase().includes("vendu") || text.toLowerCase().includes("sold")) {
        return "sold"
      }
      return "active"
    }
    return "unknown"
  } catch {
    return "unknown"
  }
}

export async function runListingMonitor() {
  return runCronJob("listing-monitor", async () => {
    const supabase = getSupabaseAdmin()

    // Get tours with listing_url that are not archived
    const { data: tours, error } = await supabase
      .from("tours")
      .select("id, listing_url, status")
      .neq("status", "archived")
      .not("listing_url", "is", null)

    if (error) throw new Error(error.message)
    if (!tours || tours.length === 0) return "no tours to check"

    let checked = 0
    let markedSold = 0

    for (const tour of tours) {
      if (!tour.listing_url) continue

      const result = await checkListing(tour.listing_url)
      checked++

      if (result === "sold") {
        // Update tour status to archive_recommended
        await supabase
          .from("tours")
          .update({ status: "archive_recommended" })
          .eq("id", tour.id)

        // Find associated listing and mark sold
        await supabase
          .from("listings")
          .update({
            status: "sold",
            sold_detected_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
          })
          .eq("tour_id", tour.id)

        // Create alert
        await supabase.from("alerts").insert({
          type: "sold_listing",
          message: `Listing sold detected — tour ${tour.id} flagged for archive.`,
          severity: "info",
        })

        markedSold++
      } else {
        // Update last_checked_at
        await supabase
          .from("listings")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("tour_id", tour.id)
      }

      // Rate limit: 1 req / 2s minimum + jitter
      await sleep(2000 + Math.random() * 1000)
    }

    return `checked ${checked} listings, ${markedSold} marked sold`
  })
}
