'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

export type WonderType =
  | 'temperature'
  | 'speed-of-light'
  | 'size-comparison'
  | 'jupiter-size'
  | 'saturn-rings'
  | 'gravity'

export const WONDER_LABELS: Record<WonderType, string> = {
  'temperature':     '🌡️ See the temperature swing',
  'speed-of-light':  '💡 See light travel to Earth',
  'size-comparison': '📐 See the size comparison',
  'jupiter-size':    '🔵 See 1,300 Earths fit inside',
  'saturn-rings':    '💍 See the rings to scale',
  'gravity':         '⚖️ Compare gravity across worlds',
}

// ---------------------------------------------------------------------------
// Temperature
// ---------------------------------------------------------------------------
const TEMP_DATA: Record<string, { day: number; night: number | null; caption: string }> = {
  Mercury: { day: 430,  night: -180, caption: 'A 610°C swing between day and night — the most extreme temperature range in the Solar System.' },
  Venus:   { day: 465,  night: null, caption: 'A constant 465°C — hotter than Mercury despite being twice as far from the Sun.' },
}

function TemperatureViz({ planetName }: { planetName: string }) {
  const data = TEMP_DATA[planetName] ?? TEMP_DATA.Mercury
  const [dayFill, setDayFill] = useState(0)
  const [nightFill, setNightFill] = useState(0)
  // Scale: -200°C = 0%, +500°C = 100%
  const toPercent = (t: number) => Math.round(((t + 200) / 700) * 100)

  useEffect(() => {
    const t1 = setTimeout(() => setDayFill(toPercent(data.day)), 400)
    const t2 = data.night !== null ? setTimeout(() => setNightFill(toPercent(data.night!)), 800) : undefined
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2) }
  }, [data])

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <h3 className="text-2xl font-extrabold text-white text-center">Extreme Temperatures</h3>
      <div className="flex gap-10 justify-center items-end">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Day side</p>
          <div className="relative w-12 h-52 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <motion.div
              className="absolute bottom-0 inset-x-0"
              initial={{ height: '0%' }}
              animate={{ height: `${dayFill}%` }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              style={{ background: 'linear-gradient(to top, #ff2200, #ff6600, #ffcc00)' }}
            />
          </div>
          <p className="text-xl font-extrabold text-orange-400">+{data.day}°C</p>
        </div>
        {data.night !== null && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Night side</p>
            <div className="relative w-12 h-52 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <motion.div
                className="absolute bottom-0 inset-x-0"
                initial={{ height: '0%' }}
                animate={{ height: `${nightFill}%` }}
                transition={{ duration: 1.6, ease: 'easeOut', delay: 0.5 }}
                style={{ background: 'linear-gradient(to top, #0000cc, #0055ff, #00ccff)' }}
              />
            </div>
            <p className="text-xl font-extrabold text-blue-400">{data.night}°C</p>
          </div>
        )}
      </div>
      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">{data.caption}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Speed of Light
// ---------------------------------------------------------------------------
function SpeedOfLightViz() {
  const [secs, setSecs] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const DURATION = 3500
    const TARGET = 499
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / DURATION, 1)
      setSecs(Math.round(progress * TARGET))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const minutes = Math.floor(secs / 60)
  const remainderSecs = secs % 60
  const progress = secs / 499

  return (
    <div className="w-full flex flex-col items-center gap-8">
      <h3 className="text-2xl font-extrabold text-white text-center">The Speed of Light</h3>

      {/* Beam track */}
      <div className="relative w-full h-20 flex items-center px-4">
        <div className="absolute left-8 right-8 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {/* Sun */}
        <div className="absolute left-4 flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #fffde7, #ff8800)', boxShadow: '0 0 24px #ff8800' }} />
          <p className="text-[10px] text-white/40">Sun</p>
        </div>
        {/* Earth */}
        <div className="absolute right-4 flex flex-col items-center gap-1">
          <div className="w-7 h-7 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #4fc3f7, #1565c0)' }} />
          <p className="text-[10px] text-white/40">Earth</p>
        </div>
        {/* Photon */}
        <div
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: `calc(${5 + progress * 80}% )`,
            background: '#ffffff',
            boxShadow: '0 0 10px 4px rgba(200,220,255,0.7)',
          }}
        />
      </div>

      {/* Counter */}
      <div className="text-center">
        <p className="text-6xl font-extrabold text-white tabular-nums tracking-tight">
          {minutes}m {String(remainderSecs).padStart(2, '0')}s
        </p>
        <p className="text-sm text-white/40 mt-2 tracking-wide">travel time from Sun to Earth</p>
      </div>

      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">
        Even at 300,000 km per second — the fastest speed in the universe — light takes 8 minutes and 20 seconds to reach us.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Size Comparison
