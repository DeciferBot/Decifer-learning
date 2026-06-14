'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragLabelWidget } from '@/lib/learn-widgets'
import { getDiagramSvg, DIAGRAM_ASPECT_RATIO } from '../diagrams'
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

  const aspectPadding = DIAGRAM_ASPECT_RATIO[config.diagram_type] ?? 100

  return (
    <WidgetWrapper
      title={config.title}
      instructions={config.instructions ?? 'Tap a label, then tap where it belongs on the diagram.'}
      completed={completed}
    >
      {/* Diagram + hotspots — capped at 280px so it doesn't dominate the page */}
      <div
        className="relative w-full mb-5 select-none mx-auto"
        style={{
          maxWidth: '340px',
          height: `${Math.min((aspectPadding / 100) * 340, 280)}px`,
        }}
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
