import { createClient } from "@/lib/supabase/server"
import { ScraperClient } from "./scraper-client"

export default async function ScraperPage() {
  const supabase = await createClient()

  const { data: recentScrapes } = await supabase
    .from("scrape_logs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(10)

  // Fetch all contact emails for dedup highlighting
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("email, phone, name")

  const existingEmails = new Set((existingContacts ?? []).map((c) => c.email?.toLowerCase()))
  const existingPhones = new Set(
    (existingContacts ?? [])
      .map((c) => c.phone?.replace(/\D/g, "") ?? "")
      .filter(Boolean)
  )

  return (
    <ScraperClient
      recentScrapes={recentScrapes ?? []}
      existingEmails={existingEmails}
      existingPhones={existingPhones}
    />
  )
}