// ---------------------------------------------------------------------------
const SIZE_DATA: Record<string, { ratio: number; diameter: string; caption: string; color: string; glow: string }> = {
  Mars:   { ratio: 0.532, diameter: '6,779 km',  caption: 'Mars is just over half the diameter of Earth.', color: '#c1440e', glow: '#c1440e' },
  Uranus: { ratio: 4.007, diameter: '50,724 km', caption: 'Uranus is 4 times wider than Earth — an ice giant that dwarfs our world.', color: '#7de8e8', glow: '#7de8e8' },
}
const EARTH_SIZE = 72

function SizeComparisonViz({ planetName }: { planetName: string }) {
  const data = SIZE_DATA[planetName] ?? { ratio: 1, diameter: '12,742 km', caption: '', color: '#6C9EFF', glow: '#6C9EFF' }
  const planetPx = Math.min(Math.round(EARTH_SIZE * data.ratio), 240)

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <h3 className="text-2xl font-extrabold text-white text-center">Size Comparison</h3>
      <div className="flex items-end justify-center gap-8 pb-2">
        <div className="flex flex-col items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 180 }}
            className="rounded-full"
            style={{ width: EARTH_SIZE, height: EARTH_SIZE, background: 'radial-gradient(circle at 35% 35%, #4fc3f7, #1565c0)', boxShadow: '0 0 20px rgba(79,195,247,0.3)' }}
          />
          <p className="text-xs font-semibold text-white/70">Earth</p>
          <p className="text-[10px] text-white/35">12,742 km</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.55, type: 'spring', stiffness: 180 }}
            className="rounded-full"
            style={{ width: planetPx, height: planetPx, background: `radial-gradient(circle at 35% 35%, ${data.color}cc, ${data.color})`, boxShadow: `0 0 24px ${data.glow}44` }}
          />
          <p className="text-xs font-semibold text-white/70">{planetName}</p>
          <p className="text-[10px] text-white/35">{data.diameter}</p>
        </div>
      </div>
      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">{data.caption}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Jupiter size
// ---------------------------------------------------------------------------
function JupiterSizeViz() {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const DURATION = 2500
    const TARGET = 1300
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / DURATION, 1)
      setCount(Math.round(progress * TARGET))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <h3 className="text-2xl font-extrabold text-white text-center">Jupiter vs Earth</h3>
      <div className="flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
          className="rounded-full flex flex-wrap items-center justify-center gap-1 p-5"
          style={{ width: 210, height: 210, background: 'radial-gradient(circle at 35% 35%, #deb887, #b07040)', boxShadow: '0 0 40px rgba(176,112,64,0.4)' }}
        >
          {Array.from({ length: 13 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.07, type: 'spring', stiffness: 300 }}
              className="rounded-full flex-none"
              style={{ width: 14, height: 14, background: 'radial-gradient(circle at 35% 35%, #4fc3f7, #1565c0)' }}
            />
          ))}
        </motion.div>
      </div>
      <div className="text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-5xl font-extrabold text-white tabular-nums"
        >
          {count.toLocaleString()}
        </motion.p>
        <p className="text-sm text-white/50 mt-1">Earths could fit inside Jupiter</p>
      </div>
      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">
        Each blue dot represents 100 Earths. Jupiter is so massive it has 2.5× the mass of all other planets combined.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saturn rings
