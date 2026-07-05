'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SentenceBuilderWidget } from '@/lib/learn-widgets'
import { WidgetWrapper } from './WidgetWrapper'

interface Props {
  widget: SentenceBuilderWidget
}

interface State {
  selectedTileId: string | null
  slotContents: Record<string, string> // slotId → tileId
  wrongSlots: Set<string>
  completed: boolean
}

// ---------------------------------------------------------------------------
// Word-class colour map
// ---------------------------------------------------------------------------

const TILE_COLOURS: Record<string, string> = {
  noun:        'bg-purple-100 border-purple-400 text-purple-800',
  verb:        'bg-green-100 border-green-400 text-green-800',
  adjective:   'bg-yellow-100 border-yellow-400 text-yellow-800',
  adverb:      'bg-orange-100 border-orange-400 text-orange-800',
  conjunction: 'bg-blue-100 border-blue-400 text-blue-800',
  preposition: 'bg-pink-100 border-pink-400 text-pink-800',
  punctuation: 'bg-gray-100 border-gray-400 text-gray-600',
  other:       'bg-slate-100 border-slate-400 text-slate-700',
}

const TILE_COLOURS_SOLID: Record<string, string> = {
  noun:        'bg-purple-200 border-purple-500 text-purple-900',
  verb:        'bg-green-200 border-green-500 text-green-900',
  adjective:   'bg-yellow-200 border-yellow-500 text-yellow-900',
  adverb:      'bg-orange-200 border-orange-500 text-orange-900',
  conjunction: 'bg-blue-200 border-blue-500 text-blue-900',
  preposition: 'bg-pink-200 border-pink-500 text-pink-900',
  punctuation: 'bg-gray-200 border-gray-500 text-gray-700',
  other:       'bg-slate-200 border-slate-500 text-slate-800',
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getTileById(tiles: SentenceBuilderWidget['config']['tiles'], id: string) {
  return tiles.find(t => t.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Tile({
  tile,
  selected,
  ghost,
  disabled,
  onTap,
}: {
  tile: SentenceBuilderWidget['config']['tiles'][number]
  selected: boolean
  ghost: boolean
  disabled: boolean
  onTap: () => void
}) {
  const colourClass = TILE_COLOURS[tile.type] ?? TILE_COLOURS.other

  if (ghost) {
    return (
      <div
        aria-hidden="true"
        className={`min-h-[44px] px-3 py-2 rounded-xl border-2 text-sm font-semibold
          opacity-30 select-none ${colourClass}`}
      >
        {tile.text}
      </div>
    )
  }

  return (
    <motion.button
      onClick={onTap}
      disabled={disabled}
      whileTap={{ scale: 0.93 }}
      aria-pressed={selected}
      aria-label={`Word tile: ${tile.text}`}
      className={[
        'min-h-[44px] px-3 py-2 rounded-xl border-2 text-sm font-semibold',
        'transition-colors duration-150 cursor-pointer select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C9EFF] focus-visible:ring-offset-1',
        colourClass,
        selected
          ? 'ring-2 ring-[#6C9EFF] ring-offset-1 scale-[1.04] shadow-md'
          : 'hover:opacity-90',
      ].join(' ')}
    >
      {tile.text}
    </motion.button>
  )
}

function Slot({
  slot,
  placedTile,
  isWrong,
  isTargeted,
  completed,
  onTap,
}: {
  slot: SentenceBuilderWidget['config']['slots'][number]
  placedTile: SentenceBuilderWidget['config']['tiles'][number] | null
  isWrong: boolean
  isTargeted: boolean
  completed: boolean
  onTap: () => void
}) {
  const filledColour = placedTile
    ? (TILE_COLOURS_SOLID[placedTile.type] ?? TILE_COLOURS_SOLID.other)
    : ''

  const borderClass = (() => {
    if (isWrong) return 'border-[#FF6B6B] bg-red-50'
    if (completed && placedTile) return 'border-[#40C057] bg-green-50'
    if (placedTile) return filledColour
    if (isTargeted) return 'border-[#6C9EFF] bg-[#6C9EFF]/5 animate-pulse'
    return 'border-dashed border-[#94a3b8] bg-gray-50'
  })()

  return (
    <motion.button
      onClick={onTap}
      disabled={completed && !isWrong}
      animate={isWrong ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : {}}
      transition={{ duration: 0.5 }}
      aria-label={
        placedTile
          ? `Slot: ${placedTile.text}, tap to remove`
          : `Empty slot for ${slot.placeholder}`
      }
      className={[
        'min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border-2',
        'flex items-center justify-center',
        'text-sm font-semibold transition-colors duration-150 cursor-pointer select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C9EFF] focus-visible:ring-offset-1',
        borderClass,
      ].join(' ')}
    >
      {placedTile ? (
        <AnimatePresence mode="wait">
          <motion.span
            key={placedTile.id}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {placedTile.text}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className="text-[#94a3b8] text-xs tracking-wide">{slot.placeholder}</span>
      )}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SentenceBuilder({ widget }: Props) {
  const { config } = widget

  const [state, setState] = useState<State>({
    selectedTileId: null,
    slotContents: {},
    wrongSlots: new Set(),
    completed: false,
  })

  // Derive which tile ids are placed in any slot
  const placedTileIds = new Set(Object.values(state.slotContents))

  // All slots filled?
  const allFilled = config.slots.every(s => state.slotContents[s.id] !== undefined)

  // ---------------------------------------------------------------------------
  // Auto-check when all slots filled
  // ---------------------------------------------------------------------------
  const runCheck = useCallback(
    (slotContents: Record<string, string>): { wrong: Set<string>; allCorrect: boolean } => {
      const wrong = new Set<string>()
      for (const slot of config.slots) {
        const tileId = slotContents[slot.id]
        if (!tileId || !slot.accepts.includes(tileId)) {
          wrong.add(slot.id)
        }
      }
      return { wrong, allCorrect: wrong.size === 0 }
    },
    [config.slots]
  )

  // ---------------------------------------------------------------------------
  // Tap handlers
  // ---------------------------------------------------------------------------

  const handleTileTap = useCallback(
    (tileId: string) => {
      if (state.completed) return
      setState(prev => {
        // Toggle selection
        if (prev.selectedTileId === tileId) return { ...prev, selectedTileId: null }
        return { ...prev, selectedTileId: tileId }
      })
    },
    [state.completed]
  )

  const handleSlotTap = useCallback(
    (slotId: string) => {
      if (state.completed) return

      setState(prev => {
        const occupyingTileId = prev.slotContents[slotId]

        // Occupied slot tapped → return tile to pool, clear wrong status
        if (occupyingTileId) {
          const next = { ...prev.slotContents }
          delete next[slotId]
          const nextWrong = new Set(prev.wrongSlots)
          nextWrong.delete(slotId)
          return { ...prev, slotContents: next, wrongSlots: nextWrong, selectedTileId: null }
        }

        // No tile selected — nothing to do (pulsing border shows it's a target)
        if (!prev.selectedTileId) return prev

        // Place selected tile into this slot
        // Remove the tile from any other slot it was in (shouldn't happen normally,
        // but covers edge case)
        const cleaned: Record<string, string> = {}
        for (const [sid, tid] of Object.entries(prev.slotContents)) {
          if (tid !== prev.selectedTileId) cleaned[sid] = tid
        }
        const nextContents = { ...cleaned, [slotId]: prev.selectedTileId }

        // Auto-check if all slots are now filled
        const nowAllFilled = config.slots.every(s => nextContents[s.id] !== undefined)
        if (nowAllFilled) {
          const { wrong, allCorrect } = runCheck(nextContents)
          return {
            slotContents: nextContents,
            wrongSlots: wrong,
            completed: allCorrect,
            selectedTileId: null,
          }
        }

        return {
          ...prev,
          slotContents: nextContents,
          selectedTileId: null,
          wrongSlots: new Set(), // clear previous wrongs on new placement
        }
      })
    },
    [state.completed, config.slots, runCheck]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasSelectedTile = state.selectedTileId !== null && !placedTileIds.has(state.selectedTileId)

  return (
    <WidgetWrapper
      title={config.title}
      instructions={(config as { instructions?: string }).instructions ?? 'Tap a word, then tap a box to place it.'}
      completed={state.completed}
    >
      {/* ── Sentence slots ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5 items-center" role="group" aria-label="Sentence slots">
        {config.slots.map(slot => {
          const placedTile = state.slotContents[slot.id]
            ? getTileById(config.tiles, state.slotContents[slot.id])
            : null
          const isWrong = state.wrongSlots.has(slot.id)
          // Slot is "targeted" when a tile is selected and slot is empty
          const isTargeted = hasSelectedTile && !placedTile && !state.completed

          return (
            <Slot
              key={slot.id}
              slot={slot}
              placedTile={placedTile}
              isWrong={isWrong}
              isTargeted={isTargeted}
              completed={state.completed && !isWrong}
              onTap={() => handleSlotTap(slot.id)}
            />
          )
        })}
      </div>

      {/* ── Completed sentence ────────────────────────────────────────── */}
      <AnimatePresence>
        {state.completed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-green-50 border border-[#40C057]/30"
          >
            <p className="text-sm font-semibold text-[#2D3748] text-center">
              {config.target_sentence}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      {!state.completed && (
        <div className="border-t border-dashed border-[#e2e8f0] mb-4" />
      )}

      {/* ── Word tile pool ────────────────────────────────────────────── */}
      {!state.completed && (
        <div
          className="flex flex-wrap gap-2 items-center"
          role="group"
          aria-label="Word tiles"
        >
          {config.tiles.map(tile => {
            const isPlaced = placedTileIds.has(tile.id)
            const isSelected = state.selectedTileId === tile.id
            return (
              <Tile
                key={tile.id}
                tile={tile}
                selected={isSelected}
                ghost={isPlaced}
                disabled={state.completed}
                onTap={() => handleTileTap(tile.id)}
              />
            )
          })}
        </div>
      )}

      {/* ── Hint when tile selected ───────────────────────────────────── */}
      <AnimatePresence>
        {hasSelectedTile && !state.completed && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-3 text-center text-xs text-[#718096]"
          >
            Now tap an empty box above ↑
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Wrong-slots feedback ──────────────────────────────────────── */}
      <AnimatePresence>
        {state.wrongSlots.size > 0 && !state.completed && allFilled && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-xs font-semibold text-[#FF6B6B]"
          >
            Some words are in the wrong place. Tap a red box to swap it out.
          </motion.p>
        )}
      </AnimatePresence>
    </WidgetWrapper>
  )
}
