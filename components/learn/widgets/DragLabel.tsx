'use client'
import { useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragLabelWidget } from '@/lib/learn-widgets'
import { WidgetWrapper } from './WidgetWrapper'

interface Props {
  widget: DragLabelWidget
}

interface State {
  selected: string | null
  placed: Record<string, string> // hotspotId -> labelId placed there
  shaking: string | null
}

// ---------------------------------------------------------------------------
// Inline SVG diagrams
// ---------------------------------------------------------------------------

function CircleDiagram() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* Circle outline */}
      <circle cx="50" cy="50" r="38" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      {/* Diameter line */}
      <line x1="12" y1="50" x2="88" y2="50" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 1" />
      {/* Radius line to upper-right */}
      <line x1="50" y1="50" x2="77" y2="23" stroke="#6C9EFF" strokeWidth="1.5" />
      {/* Chord line (not through centre) */}
      <line x1="22" y1="30" x2="75" y2="68" stroke="#94a3b8" strokeWidth="1.2" />
      {/* Centre dot */}
      <circle cx="50" cy="50" r="2.5" fill="#2D3748" />
      {/* Circumference arc label area point */}
      <circle cx="50" cy="12" r="1.5" fill="#94a3b8" />
    </svg>
  )
}

function TriangleDiagram() {
  // Right triangle: (15,85), (85,85), (15,20)
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <polygon points="15,85 85,85 15,20" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Right angle marker at (15,85) */}
      <polyline points="15,75 25,75 25,85" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
      {/* Vertex dots */}
      <circle cx="15" cy="20" r="2" fill="#6C9EFF" />
      <circle cx="85" cy="85" r="2" fill="#6C9EFF" />
      <circle cx="15" cy="85" r="2" fill="#6C9EFF" />
    </svg>
  )
}

function PlantDiagram() {
  return (
    <svg viewBox="0 0 100 120" className="w-full h-full" aria-hidden="true">
      {/* Ground line */}
      <line x1="10" y1="75" x2="90" y2="75" stroke="#92400e" strokeWidth="1.5" />
      {/* Roots */}
      <path d="M50,75 Q40,85 30,95" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M50,75 Q50,90 50,100" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M50,75 Q60,85 70,95" fill="none" stroke="#92400e" strokeWidth="1.2" />
      <path d="M40,85 Q35,95 28,105" fill="none" stroke="#92400e" strokeWidth="1" />
      <path d="M60,85 Q65,95 72,105" fill="none" stroke="#92400e" strokeWidth="1" />
      {/* Stem */}
      <line x1="50" y1="75" x2="50" y2="30" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
      {/* Left leaf */}
      <ellipse cx="33" cy="52" rx="13" ry="7" fill="#4ade80" stroke="#16a34a" strokeWidth="1"
        transform="rotate(-20 33 52)" />
      <line x1="50" y1="52" x2="33" y2="52" stroke="#16a34a" strokeWidth="1" />
      {/* Right leaf */}
      <ellipse cx="67" cy="48" rx="13" ry="7" fill="#4ade80" stroke="#16a34a" strokeWidth="1"
        transform="rotate(20 67 48)" />
      <line x1="50" y1="48" x2="67" y2="48" stroke="#16a34a" strokeWidth="1" />
      {/* Petals */}
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8"
        transform="rotate(45 50 22)" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8"
        transform="rotate(90 50 22)" />
      <ellipse cx="50" cy="18" rx="5" ry="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.8"
        transform="rotate(135 50 22)" />
      {/* Flower centre */}
      <circle cx="50" cy="22" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" />
    </svg>
  )
}

function AnimalCellDiagram() {
  return (
    <svg viewBox="0 0 120 100" className="w-full h-full" aria-hidden="true">
      {/* Cell membrane (irregular oval) */}
      <ellipse cx="60" cy="50" rx="55" ry="44" fill="#eff6ff" stroke="#60a5fa" strokeWidth="2" />
      {/* Cytoplasm label area — subtle inner fill already from above */}
      {/* Nucleus */}
      <ellipse cx="52" cy="48" rx="18" ry="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Nucleolus */}
      <ellipse cx="52" cy="48" rx="8" ry="6" fill="#93c5fd" stroke="#2563eb" strokeWidth="1" />
      {/* Mitochondria */}
      <ellipse cx="85" cy="35" rx="10" ry="6" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1"
        transform="rotate(-20 85 35)" />
      <ellipse cx="88" cy="62" rx="9" ry="5" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1"
        transform="rotate(15 88 62)" />
      {/* Ribosomes (dots) */}
      {[
        [30, 30], [72, 44], [40, 68], [65, 74], [20, 58], [95, 48],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="#a78bfa" />
      ))}
    </svg>
  )
}

