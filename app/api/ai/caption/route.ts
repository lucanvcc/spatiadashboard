import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PILLAR_DESCRIPTIONS: Record<string, string> = {
  the_work: "Tour showcases, before/after, walkthroughs — show the quality",
  the_edge: "Speed stats, tech shots, competitive advantages — same-day delivery, Matterport",
  the_process: "Behind-the-scenes, equipment, workflow — Ricoh Theta Z1, on-site",
  the_proof: "Client testimonials, results, social proof — agent satisfaction",
  the_culture: "Personal brand, Brossard life, studio aesthetic — the human behind Spatia",
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pillar, topic, content_type } = body

  if (!pillar || !topic) {
    return NextResponse.json({ error: "pillar and topic required" }, { status: 400 })
  }

  const pillarDesc = PILLAR_DESCRIPTIONS[pillar] ?? pillar

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are writing Instagram captions for Spatia, a 3D virtual tour studio in Brossard, QC. Aesthetic: brutalist/editorial, lowercase, moody, authentic. Never mention being new or building a portfolio.

Content pillar: ${pillar} — ${pillarDesc}
Topic/context: ${topic}
Format: ${content_type ?? "post"}

Write TWO captions separated by "---":
1. French (Québécois, casual, natural) — 2-3 sentences + relevant hashtags in French
2. English — same content adapted — 2-3 sentences + relevant hashtags

Keep it short, punchy, editorial. No emojis unless they serve the aesthetic.`,
      },
    ],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""
  const [caption_fr = "", caption_en = ""] = raw.split("---").map((s) => s.trim())

  return NextResponse.json({ caption_fr, caption_en })
}