// ---------------------------------------------------------------------------
function SaturnRingsViz() {
  return (
    <div className="w-full flex flex-col items-center gap-5">
      <h3 className="text-2xl font-extrabold text-white text-center">Saturn&apos;s Rings to Scale</h3>
      <motion.svg
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        viewBox="0 0 320 180"
        className="w-full max-w-xs"
        style={{ overflow: 'visible' }}
      >
        {/* Outer glow ring */}
        <ellipse cx="160" cy="90" rx="148" ry="30" fill="none" stroke="rgba(210,180,140,0.15)" strokeWidth="20" />
        {/* Ring B */}
        <ellipse cx="160" cy="90" rx="138" ry="27" fill="none" stroke="rgba(200,170,120,0.55)" strokeWidth="14" />
        {/* Ring A */}
        <ellipse cx="160" cy="90" rx="120" ry="23" fill="none" stroke="rgba(180,150,100,0.45)" strokeWidth="9" />
        {/* Ring C (inner, faint) */}
        <ellipse cx="160" cy="90" rx="103" ry="20" fill="none" stroke="rgba(200,170,120,0.25)" strokeWidth="5" />
        {/* Saturn body */}
        <circle cx="160" cy="90" r="42" fill="url(#sg)" />
        <defs>
          <radialGradient id="sg" cx="38%" cy="35%">
            <stop offset="0%" stopColor="#ede0a0" />
            <stop offset="100%" stopColor="#a87840" />
          </radialGradient>
          <radialGradient id="eg" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#4fc3f7" />
            <stop offset="100%" stopColor="#1565c0" />
          </radialGradient>
        </defs>
        {/* Earth dot for scale — top right */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <circle cx="295" cy="48" r="7" fill="url(#eg)" />
          <text x="295" y="36" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Earth</text>
        </motion.g>
        {/* Scale label */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          <line x1="22" y1="135" x2="298" y2="135" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4 4" />
          <text x="160" y="150" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif">← 282,000 km →</text>
        </motion.g>
      </motion.svg>
      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs">
        The rings span 282,000 km — yet are only about 10 metres thick. Earth (top right) shows the true scale.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gravity comparison
// ---------------------------------------------------------------------------
const GRAVITY_PLANETS = [
  { name: 'Mercury', g: 0.38, color: '#b5b5b5' },
  { name: 'Mars',    g: 0.38, color: '#c1440e' },
  { name: 'Venus',   g: 0.90, color: '#e8cda0' },
  { name: 'Uranus',  g: 0.90, color: '#7de8e8' },
  { name: 'Earth',   g: 1.00, color: '#4fc3f7' },
  { name: 'Saturn',  g: 1.07, color: '#e4d191' },
  { name: 'Neptune', g: 1.14, color: '#5b86e5' },
  { name: 'Jupiter', g: 2.53, color: '#c9956c' },
]

function GravityViz({ planetName }: { planetName: string }) {
  const sorted = [...GRAVITY_PLANETS].sort((a, b) => a.g - b.g)
  const maxG = 2.53

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <h3 className="text-2xl font-extrabold text-white text-center">Gravity Across the Solar System</h3>
      <div className="w-full space-y-2.5">
        {sorted.map((p, i) => {
          const isHighlight = p.name === planetName
          return (
            <div key={p.name} className="flex items-center gap-3">
              <p className="text-xs text-white/50 w-14 text-right flex-none">{p.name}</p>
              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.g / maxG) * 100}%` }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: 'easeOut' }}
                  style={{
                    background: p.color,
                    opacity: isHighlight ? 1 : 0.45,
                    boxShadow: isHighlight ? `0 0 10px ${p.color}99` : 'none',
                  }}
                />
              </div>
              <p className="text-xs font-bold w-10 flex-none" style={{ color: isHighlight ? p.color : 'rgba(255,255,255,0.5)' }}>
                {p.g}g
              </p>
            </div>
          )
        })}
      </div>
      <p className="text-sm text-white/60 text-center leading-relaxed max-w-xs mt-2">
        On Jupiter you&apos;d weigh 2.5× more. On Mars or Mercury, you&apos;d weigh less than half — and jump over twice as high.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function WonderOverlay({ type, planetName, onClose }: {
  type: WonderType
  planetName: string
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex flex-col overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #080820 0%, #000008 100%)' }}
      onClick={onClose}
    >
      <div className="min-h-full flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-none">
          <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest">✨ Wonder Moment</p>
          <button
            onClick={onClose}
            className="rounded-full flex items-center justify-center text-white/50"
            style={{ background: 'rgba(255,255,255,0.1)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Close"
          >✕</button>
        </div>

        {/* Visualization */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
          {type === 'temperature'     && <TemperatureViz planetName={planetName} />}
          {type === 'speed-of-light'  && <SpeedOfLightViz />}
          {type === 'size-comparison' && <SizeComparisonViz planetName={planetName} />}
          {type === 'jupiter-size'    && <JupiterSizeViz />}
          {type === 'saturn-rings'    && <SaturnRingsViz />}
          {type === 'gravity'         && <GravityViz planetName={planetName} />}
        </div>

        {/* Close button at bottom */}
        <div className="flex-none px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-sm font-bold text-white active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px' }}
          >
            Back to {planetName}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