function WaterCycleDiagram() {
  return (
    <svg viewBox="0 0 160 120" className="w-full h-full" aria-hidden="true">
      {/* Ocean / lake */}
      <path d="M0,95 Q20,88 40,95 Q60,102 80,95 Q100,88 120,95 Q140,102 160,95 L160,120 L0,120 Z"
        fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1" />
      {/* Mountains */}
      <polygon points="110,95 135,55 160,95" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
      <polygon points="125,95 150,65 160,95" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
      {/* Trees on mountain */}
      <line x1="128" y1="95" x2="128" y2="78" stroke="#16a34a" strokeWidth="1.5" />
      <ellipse cx="128" cy="74" rx="5" ry="7" fill="#4ade80" />
      {/* Sun */}
      <circle cx="140" cy="18" r="10" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
      {[0,45,90,135,180,225,270,315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        return (
          <line key={i}
            x1={140 + 12 * Math.cos(rad)} y1={18 + 12 * Math.sin(rad)}
            x2={140 + 16 * Math.cos(rad)} y2={18 + 16 * Math.sin(rad)}
            stroke="#f59e0b" strokeWidth="1" />
        )
      })}
      {/* Cloud */}
      <ellipse cx="55" cy="25" rx="22" ry="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="40" cy="28" rx="13" ry="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <ellipse cx="70" cy="28" rx="13" ry="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      {/* Evaporation arrows (water to cloud) */}
      <path d="M25,88 Q15,60 40,32" fill="none" stroke="#0ea5e9" strokeWidth="1.5"
        markerEnd="url(#arrow-blue)" strokeDasharray="3 2" />
      {/* Condensation arrow (inside cloud area) */}
      <path d="M55,15 Q58,10 62,15" fill="none" stroke="#64748b" strokeWidth="1.2" />
      {/* Precipitation (rain drops) */}
      {[[48,40],[55,42],[62,40],[50,48],[58,50]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.5" ry="3" fill="#60a5fa" />
      ))}
      {/* Surface runoff arrow */}
      <path d="M30,95 Q55,100 80,95" fill="none" stroke="#0ea5e9" strokeWidth="1.5"
        markerEnd="url(#arrow-blue)" />
      {/* Transpiration arrow from tree */}
      <path d="M128,70 Q118,55 100,40" fill="none" stroke="#16a34a" strokeWidth="1.5"
        markerEnd="url(#arrow-green)" strokeDasharray="3 2" />

      <defs>
        <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#0ea5e9" />
        </marker>
        <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#16a34a" />
        </marker>
      </defs>
    </svg>
  )
}

function PlaceholderDiagram({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="5" y="5" width="90" height="90" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
        {label.replace(/_/g, ' ')}
      </text>
    </svg>
  )
}

function getDiagramSvg(diagramType: string): ReactNode {
  switch (diagramType) {
    case 'circle':       return <CircleDiagram />
    case 'triangle':
    case 'right_triangle': return <TriangleDiagram />
    case 'plant':        return <PlantDiagram />
    case 'animal_cell':  return <AnimalCellDiagram />
    case 'water_cycle':  return <WaterCycleDiagram />
    default:             return <PlaceholderDiagram label={diagramType} />
  }
}

