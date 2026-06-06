'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Planet {
  id: string
  name: string
  emoji: string
  color: string
  glowColor: string
  size: number
  orbitRadius: number
  period: number // seconds for one orbit
  moons: number
  diameter: string
  distanceFromSun: string
  orbitalPeriod: string
  fact: string
  description: string
  rings?: boolean
}

const PLANETS: Planet[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    emoji: '🪨',
    color: '#9E9E9E',
    glowColor: '#bdbdbd',
    size: 7,
    orbitRadius: 62,
    period: 6,
    moons: 0,
    diameter: '4,879 km (about 38% of Earth)',
    distanceFromSun: '57.9 million km',
    orbitalPeriod: '88 Earth days',
    fact: 'Despite being closest to the Sun, Venus is actually hotter! Mercury has almost no atmosphere to trap heat.',
    description: 'The smallest planet and fastest orbiter. One day on Mercury lasts longer than its entire year!',
  },
  {
    id: 'venus',
    name: 'Venus',
    emoji: '🌕',
    color: '#F5CE42',
    glowColor: '#f5e642',
    size: 11,
    orbitRadius: 90,
    period: 10,
    moons: 0,
    diameter: '12,104 km (very similar to Earth)',
    distanceFromSun: '108.2 million km',
    orbitalPeriod: '225 Earth days',
    fact: 'Venus spins backwards compared to most planets — so on Venus, the Sun rises in the west and sets in the east!',
    description: 'The hottest planet at 465°C, wrapped in thick clouds of sulphuric acid. Beautiful but deadly.',
  },
  {
    id: 'earth',
    name: 'Earth',
    emoji: '🌍',
    color: '#4FC3F7',
    glowColor: '#4fc3f7',
    size: 12,
    orbitRadius: 122,
    period: 14,
    moons: 1,
    diameter: '12,742 km',
    distanceFromSun: '149.6 million km (1 AU)',
    orbitalPeriod: '365.25 days',
    fact: 'Earth is the only planet not named after a god. It\'s also the densest planet in the Solar System.',
    description: 'Our home — the only known planet with liquid water on the surface and life as we know it.',
  },
  {
    id: 'mars',
    name: 'Mars',
    emoji: '🔴',
    color: '#EF5350',
    glowColor: '#ef5350',
    size: 9,
    orbitRadius: 158,
    period: 20,
    moons: 2,
    diameter: '6,779 km (about half of Earth)',
    distanceFromSun: '227.9 million km',
    orbitalPeriod: '687 Earth days',
    fact: 'Mars has the tallest volcano in the Solar System — Olympus Mons is nearly 3× the height of Everest!',
    description: 'The Red Planet gets its colour from iron oxide (rust). It has the largest dust storms in the Solar System.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    emoji: '🟠',
    color: '#FF8A65',
    glowColor: '#ff8a65',
    size: 26,
    orbitRadius: 210,
    period: 34,
    moons: 95,
    diameter: '139,820 km (11× Earth)',
    distanceFromSun: '778.5 million km',
    orbitalPeriod: '12 Earth years',
    fact: 'The Great Red Spot on Jupiter is a storm that has been raging for over 350 years — and it\'s larger than Earth!',
    description: 'The largest planet — so massive it could fit all other planets inside it twice over. A true giant.',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    emoji: '🪐',
    color: '#FFD54F',
    glowColor: '#ffd54f',
    size: 22,
    orbitRadius: 262,
    period: 46,
    moons: 146,
    rings: true,
    diameter: '116,460 km (9× Earth)',
    distanceFromSun: '1.43 billion km',
    orbitalPeriod: '29 Earth years',
    fact: 'Saturn is the least dense planet — it\'s so light it could float on water (if you had an ocean big enough)!',
    description: 'Famous for its spectacular rings made of ice and rock. Saturn has the most moons of any planet.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    emoji: '🔵',
    color: '#80DEEA',
    glowColor: '#80deea',
    size: 17,
    orbitRadius: 306,
    period: 60,
    moons: 28,
    diameter: '50,724 km (4× Earth)',
    distanceFromSun: '2.87 billion km',
    orbitalPeriod: '84 Earth years',
    fact: 'Uranus rotates on its side — its axis is tilted 98°, so it rolls around the Sun like a bowling ball!',
    description: 'An ice giant with a dramatic tilt. Its rings are vertical, and its seasons last 21 years each.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    emoji: '🌊',
    color: '#5C6BC0',
    glowColor: '#5c6bc0',
    size: 16,
    orbitRadius: 346,
    period: 80,
    moons: 16,
    diameter: '49,244 km (nearly 4× Earth)',
    distanceFromSun: '4.5 billion km',
    orbitalPeriod: '165 Earth years',
    fact: 'Winds on Neptune can reach 2,100 km/h — faster than the speed of sound on Earth. The wildest weather in the Solar System.',
    description: 'The farthest planet, discovered by maths before it was ever seen through a telescope.',
  },
]

