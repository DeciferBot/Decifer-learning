import { ReactNode } from 'react'
import { DiagramType } from '@/lib/learn-widgets'

// ---------------------------------------------------------------------------
// Inline SVG diagram registry
//
// Every illustration used by Learn widgets lives here as a pure, presentational
// SVG component — no interaction, no network images. This keeps lessons fully
// offline-capable (PWA requirement) and crisp at any size.
//
// Consumed by:
//   - components/learn/widgets/DragLabel.tsx     (interactive label game)
//   - components/learn/widgets/StaticDiagram.tsx (static labelled figure)
//
// To add a diagram: write a `function XDiagram()`, add it to `getDiagramSvg`,
// and give it a `DIAGRAM_ASPECT_RATIO` entry. Add the key to the `DiagramType`
// union in lib/learn-widgets.ts — the unit test enforces full coverage.
// ---------------------------------------------------------------------------

// === Maths ================================================================

function CircleDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 1" />
      <line x1="50" y1="50" x2="77" y2="23" stroke="#6C9EFF" strokeWidth="1.5" />
      <line x1="22" y1="30" x2="75" y2="68" stroke="#94a3b8" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="2.5" fill="#2D3748" />
      <circle cx="50" cy="12" r="1.5" fill="#94a3b8" />
    </svg>
  )
}

function TriangleDiagram() {
  // Right triangle: (15,85), (85,85), (15,20)
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <polygon points="15,85 85,85 15,20" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points="15,75 25,75 25,85" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
      <circle cx="15" cy="20" r="2" fill="#6C9EFF" />
      <circle cx="85" cy="85" r="2" fill="#6C9EFF" />
      <circle cx="15" cy="85" r="2" fill="#6C9EFF" />
    </svg>
  )
}

// Shows N equal groups each containing dots — for multiplication/division topics.
function MultiplicationGroupsDiagram() {
  const groups = [
    { cx: 22, cy: 50 },
    { cx: 50, cy: 50 },
    { cx: 78, cy: 50 },
  ]
  const dotsPerGroup = [
    [-8, -8], [8, -8],
    [-8, 8], [8, 8],
  ]
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {groups.map((g, gi) => (
        <g key={gi}>
          <circle cx={g.cx} cy={g.cy} r="18" fill="#EFF6FF" stroke="#6C9EFF" strokeWidth="1.5" />
          {dotsPerGroup.map(([dx, dy], di) => (
            <circle key={di} cx={g.cx + dx} cy={g.cy + dy} r="3" fill="#6C9EFF" />
          ))}
        </g>
      ))}
      <rect x="35" y="80" width="30" height="14" rx="3" fill="#F0FFF4" stroke="#40C057" strokeWidth="1.2" />
      <text x="50" y="90" textAnchor="middle" fontSize="7" fill="#2D3748" fontFamily="sans-serif" fontWeight="bold">
        Total
      </text>
      {groups.map((g, gi) => (
        <line key={gi} x1={g.cx} y1={g.cy + 18} x2={50} y2={80} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 1" />
      ))}
    </svg>
  )
}

// Bar model diagram — equal bars for addition/multiplication/fractions.
function BarModelDiagram() {
  const bars = [{ y: 15 }, { y: 33 }, { y: 51 }]
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="8" y="70" width="84" height="14" rx="3" fill="#FFF9C4" stroke="#FFD43B" strokeWidth="1.5" />
      <text x="50" y="80" textAnchor="middle" fontSize="7" fill="#2D3748" fontFamily="sans-serif" fontWeight="bold">Total</text>
      {bars.map((b, i) => (
        <rect key={i} x="8" y={b.y} width="84" height="12" rx="3" fill="#EFF6FF" stroke="#6C9EFF" strokeWidth="1.2" />
      ))}
      <line x1="92" y1="15" x2="92" y2="69" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="89" y1="15" x2="92" y2="15" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="89" y1="69" x2="92" y2="69" stroke="#94a3b8" strokeWidth="0.8" />
    </svg>
  )
}

