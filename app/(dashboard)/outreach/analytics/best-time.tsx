import { createClient } from "@/lib/supabase/server"

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
const HOUR_LABELS = ["6h", "7h", "8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h"]
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

interface DayHourBucket {
  sent: number
  replied: number
}

async function getBestTimeData() {
  const supabase = await createClient()

  const { data: emails } = await supabase
    .from("outreach_emails")
    .select("sent_at, replied_at, status")
    .not("sent_at", "is", null)
    .not("status", "eq", "draft")
    .order("sent_at", { ascending: false })
    .limit(500)

  if (!emails || emails.length === 0) return null

  // Build day×hour matrix (0=Sunday, 1=Monday, ... 6=Saturday)
  const matrix: Record<number, Record<number, DayHourBucket>> = {}
  for (let d = 0; d < 7; d++) {
    matrix[d] = {}
    for (const h of HOURS) {
      matrix[d][h] = { sent: 0, replied: 0 }
    }
  }

  for (const email of emails) {
    if (!email.sent_at) continue
    const date = new Date(email.sent_at)
    const day = date.getDay()
    const hour = date.getHours()
    if (hour < 6 || hour > 20) continue
    if (!matrix[day]?.[hour]) continue
    matrix[day][hour].sent++
    if (email.status === "replied" || email.replied_at) {
      matrix[day][hour].replied++
    }
  }

  // Best day
  const dayStats = Array.from({ length: 7 }, (_, d) => {
    const sent = HOURS.reduce((s, h) => s + matrix[d][h].sent, 0)
    const replied = HOURS.reduce((s, h) => s + matrix[d][h].replied, 0)
    return { day: d, sent, replied, rate: sent > 0 ? replied / sent : 0 }
  }).filter((s) => s.sent >= 3)

  const bestDay = dayStats.sort((a, b) => b.rate - a.rate)[0]

  // Best hour
  const hourStats = HOURS.map((h) => {
    const sent = Object.values(matrix).reduce((s, dm) => s + (dm[h]?.sent ?? 0), 0)
    const replied = Object.values(matrix).reduce((s, dm) => s + (dm[h]?.replied ?? 0), 0)
    return { hour: h, sent, replied, rate: sent > 0 ? replied / sent : 0 }
  }).filter((s) => s.sent >= 3)

  const bestHour = hourStats.sort((a, b) => b.rate - a.rate)[0]

  // Max rate for heatmap normalization
  const maxRate = Math.max(
    ...Object.values(matrix).flatMap((dm) =>
      Object.values(dm).map((b) => (b.sent >= 3 ? b.replied / b.sent : 0))
    ),
    0.01
  )

  return { matrix, bestDay, bestHour, maxRate, totalSent: emails.length }
}

export async function BestTimeToSend() {
  const data = await getBestTimeData()

  if (!data) {
    return (
      <div className="border border-border bg-card p-5">
        <p className="spatia-label text-xs text-muted-foreground mb-4">meilleur moment pour envoyer</p>
        <p className="text-sm text-muted-foreground">Envoie au moins quelques courriels pour voir les patterns.</p>
      </div>
    )
  }

  const { matrix, bestDay, bestHour, maxRate } = data

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="spatia-label text-xs text-muted-foreground">meilleur moment pour envoyer</p>
        <div className="flex items-center gap-3">
          {bestDay && (
            <span className="spatia-label text-[10px] text-emerald-400">
              {DAY_LABELS[bestDay.day]} = {(bestDay.rate * 100).toFixed(0)}% taux
            </span>
          )}
          {bestHour && (
            <span className="spatia-label text-[10px] text-emerald-400">
              {bestHour.hour}h = {(bestHour.rate * 100).toFixed(0)}% taux
            </span>
          )}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="spatia-label text-[10px] text-muted-foreground/60 font-normal text-right pr-2 w-8"></th>
              {HOUR_LABELS.map((h) => (
                <th key={h} className="spatia-label text-[9px] text-muted-foreground/60 font-normal text-center w-7">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <tr key={day}>
                <td className="spatia-label text-[10px] text-muted-foreground/60 text-right pr-2">{DAY_LABELS[day]}</td>
                {HOURS.map((hour) => {
                  const bucket = matrix[day]?.[hour] ?? { sent: 0, replied: 0 }
                  const rate = bucket.sent >= 2 ? bucket.replied / bucket.sent : 0
                  const intensity = maxRate > 0 ? rate / maxRate : 0
                  const isHot = intensity > 0.7
                  const isMed = intensity > 0.3

                  return (
                    <td key={hour} className="p-0">
                      <div
                        className={`w-7 h-5 flex items-center justify-center transition-colors ${
                          bucket.sent === 0
                            ? "bg-border/10"
                            : isHot
                            ? "bg-emerald-400/70"
                            : isMed
                            ? "bg-emerald-400/30"
                            : bucket.sent > 0
                            ? "bg-border/30"
                            : "bg-border/10"
                        }`}
                        title={bucket.sent > 0 ? `${bucket.replied}/${bucket.sent} (${(rate * 100).toFixed(0)}%)` : "aucune donnée"}
                      >
                        {bucket.sent > 0 && (
                          <span className={`font-mono text-[8px] ${isHot ? "text-background/80" : "text-muted-foreground/40"}`}>
                            {bucket.sent}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50 spatia-label">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-400/70" />
          <span>haut taux de réponse</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-border/30" />
          <span>bas taux</span>
        </div>
        <span>chiffres = emails envoyés</span>
      </div>
    </div>
  )
}
