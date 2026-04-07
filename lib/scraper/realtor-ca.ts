/**
 * Realtor.ca agent scraper
 * Uses the public PropertySearch_Post JSON API — no HTML parsing needed.
 * Rate limit: 1 request per 2s minimum. Rotate user-agents.
 */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface ScrapedAgent {
  name: string
  brokerage: string | null
  phone: string | null
  email: string | null
  areas_served: string[]
  active_listings: number
  profile_url: string | null
  realtor_id: string | null
}

interface RealtorApiListing {
  Individual?: Array<{
    Name?: string
    IndividualID?: number
    AgentPhotoURL?: string
    Phones?: Array<{ PhoneType?: string; PhoneNumber?: string; PhoneTypeId?: string }>
    Emails?: Array<{ ContactId?: string; Value?: string }>
    Organization?: {
      Name?: string
      OrganizationID?: number
      Phones?: Array<{ PhoneNumber?: string }>
      RelativeURLEn?: string
      RelativeURLFr?: string
    }
    Position?: string
    RelativeURLEn?: string
    RelativeURLFr?: string
    PermitStateID?: number
  }>
  Property?: {
    Address?: {
      AddressText?: string
      Longitude?: string
      Latitude?: string
    }
  }
  Id?: string
  MlsNumber?: string
}

interface RealtorApiResponse {
  Results?: RealtorApiListing[]
  Paging?: {
    CurrentPage?: number
    TotalPages?: number
    RecordsPerPage?: number
    TotalRecords?: number
  }
  ErrorCode?: { Status?: number; Description?: string }
}

// De-duplicate agents by their IndividualID
function dedupeAgents(agents: ScrapedAgent[]): ScrapedAgent[] {
  const seen = new Map<string, ScrapedAgent>()
  for (const agent of agents) {
    const key = agent.realtor_id ?? agent.name.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.set(key, agent)
    } else {
      // Merge areas_served
      const existing = seen.get(key)!
      const merged = Array.from(new Set([...existing.areas_served, ...agent.areas_served]))
      seen.set(key, { ...existing, areas_served: merged, active_listings: existing.active_listings + 1 })
    }
  }
  return Array.from(seen.values())
}

function parseAgentFromListing(listing: RealtorApiListing): ScrapedAgent[] {
  const individuals = listing.Individual ?? []
  const address = listing.Property?.Address?.AddressText ?? ""

  return individuals.map((ind) => {
    // Phone: prefer "Direct" or first available
    const phones = ind.Phones ?? []
    const directPhone = phones.find((p) => p.PhoneTypeId === "1" || p.PhoneType?.toLowerCase().includes("direct"))
    const phone = directPhone?.PhoneNumber ?? phones[0]?.PhoneNumber ?? null

    // Email: sometimes present in the API response
    const emails = ind.Emails ?? []
    const email = emails[0]?.Value ?? null

    const brokerage = ind.Organization?.Name ?? null

    const profilePath = ind.RelativeURLEn ?? ind.RelativeURLFr ?? null
    const profile_url = profilePath ? `https://www.realtor.ca${profilePath}` : null

    const area = address.split(",").slice(-2).join(",").trim()

    return {
      name: ind.Name ?? "Unknown",
      brokerage,
      phone: phone ? phone.replace(/\D/g, "").replace(/^1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : null,
      email,
      areas_served: area ? [area] : [],
      active_listings: 1,
      profile_url,
      realtor_id: ind.IndividualID ? String(ind.IndividualID) : null,
    }
  })
}

export interface ScrapeOptions {
  query: string
  maxResults?: number
  onProgress?: (fetched: number, total: number) => void
}

export interface ScrapeResult {
  agents: ScrapedAgent[]
  total_listings_scanned: number
  pages_fetched: number
  query: string
}

/**
 * Main scraper entry point.
 * Searches Realtor.ca listings by area/brokerage and extracts agent data.
 */
export async function scrapeRealtorCa(options: ScrapeOptions): Promise<ScrapeResult> {
  const { query, maxResults = 200, onProgress } = options

  const RECORDS_PER_PAGE = 12
  const MAX_PAGES = Math.ceil(maxResults / RECORDS_PER_PAGE)

  let allAgents: ScrapedAgent[] = []
  let totalListings = 0
  let pagesFetched = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Rate limit: 2s between requests
    if (page > 1) await sleep(2100 + Math.random() * 500)

    const result = await fetchListingsPage(query, page, RECORDS_PER_PAGE)

    if (!result || result.ErrorCode?.Status) break

    const listings = result.Results ?? []
    if (listings.length === 0) break

    const totalPages = result.Paging?.TotalPages ?? 1
    const totalRecords = result.Paging?.TotalRecords ?? 0
    totalListings = totalRecords
    pagesFetched = page

    for (const listing of listings) {
      const agents = parseAgentFromListing(listing)
      allAgents.push(...agents)
    }

    onProgress?.(page * RECORDS_PER_PAGE, Math.min(totalRecords, maxResults))

    if (page >= totalPages) break
  }

  return {
    agents: dedupeAgents(allAgents),
    total_listings_scanned: totalListings,
    pages_fetched: pagesFetched,
    query,
  }
}

async function fetchListingsPage(
  query: string,
  page: number,
  recordsPerPage: number
): Promise<RealtorApiResponse | null> {
  try {
    const body = new URLSearchParams({
      ZoomLevel: "10",
      LatitudeMax: "45.8",
      LatitudeMin: "45.2",
      LongitudeMax: "-73.2",
      LongitudeMin: "-73.8",
      Sort: "6-D", // most recent
      PropertyTypeGroupID: "1",
      TransactionTypeId: "2", // for sale
      RecordsPerPage: String(recordsPerPage),
      MaximumResults: String(recordsPerPage),
      CurrentPage: String(page),
      CultureId: "2", // French
      ApplicationId: "1",
      PropertySearchTypeId: "1",
      // Search keyword maps to city/brokerage
      keywords: query,
    })

    const res = await fetch("https://api2.realtor.ca/Listing.svc/PropertySearch_Post", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": randomUA(),
        Referer: "https://www.realtor.ca/",
        Origin: "https://www.realtor.ca",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.8",
      },
      body: body.toString(),
    })

    if (!res.ok) return null
    return (await res.json()) as RealtorApiResponse
  } catch {
    return null
  }
}

/**
 * Estimate how many results a query will return (first page only, fast).
 */
export async function estimateResults(query: string): Promise<number> {
  const result = await fetchListingsPage(query, 1, 1)
  return result?.Paging?.TotalRecords ?? 0
}