// Aspect ratios per diagram type (height/width as %)
const ASPECT_RATIO: Record<string, number> = {
  circle:       100,
  triangle:     100,
  right_triangle: 100,
  plant:        120,
  animal_cell:  83,   // 100/120
  water_cycle:  75,   // 120/160
  human_heart:  100,
  volcano:      100,
  river:        100,
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DragLabel({ widget }: Props) {
  const { config } = widget

  const [state, setState] = useState<State>({
    selected: null,
    placed: {},
    shaking: null,
  })

  const completed = config.items.every(item => state.placed[item.id] === item.id)

  // Id of the label currently occupying a hotspot (or null)
  const labelAtHotspot = (hotspotId: string) => state.placed[hotspotId] ?? null
  // Whether a label id is placed anywhere
  const isLabelPlaced = (labelId: string) =>
    Object.values(state.placed).includes(labelId)

  const handleChipTap = useCallback(
    (labelId: string) => {
      if (completed) return
      setState(prev => {
        // If already selected, deselect
        if (prev.selected === labelId) return { ...prev, selected: null }
        return { ...prev, selected: labelId }
      })
    },
    [completed]
  )

  const handleHotspotTap = useCallback(
    (hotspotId: string) => {
      if (completed) return

      setState(prev => {
        const existingLabel = prev.placed[hotspotId]

        // Tap occupied hotspot → remove label back to tray
        if (existingLabel) {
          const next = { ...prev.placed }
          delete next[hotspotId]
          return { ...prev, placed: next, selected: null, shaking: null }
        }

        // No label selected → nothing to do
        if (!prev.selected) return prev

        const isCorrect = prev.selected === hotspotId

        if (isCorrect) {
          // Remove label from any previous hotspot it was in
          const cleaned = Object.fromEntries(
            Object.entries(prev.placed).filter(([, v]) => v !== prev.selected)
          )
          const next = { ...cleaned, [hotspotId]: prev.selected }
          return { ...prev, placed: next, selected: null, shaking: null }
        } else {
          // Wrong — shake hotspot, deselect
          return { ...prev, selected: null, shaking: hotspotId }
        }
      })

      // Clear shake after animation
      setTimeout(() => {
        setState(prev => (prev.shaking === hotspotId ? { ...prev, shaking: null } : prev))
      }, 600)
    },
    [completed]
  )

  const aspectPadding = ASPECT_RATIO[config.diagram_type] ?? 100

  return (
    <WidgetWrapper
      title={config.title}
      instructions={config.instructions ?? 'Tap a label, then tap where it belongs on the diagram.'}
      completed={completed}
    >
      {/* Diagram + hotspots */}
      <div
        className="relative w-full mb-5 select-none"
        style={{ paddingTop: `${aspectPadding}%` }}
      >
        {/* SVG diagram fills the box */}
        <div className="absolute inset-0">
          {getDiagramSvg(config.diagram_type)}
        </div>

        {/* Hotspot buttons overlaid on diagram */}
        {config.items.map(item => {
          const placedLabelId = labelAtHotspot(item.id)
          const isCorrectlyPlaced = placedLabelId === item.id
          const isShaking = state.shaking === item.id
          const isSelectedHotspot = state.selected !== null && !placedLabelId

          return (
            <motion.button
              key={item.id}
              onClick={() => handleHotspotTap(item.id)}
              disabled={completed}
              aria-label={placedLabelId ? `${item.label} placed — tap to remove` : `Hotspot for ${item.label}`}
              animate={isShaking ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={[
                'absolute flex items-center justify-center',
                'min-w-[48px] min-h-[48px] -translate-x-1/2 -translate-y-1/2',
                'rounded-full border-2 px-2 py-1 text-[10px] font-bold leading-tight text-center',
                'transition-colors duration-150 cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                isCorrectlyPlaced
                  ? 'border-[#40C057] bg-[#40C057]/15 text-[#40C057]'
                  : isShaking
                  ? 'border-[#FF6B6B] bg-[#FF6B6B]/15 text-[#FF6B6B]'
                  : isSelectedHotspot
                  ? 'border-[#6C9EFF] bg-[#6C9EFF]/10 border-dashed animate-pulse text-[#718096]'
                  : 'border-dashed border-[#6C9EFF]/50 bg-white/70 text-[#718096]',
              ].join(' ')}
              style={{
                left: `${item.hotspot.x}%`,
                top: `${item.hotspot.y}%`,
                maxWidth: '72px',
              }}
            >
              <AnimatePresence mode="wait">
                {isCorrectlyPlaced ? (
                  <motion.span
                    key="placed"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <span className="text-[#40C057] text-xs">✓</span>
                    <span className="leading-tight" style={{ fontSize: '9px' }}>{item.label}</span>
                  </motion.span>
                ) : (
                  <motion.span key="empty" className="text-[10px] opacity-60">?</motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>

      {/* Label tray */}
      <div className="flex flex-wrap gap-2 justify-center">
        {config.items.map(item => {
          const placed = isLabelPlaced(item.id)
          const selected = state.selected === item.id

          if (placed) {
            // Show grayed-out ghost so tray doesn't reflow
            return (
              <div
                key={item.id}
                className="min-h-[48px] px-4 py-2 rounded-full border-2 border-transparent
                  bg-gray-100 text-gray-300 text-sm font-semibold opacity-40 select-none"
                aria-hidden="true"
              >
                {item.label}
              </div>
            )
          }

          return (
            <motion.button
              key={item.id}
              onClick={() => handleChipTap(item.id)}
              disabled={completed}
              whileTap={{ scale: 0.94 }}
              aria-pressed={selected}
              aria-label={item.label}
              className={[
                'min-h-[48px] px-4 py-2 rounded-full border-2 text-sm font-semibold',
                'transition-colors duration-150 cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C9EFF] focus-visible:ring-offset-1',
                selected
                  ? 'border-[#6C9EFF] bg-[#6C9EFF]/10 text-[#2D3748] ring-2 ring-[#6C9EFF]'
                  : 'border-[#6C9EFF]/40 bg-white text-[#2D3748] hover:border-[#6C9EFF] hover:bg-[#6C9EFF]/5',
              ].join(' ')}
            >
              {item.label}
            </motion.button>
          )
        })}
      </div>

      {/* Instruction hint when a label is selected */}
      <AnimatePresence>
        {state.selected && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-3 text-center text-xs text-[#718096]"
          >
            Now tap the correct spot on the diagram ↑
          </motion.p>
        )}
      </AnimatePresence>
    </WidgetWrapper>
  )
}
