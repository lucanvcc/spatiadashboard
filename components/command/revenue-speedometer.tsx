"use client"

// Pure CSS/SVG speedometer gauge — no chart library needed

interface RevenueSpeedometerProps {
  current: number      // revenue MTD
  goal: number         // monthly goal
  paceTarget: number   // what we'd expect by today if on pace
}

export function RevenueSpeedometerSVG({ current, goal, paceTarget }: RevenueSpeedometerProps) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0
  const pacePct = goal > 0 ? Math.min(paceTarget / goal, 1) : 0

  // Gauge: 180° arc from left to right (bottom half of circle)
  // SVG viewBox 200x110
  const cx = 100
  const cy = 100
  const r = 78
  const strokeW = 12

  // Convert percent to angle: 0% = -180deg (left), 100% = 0deg (right)
  function pctToPoint(p: number) {
    const angle = Math.PI - p * Math.PI // PI = left, 0 = right
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    }
  }

  function arc(startPct: number, endPct: number) {
    const start = pctToPoint(startPct)
    const end = pctToPoint(endPct)
    const largeArc = endPct - startPct > 0.5 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }

  const needleAngle = Math.PI - pct * Math.PI
  const needleX = cx + (r - 10) * Math.cos(needleAngle)
  const needleY = cy - (r - 10) * Math.sin(needleAngle)

  const pacePoint = pctToPoint(pacePct)

  // Color: behind pace = amber, on pace = emerald, over = blue
  const fillColor = pct >= pacePct ? "#34d399" : pct >= pacePct * 0.8 ? "#fbbf24" : "#f87171"

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
      {/* Track */}
      <path
        d={arc(0, 1)}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />

      {/* Fill up to current */}
      {pct > 0 && (
        <path
          d={arc(0, pct)}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity="0.85"
        />
      )}

      {/* Pace marker — small tick */}
      {pacePct > 0 && pacePct < 1 && (
        <circle
          cx={pacePoint.x}
          cy={pacePoint.y}
          r={4}
          fill="hsl(var(--muted-foreground))"
          opacity="0.5"
        />
      )}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleX}
        y2={needleY}
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx={cx} cy={cy} r={3} fill="hsl(var(--foreground))" opacity="0.6" />

      {/* 0% label */}
      <text x="14" y="108" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle" fontFamily="monospace">0</text>
      {/* 50% label */}
      <text x="100" y="22" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle" fontFamily="monospace">50%</text>
      {/* 100% label */}
      <text x="186" y="108" fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle" fontFamily="monospace">obj</text>
    </svg>
  )
}