interface Props {
  onAskDecifer?: (context: string) => void
  onExplore?: (topicKey: string) => void
}

export function SolarSystem({ onAskDecifer, onExplore }: Props) {
  const [selected, setSelected] = useState<Planet | null>(null)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const exploredRef = useRef<Set<string>>(new Set())

  // Scale the orrery to fit the viewport
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = containerRef.current.offsetHeight
      const available = Math.min(w, h)
      // orrery needs ~740px (Neptune orbit 346 * 2 + padding)
      const s = Math.min(1, available / 740)
      setScale(s)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const handleSelect = useCallback((planet: Planet) => {
    setSelected(planet)
    setPaused(true)
    // Only fire onExplore once per unique planet per session
    if (!exploredRef.current.has(planet.id)) {
      exploredRef.current.add(planet.id)
      onExplore?.(planet.id)
    }
  }, [onExplore])

  const handleClose = () => {
    setSelected(null)
    setPaused(false)
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none" style={{ background: 'radial-gradient(ellipse at 40% 40%, #0d1b3e 0%, #050510 60%, #000008 100%)' }}>
      {/* Stars */}
      <Stars />

      {/* Pause / play */}
      <button
        onClick={() => setPaused(p => !p)}
        className="absolute top-4 right-4 z-30 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/20 transition-colors backdrop-blur"
      >
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>

      {/* Orrery canvas */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Orbit rings */}
        {PLANETS.map((planet) => (
          <div
            key={`orbit-${planet.id}`}
            className="absolute rounded-full border border-white/8"
            style={{
              width: planet.orbitRadius * 2,
              height: planet.orbitRadius * 2,
              marginLeft: -planet.orbitRadius,
              marginTop: -planet.orbitRadius,
            }}
          />
        ))}

        {/* Sun */}
        <div className="absolute z-10" style={{ width: 52, height: 52, marginLeft: -26, marginTop: -26 }}>
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #fff9e6, #ffdd57 30%, #ff8c00 70%, #ff4500)',
              boxShadow: '0 0 40px 18px rgba(255,160,0,0.45), 0 0 80px 36px rgba(255,100,0,0.2)',
            }}
          />
        </div>

        {/* Planets */}
        {PLANETS.map((planet) => (
          <OrbitingPlanet
            key={planet.id}
            planet={planet}
            paused={paused}
            isSelected={selected?.id === planet.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Planet info panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl pb-24 pt-6 px-5 shadow-2xl"
            style={{ background: 'linear-gradient(160deg, #1a1a3e 0%, #0a0a20 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

            <div className="flex items-start gap-4 mb-4">
              {/* Planet visual */}
              <div
                className="relative flex-none rounded-full flex items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  background: `radial-gradient(circle at 35% 35%, ${selected.glowColor}88, ${selected.color} 60%, ${selected.color}88)`,
                  boxShadow: `0 0 24px 8px ${selected.glowColor}44`,
                }}
              >
                {selected.rings && (
                  <div className="absolute" style={{
                    width: 96,
                    height: 20,
                    borderRadius: '50%',
                    border: `3px solid ${selected.color}66`,
                    transform: 'rotateX(75deg)',
                  }} />
                )}
                <span className="text-2xl">{selected.emoji}</span>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-heading text-2xl font-extrabold text-white">{selected.name}</h2>
                <p className="text-sm text-white/60 leading-snug mt-0.5">{selected.description}</p>
              </div>

              <button
                onClick={handleClose}
                className="flex-none w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"
              >
                ✕
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Diameter', value: selected.diameter },
                { label: 'Distance from Sun', value: selected.distanceFromSun },
                { label: 'Year length', value: selected.orbitalPeriod },
                { label: 'Moons', value: selected.moons === 0 ? 'None' : selected.moons.toString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{stat.label}</p>
                  <p className="text-sm font-semibold text-white mt-0.5 leading-snug">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Fun fact */}
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#FFD43B' }}>✨ Wow fact</p>
              <p className="text-sm text-white/80 leading-snug">{selected.fact}</p>
            </div>

            {/* Ask Decifer CTA */}
            <button
              onClick={() => {
                onAskDecifer?.(`the planet ${selected.name}`)
                handleClose()
              }}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' }}
            >
              💬 Ask Decifer about {selected.name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap hint */}
      {!selected && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 inset-x-0 text-center text-xs text-white/30 pointer-events-none"
        >
          Tap any planet to explore it
        </motion.p>
      )}
    </div>
  )
}

// Stable initial angles per planet (deterministic, not random per render)
const INITIAL_ANGLES: Record<string, number> = {
  mercury: 45, venus: 120, earth: 200, mars: 310,
  jupiter: 70, saturn: 180, uranus: 250, neptune: 330,
}

function OrbitingPlanet({ planet, paused, isSelected, onSelect }: {
  planet: Planet
  paused: boolean
  isSelected: boolean
  onSelect: (p: Planet) => void
}) {
  const startAngle = INITIAL_ANGLES[planet.id] ?? 0
  const animationStyle = {
    animation: `orbit-${planet.id} ${planet.period}s linear infinite`,
    animationPlayState: paused ? 'paused' : 'running',
  }

  return (
    <>
      <style>{`
        @keyframes orbit-${planet.id} {
          from { transform: rotate(${startAngle}deg); }
          to   { transform: rotate(${startAngle + 360}deg); }
        }
      `}</style>
      {/* Orbit arm */}
      <div
        className="absolute"
        style={{
          width: planet.orbitRadius * 2,
          height: planet.orbitRadius * 2,
          marginLeft: -planet.orbitRadius,
          marginTop: -planet.orbitRadius,
          ...animationStyle,
        }}
      >
        {/* Planet positioned at top of orbit arm */}
        <motion.button
          onClick={() => onSelect(planet)}
          animate={isSelected ? { scale: [1, 1.3, 1], } : {}}
          transition={{ duration: 0.4 }}
          className="absolute rounded-full flex items-center justify-center cursor-pointer focus:outline-none"
          style={{
            width: planet.size * 2,
            height: planet.size * 2,
            top: 0,
            left: planet.orbitRadius - planet.size,
            background: `radial-gradient(circle at 35% 35%, ${planet.glowColor}cc, ${planet.color} 60%, ${planet.color}88)`,
            boxShadow: isSelected
              ? `0 0 20px 8px ${planet.glowColor}88`
              : `0 0 ${planet.size}px 3px ${planet.glowColor}44`,
          }}
        >
          {/* Saturn rings */}
          {planet.rings && (
            <div
              className="absolute pointer-events-none"
              style={{
                width: planet.size * 3.5,
                height: planet.size * 0.8,
                borderRadius: '50%',
                border: `2.5px solid ${planet.color}88`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotateX(70deg)',
              }}
            />
          )}
        </motion.button>
      </div>
    </>
  )
}

function Stars() {
  // Empty on server — populated after mount to avoid SSR/client hydration mismatch
  const [stars, setStars] = useState<{ x: number; y: number; r: number; o: number }[]>([])

  useEffect(() => {
    setStars(Array.from({ length: 180 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.5 + 0.3,
      o: Math.random() * 0.7 + 0.2,
    })))
  }, [])

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      {stars.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o} />
      ))}
    </svg>
  )
}