// 0–10 number line with labelled ticks — for counting, addition, rounding.
function NumberLineDiagram() {
  const ticks = Array.from({ length: 11 }, (_, i) => i)
  return (
    <svg viewBox="0 0 100 30" className="w-full h-full" aria-hidden="true">
      <line x1="6" y1="16" x2="94" y2="16" stroke="#2D3748" strokeWidth="1.2" />
      {/* arrowheads */}
      <polyline points="6,16 9,13 9,19" fill="none" stroke="#2D3748" strokeWidth="1.2" />
      <polyline points="94,16 91,13 91,19" fill="none" stroke="#2D3748" strokeWidth="1.2" />
      {ticks.map((n) => {
        const x = 8 + (n * (84 / 10))
        return (
          <g key={n}>
            <line x1={x} y1="12" x2={x} y2="20" stroke="#2D3748" strokeWidth="1" />
            <text x={x} y="27" textAnchor="middle" fontSize="5" fill="#2D3748" fontFamily="sans-serif">{n}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Circle split into quarters with three shaded — for fractions.
function FractionCircleDiagram() {
  const cx = 50, cy = 50, r = 38
  // Quarter wedges; shade top-right, bottom-right, bottom-left (3/4)
  const wedge = (a0: number, a1: number, fill: string) => {
    const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`
  }
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <path d={wedge(-90, 0, '#6C9EFF')} fill="#6C9EFF" stroke="#fff" strokeWidth="1" />
      <path d={wedge(0, 90, '#6C9EFF')} fill="#6C9EFF" stroke="#fff" strokeWidth="1" />
      <path d={wedge(90, 180, '#6C9EFF')} fill="#6C9EFF" stroke="#fff" strokeWidth="1" />
      <path d={wedge(180, 270, '#fff')} fill="#EFF6FF" stroke="#fff" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  )
}

// Rectangular array of dots (rows × columns) — for multiplication as area.
function ArrayGridDiagram() {
  const rows = 3, cols = 4
  const dots: ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle key={`${r}-${c}`} cx={22 + c * 18} cy={25 + r * 18} r="5" fill="#6C9EFF" />
      )
    }
  }
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="8" y="10" width="84" height="64" rx="4" fill="#EFF6FF" stroke="#6C9EFF" strokeWidth="1.2" />
      {dots}
    </svg>
  )
}

// Hundreds / Tens / Ones columns — for place value.
function PlaceValueDiagram() {
  const cols = [
    { x: 12, label: 'Hundreds', colour: '#FF8FAB' },
    { x: 40, label: 'Tens', colour: '#FFD43B' },
    { x: 68, label: 'Ones', colour: '#52D9A0' },
  ]
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {cols.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y="12" width="22" height="74" rx="3" fill="#fff" stroke={c.colour} strokeWidth="1.5" />
          <rect x={c.x} y="12" width="22" height="12" rx="3" fill={c.colour} opacity="0.25" />
          <text x={c.x + 11} y="20" textAnchor="middle" fontSize="4.5" fill="#2D3748" fontFamily="sans-serif" fontWeight="bold">{c.label}</text>
        </g>
      ))}
    </svg>
  )
}

// Analogue clock face — for telling the time.
function ClockFaceDiagram() {
  const cx = 50, cy = 50, r = 40
  const marks = Array.from({ length: 12 }, (_, i) => i)
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#2D3748" strokeWidth="2" />
      {marks.map((m) => {
        const a = (m * 30 - 90) * (Math.PI / 180)
        const x1 = cx + (r - 5) * Math.cos(a)
        const y1 = cy + (r - 5) * Math.sin(a)
        const x2 = cx + r * Math.cos(a)
        const y2 = cy + r * Math.sin(a)
        const tx = cx + (r - 11) * Math.cos(a)
        const ty = cy + (r - 11) * Math.sin(a)
        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2D3748" strokeWidth="1.2" />
            <text x={tx} y={ty + 2} textAnchor="middle" fontSize="6" fill="#2D3748" fontFamily="sans-serif">{m === 0 ? 12 : m}</text>
          </g>
        )
      })}
      {/* hour hand → 3, minute hand → 12 */}
      <line x1={cx} y1={cy} x2={cx + 18} y2={cy} stroke="#6C9EFF" strokeWidth="3" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 28} stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="2.5" fill="#2D3748" />
    </svg>
  )
}

// === Science ===============================================================

function PlantDiagram() {
  return (
    <svg viewBox="0 0 100 120" className="w-full h-full" aria-hidden="true">
      <line x1="10" y1="75" x2="90" y2="75" stroke="#92400e" strokeWidth="1.5" />
      <path d="M50,75 Q40,85 30,95" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M50,75 Q50,90 50,100" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M50,75 Q60,85 70,95" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M40,85 Q35,95 28,105" fill="none" stroke="#92400e" strokeWidth="1" />
      <path d="M60,85 Q65,95 72,105" fill="none" stroke="#92400e" strokeWidth="1" />
      <line x1="50" y1="75" x2="50" y2="30" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="33" cy="52" rx="13" ry="7" fill="#4ade80" stroke="#16a34a" strokeWidth="1" transform="rotate(-20 33 52)" />
      <line x1="50" y1="52" x2="33" y2="52" stroke="#16a34a" strokeWidth="1" />
      <ellipse cx="67" cy="48" rx="13" ry="7" fill="#4ade80" stroke="#16a34a" strokeWidth="1" transform="rotate(20 67 48)" />
      <line x1="50" y1="48" x2="67" y2="48" stroke="#16a34a" strokeWidth="1" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" transform="rotate(45 50 22)" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" transform="rotate(90 50 22)" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" transform="rotate(135 50 22)" />
      <circle cx="50" cy="22" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" />
    </svg>
  )
}

function AnimalCellDiagram() {
  return (
    <svg viewBox="0 0 120 100" className="w-full h-full" aria-hidden="true">
      <ellipse cx="60" cy="50" rx="55" ry="44" fill="#eff6ff" stroke="#60a5fa" strokeWidth="2" />
      <ellipse cx="52" cy="48" rx="18" ry="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <ellipse cx="52" cy="48" rx="8" ry="6" fill="#93c5fd" stroke="#2563eb" strokeWidth="1" />
      <ellipse cx="85" cy="35" rx="10" ry="6" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1" transform="rotate(-20 85 35)" />
      <ellipse cx="88" cy="62" rx="9" ry="5" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1" transform="rotate(15 88 62)" />
      {[[30, 30], [72, 44], [40, 68], [65, 74], [20, 58], [95, 48]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="#a78bfa" />
      ))}
    </svg>
  )
}

function WaterCycleDiagram() {
  return (
    <svg viewBox="0 0 160 120" className="w-full h-full" aria-hidden="true">
      <path d="M0,95 Q20,88 40,95 Q60,102 80,95 Q100,88 120,95 Q140,102 160,95 L160,120 L0,120 Z" fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1" />
      <polygon points="110,95 135,55 160,95" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
      <polygon points="125,95 150,65 160,95" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
      <line x1="128" y1="95" x2="128" y2="78" stroke="#16a34a" strokeWidth="1.5" />
      <ellipse cx="128" cy="74" rx="5" ry="7" fill="#4ade80" />
      <circle cx="140" cy="18" r="10" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        return (
          <line key={i} x1={140 + 12 * Math.cos(rad)} y1={18 + 12 * Math.sin(rad)} x2={140 + 16 * Math.cos(rad)} y2={18 + 16 * Math.sin(rad)} stroke="#f59e0b" strokeWidth="1" />
        )
      })}
      <ellipse cx="55" cy="25" rx="22" ry="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="40" cy="28" rx="13" ry="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="70" cy="28" rx="13" ry="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <path d="M25,88 Q15,60 40,32" fill="none" stroke="#0ea5e9" strokeWidth="1.5" markerEnd="url(#wc-arrow-blue)" strokeDasharray="3 2" />
      {[[48, 40], [55, 42], [62, 40], [50, 48], [58, 50]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.5" ry="3" fill="#60a5fa" />
      ))}
      <path d="M30,95 Q55,100 80,95" fill="none" stroke="#0ea5e9" strokeWidth="1.5" markerEnd="url(#wc-arrow-blue)" />
      <path d="M128,70 Q118,55 100,40" fill="none" stroke="#16a34a" strokeWidth="1.5" markerEnd="url(#wc-arrow-green)" strokeDasharray="3 2" />
      <defs>
        <marker id="wc-arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#0ea5e9" />
        </marker>
        <marker id="wc-arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#16a34a" />
        </marker>
      </defs>
    </svg>
  )
}

// Simplified four-chamber heart cross-section.
function HumanHeartDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <path d="M50,88 C18,64 12,36 30,24 C42,16 50,28 50,32 C50,28 58,16 70,24 C88,36 82,64 50,88 Z"
        fill="#fecaca" stroke="#dc2626" strokeWidth="1.5" />
      {/* septum */}
      <line x1="50" y1="30" x2="50" y2="80" stroke="#dc2626" strokeWidth="1.2" />
      {/* chambers */}
      <path d="M50,34 C40,30 28,34 30,48 L48,52 Z" fill="#fca5a5" opacity="0.6" />
      <path d="M50,34 C60,30 72,34 70,48 L52,52 Z" fill="#93c5fd" opacity="0.6" />
      <path d="M48,54 L32,52 C30,66 40,76 48,78 Z" fill="#ef4444" opacity="0.5" />
      <path d="M52,54 L68,52 C70,66 60,76 52,78 Z" fill="#60a5fa" opacity="0.5" />
      {/* vessels */}
      <rect x="40" y="10" width="6" height="16" rx="2" fill="#60a5fa" stroke="#2563eb" strokeWidth="0.8" />
      <rect x="54" y="10" width="6" height="16" rx="2" fill="#ef4444" stroke="#dc2626" strokeWidth="0.8" />
    </svg>
  )
}

// Volcano cross-section: magma chamber, conduit, crater.
function VolcanoDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="0" y="78" width="100" height="22" fill="#bbf7d0" />
      <polygon points="20,80 50,22 80,80" fill="#a16207" stroke="#78350f" strokeWidth="1.2" />
      <polygon points="42,30 58,30 64,80 36,80" fill="#7c2d12" opacity="0.5" />
      {/* conduit */}
      <path d="M50,80 L48,40 L52,40 Z" fill="#dc2626" />
      {/* magma chamber */}
      <ellipse cx="50" cy="90" rx="20" ry="8" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
      {/* crater + lava */}
      <polygon points="44,30 56,30 60,24 40,24" fill="#f97316" />
      {/* ash cloud */}
      <ellipse cx="50" cy="14" rx="16" ry="9" fill="#9ca3af" opacity="0.7" />
      <ellipse cx="40" cy="18" rx="9" ry="6" fill="#9ca3af" opacity="0.6" />
      <ellipse cx="62" cy="17" rx="9" ry="6" fill="#9ca3af" opacity="0.6" />
    </svg>
  )
}

// River from source (mountains) to mouth (sea).
function RiverDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" fill="#ecfccb" />
      {/* sea */}
      <rect x="0" y="78" width="100" height="22" fill="#bae6fd" />
      {/* mountains at source */}
      <polygon points="6,30 18,8 30,30" fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
      <polygon points="18,30 28,14 38,30" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
      {/* river: narrow at source, widening, meanders to sea */}
      <path d="M20,26 Q26,40 40,46 Q56,52 52,66 Q48,76 60,80"
        fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      {/* widening mouth */}
      <path d="M55,78 Q60,82 70,80 L60,80 Z" fill="#38bdf8" />
      {/* tributary */}
      <path d="M70,30 Q58,40 44,46" fill="none" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// Sun → plant → herbivore → carnivore food chain with arrows.
function FoodChainDiagram() {
  const items = [
    { x: 14, emoji: '☀️', ring: '#FFD43B' },
    { x: 38, emoji: '🌱', ring: '#52D9A0' },
    { x: 62, emoji: '🐛', ring: '#6C9EFF' },
    { x: 86, emoji: '🐦', ring: '#FF8FAB' },
  ]
  return (
    <svg viewBox="0 0 100 40" className="w-full h-full" aria-hidden="true">
      {items.map((it, i) => (
        <g key={i}>
          <circle cx={it.x} cy="18" r="9" fill="#fff" stroke={it.ring} strokeWidth="1.5" />
          <text x={it.x} y="22" textAnchor="middle" fontSize="9">{it.emoji}</text>
          {i < items.length - 1 && (
            <line x1={it.x + 10} y1="18" x2={items[i + 1].x - 10} y2="18" stroke="#2D3748" strokeWidth="1.2" markerEnd="url(#fc-arrow)" />
          )}
        </g>
      ))}
      <defs>
        <marker id="fc-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#2D3748" />
        </marker>
      </defs>
    </svg>
  )
}

// Simple circuit: cell, bulb, switch, connecting wires.
function SimpleCircuitDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* wire loop */}
      <rect x="18" y="22" width="64" height="56" rx="4" fill="none" stroke="#2D3748" strokeWidth="1.5" />
      {/* cell (battery) on bottom */}
      <line x1="42" y1="78" x2="42" y2="70" stroke="#2D3748" strokeWidth="1.2" />
      <line x1="42" y1="74" x2="42" y2="74" stroke="#2D3748" strokeWidth="0" />
      <rect x="40" y="73" width="3" height="10" fill="#2D3748" />
      <rect x="50" y="70" width="2" height="16" fill="#2D3748" />
      {/* bulb on top */}
      <circle cx="50" cy="22" r="7" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <path d="M46,19 L54,25 M54,19 L46,25" stroke="#f59e0b" strokeWidth="1" />
      {/* switch on left */}
      <circle cx="18" cy="46" r="2" fill="#2D3748" />
      <line x1="18" y1="46" x2="26" y2="40" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="56" r="2" fill="#2D3748" />
    </svg>
  )
}

// Earth's layers: crust, mantle, outer core, inner core.
function EarthLayersDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="#a16207" stroke="#78350f" strokeWidth="1" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#3f6212" strokeWidth="3" />
      <circle cx="50" cy="50" r="34" fill="#ea580c" />
      <circle cx="50" cy="50" r="22" fill="#f97316" />
      <circle cx="50" cy="50" r="11" fill="#fbbf24" />
    </svg>
  )
}

// === English ===============================================================

// Story mountain: beginning, build-up, climax, resolution, ending.
function StoryMountainDiagram() {
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full" aria-hidden="true">
      <line x1="4" y1="54" x2="96" y2="54" stroke="#cbd5e1" strokeWidth="1" />
      <path d="M6,52 L30,52 Q40,52 46,18 Q50,8 54,18 Q60,52 70,52 L94,52"
        fill="none" stroke="#FF8FAB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* point markers */}
      <circle cx="10" cy="52" r="2.5" fill="#FF8FAB" />
      <circle cx="34" cy="44" r="2.5" fill="#FF8FAB" />
      <circle cx="50" cy="12" r="2.5" fill="#FF8FAB" />
      <circle cx="66" cy="44" r="2.5" fill="#FF8FAB" />
      <circle cx="90" cy="52" r="2.5" fill="#FF8FAB" />
    </svg>
  )
}

// Word anatomy: prefix | root | suffix boxes (e.g. un-happy-ness).
function WordAnatomyDiagram() {
  const parts = [
    { x: 8, w: 26, fill: '#FFE3EC', stroke: '#FF8FAB' },
    { x: 37, w: 26, fill: '#E7F0FF', stroke: '#6C9EFF' },
    { x: 66, w: 26, fill: '#E3FBF0', stroke: '#52D9A0' },
  ]
  return (
    <svg viewBox="0 0 100 40" className="w-full h-full" aria-hidden="true">
      {parts.map((p, i) => (
        <rect key={i} x={p.x} y="12" width={p.w} height="18" rx="4" fill={p.fill} stroke={p.stroke} strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function PlaceholderDiagram({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="5" y="5" width="90" height="90" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
        {label.replace(/_/g, ' ')}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Maps a DiagramType to its inline SVG. Unknown types fall back to a labelled box. */
export function getDiagramSvg(diagramType: string): ReactNode {
  switch (diagramType) {
    // Maths
    case 'circle': return <CircleDiagram />
    case 'triangle':
    case 'right_triangle': return <TriangleDiagram />
    case 'multiplication_groups': return <MultiplicationGroupsDiagram />
    case 'bar_model': return <BarModelDiagram />
    case 'number_line': return <NumberLineDiagram />
    case 'fraction_circle': return <FractionCircleDiagram />
    case 'array_grid': return <ArrayGridDiagram />
    case 'place_value': return <PlaceValueDiagram />
    case 'clock_face': return <ClockFaceDiagram />
    // Science
    case 'plant': return <PlantDiagram />
    case 'animal_cell': return <AnimalCellDiagram />
    case 'water_cycle': return <WaterCycleDiagram />
    case 'human_heart': return <HumanHeartDiagram />
    case 'volcano': return <VolcanoDiagram />
    case 'river': return <RiverDiagram />
    case 'food_chain': return <FoodChainDiagram />
    case 'simple_circuit': return <SimpleCircuitDiagram />
    case 'earth_layers': return <EarthLayersDiagram />
    // English
    case 'story_mountain': return <StoryMountainDiagram />
    case 'word_anatomy': return <WordAnatomyDiagram />
    default: return <PlaceholderDiagram label={diagramType} />
  }
}

/** Aspect ratio per diagram (height/width as a percentage of width). */
export const DIAGRAM_ASPECT_RATIO: Record<DiagramType, number> = {
  // Maths
  circle: 100,
  triangle: 100,
  right_triangle: 100,
  multiplication_groups: 100,
  bar_model: 100,
  number_line: 30,
  fraction_circle: 100,
  array_grid: 100,
  place_value: 100,
  clock_face: 100,
  // Science
  plant: 120,
  animal_cell: 83,
  water_cycle: 75,
  human_heart: 100,
  volcano: 100,
  river: 100,
  food_chain: 40,
  simple_circuit: 100,
  earth_layers: 100,
  // English
  story_mountain: 60,
  word_anatomy: 40,
}

/** All registered diagram keys — used by tests to assert full coverage. */
export const DIAGRAM_TYPES = Object.keys(DIAGRAM_ASPECT_RATIO) as DiagramType[]
