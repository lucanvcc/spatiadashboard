import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scrapeRealtorCa, estimateResults } from "@/lib/scraper/realtor-ca"

// GET /api/scraper/realtor-ca?query=Brossard&estimate=true
// — fast estimate of result count, no scraping
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const query = req.nextUrl.searchParams.get("query")
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 })

  const total = await estimateResults(query)
  return NextResponse.json({ query, estimated_results: total })
}

// POST /api/scraper/realtor-ca
// Body: { query: string, maxResults?: number }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { query, maxResults = 100 } = body as { query: string; maxResults?: number }

  if (!query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  if (maxResults > 500) {
    return NextResponse.json({ error: "maxResults capped at 500" }, { status: 400 })
  }

  const started_at = new Date().toISOString()

  try {
    const result = await scrapeRealtorCa({ query: query.trim(), maxResults })

    // Log the scrape run
    await supabase.from("scrape_logs").insert({
      query: query.trim(),
      results_count: result.agents.length,
      imported_count: 0,
      ran_at: started_at,
      meta: {
        total_listings_scanned: result.total_listings_scanned,
        pages_fetched: result.pages_fetched,
      },
    })

    return NextResponse.json({
      query: result.query,
      agents: result.agents,
      count: result.agents.length,
      total_listings_scanned: result.total_listings_scanned,
      pages_fetched: result.pages_fetched,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scrape failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
