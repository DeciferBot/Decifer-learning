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
  diameterKm: number // for scale bar
  distanceFromSun: string
  orbitalPeriod: string
  fact: string
  description: string
  rings?: boolean
  quizQuestion: string
  quizOptions: string[]
  quizAnswer: number // index into options
  quizExplanation: string
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
    diameter: '4,879 km',
    diameterKm: 4879,
    distanceFromSun: '57.9 million km',
    orbitalPeriod: '88 Earth days',
    fact: 'Despite being closest to the Sun, Venus is actually hotter! Mercury has almost no atmosphere to trap heat.',
    description: 'The smallest planet and fastest orbiter. One day on Mercury lasts longer than its entire year!',
    quizQuestion: 'Why is Mercury NOT the hottest planet, even though it\'s closest to the Sun?',
    quizOptions: ['It spins too fast', 'It has almost no atmosphere', 'It\'s made of rock', 'It orbits too quickly'],
    quizAnswer: 1,
    quizExplanation: 'Without an atmosphere to trap heat, temperatures swing wildly — from 430°C in sunlight to −180°C at night. Venus\'s thick atmosphere traps heat like a greenhouse, making it hotter overall.',
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
    diameter: '12,104 km',
    diameterKm: 12104,
    distanceFromSun: '108.2 million km',
    orbitalPeriod: '225 Earth days',
    fact: 'Venus spins backwards compared to most planets — so on Venus, the Sun rises in the west and sets in the east!',
    description: 'The hottest planet at 465°C, wrapped in thick clouds of sulphuric acid. Beautiful but deadly.',
    quizQuestion: 'On Venus, in which direction does the Sun rise?',
    quizOptions: ['The East (same as Earth)', 'The West', 'It doesn\'t rise — Venus is tidally locked', 'The North'],
    quizAnswer: 1,
    quizExplanation: 'Venus rotates backwards (retrograde) compared to most planets. So its Sun rises in the west and sets in the east — the opposite of Earth!',
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
    diameterKm: 12742,
    distanceFromSun: '149.6 million km (1 AU)',
    orbitalPeriod: '365.25 days',
    fact: 'Earth is the only planet not named after a god. It\'s also the densest planet in the Solar System.',
    description: 'Our home — the only known planet with liquid water on the surface and life as we know it.',
    quizQuestion: 'What makes Earth the only planet known to support life?',
    quizOptions: ['It has the most moons', 'Liquid water, oxygen atmosphere, and right temperature', 'It\'s closest to the Sun', 'It has the strongest gravity'],
    quizAnswer: 1,
    quizExplanation: 'Earth sits in the "Goldilocks zone" — not too hot, not too cold. It has liquid water, a protective atmosphere with oxygen, and a magnetic field shielding it from solar radiation.',
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
    diameter: '6,779 km',
    diameterKm: 6779,
    distanceFromSun: '227.9 million km',
    orbitalPeriod: '687 Earth days',
    fact: 'Mars has the tallest volcano in the Solar System — Olympus Mons is nearly 3× the height of Everest!',
    description: 'The Red Planet gets its colour from iron oxide (rust). It has the largest dust storms in the Solar System.',
    quizQuestion: 'What makes Mars appear red?',
    quizOptions: ['Volcanic lava on the surface', 'Iron oxide (rust) in the soil', 'Red sunlight reflection', 'Thick red clouds'],
    quizAnswer: 1,
    quizExplanation: 'Mars\'s soil is rich in iron oxide — basically rust! When sunlight hits the rusty dust, it gives Mars its famous red appearance.',
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
    diameter: '139,820 km',
    diameterKm: 139820,
    distanceFromSun: '778.5 million km',
    orbitalPeriod: '12 Earth years',
    fact: 'The Great Red Spot on Jupiter is a storm that has been raging for over 350 years — and it\'s larger than Earth!',
    description: 'The largest planet — so massive it could fit all other planets inside it twice over. A true giant.',
    quizQuestion: 'The Great Red Spot on Jupiter is…',
    quizOptions: ['A giant volcano', 'A storm larger than Earth lasting 350+ years', 'A red ocean', 'A crater from an asteroid'],
    quizAnswer: 1,
    quizExplanation: 'The Great Red Spot is an enormous anticyclonic storm in Jupiter\'s atmosphere. It has been observed for at least 350 years and is wide enough to swallow the entire Earth!',
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
    diameter: '116,460 km',
    diameterKm: 116460,
    distanceFromSun: '1.43 billion km',
    orbitalPeriod: '29 Earth years',
    fact: 'Saturn is the least dense planet — it\'s so light it could float on water (if you had an ocean big enough)!',
    description: 'Famous for its spectacular rings made of ice and rock. Saturn has the most moons of any planet.',
    quizQuestion: 'What are Saturn\'s rings made of?',
    quizOptions: ['Solid metal bands', 'Billions of ice and rock fragments', 'Frozen gas', 'Dust from asteroids only'],
    quizAnswer: 1,
    quizExplanation: 'Saturn\'s rings are made of billions of chunks of ice and rock, ranging from tiny grains to chunks as large as a house. Despite looking solid, they\'re mostly empty space!',
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
    diameter: '50,724 km',
    diameterKm: 50724,
    distanceFromSun: '2.87 billion km',
    orbitalPeriod: '84 Earth years',
    fact: 'Uranus rotates on its side — its axis is tilted 98°, so it rolls around the Sun like a bowling ball!',
    description: 'An ice giant with a dramatic tilt. Its rings are vertical, and its seasons last 21 years each.',
    quizQuestion: 'Uranus is unusual because…',
    quizOptions: ['It has no moons', 'It rotates on its side (axis tilted 98°)', 'It\'s the smallest planet', 'It orbits backwards'],
    quizAnswer: 1,
    quizExplanation: 'Uranus\'s axis is tilted nearly 98° — it essentially rolls around the Sun on its side! This likely happened when a massive object collided with it long ago. Each pole gets 42 years of continuous sunlight, then 42 years of darkness.',
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
    diameter: '49,244 km',
    diameterKm: 49244,
    distanceFromSun: '4.5 billion km',
    orbitalPeriod: '165 Earth years',
    fact: 'Winds on Neptune can reach 2,100 km/h — faster than the speed of sound on Earth. The wildest weather in the Solar System.',
    description: 'The farthest planet, discovered by maths before it was ever seen through a telescope.',
    quizQuestion: 'How was Neptune discovered before anyone saw it?',
    quizOptions: ['A powerful telescope found it', 'Mathematicians predicted its position from gravity calculations', 'A space probe flew past it', 'Ancient astronomers recorded it'],
    quizAnswer: 1,
    quizExplanation: 'Neptune was discovered in 1846 purely through mathematics! Scientists noticed Uranus wasn\'t orbiting exactly as expected, calculated that another planet\'s gravity must be pulling it, and pointed a telescope at exactly the right spot — finding Neptune immediately.',
  },
]

const EARTH_DIAMETER_KM = 12742

interface Props {
  onAskDecifer?: (context: string) => void
  onExplore?: (topicKey: string) => void
}

export function SolarSystem({ onAskDecifer, onExplore }: Props) {
  const [selected, setSelected] = useState<Planet | null>(null)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState<'facts' | 'quiz'>('facts')
  const [quizState, setQuizState] = useState<'idle' | 'answered'>('idle')
  const [chosenAnswer, setChosenAnswer] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const exploredRef = useRef<Set<string>>(new Set())

  // Scale the orrery to fit the viewport
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = containerRef.current.offsetHeight
      // Leave 48px breathing room on each side (96px total) so orbits don't clip
      const available = Math.min(w, h) - 96
      // orrery needs ~692px (Neptune orbit 346 * 2); 740 = natural size with planet bodies
      const s = Math.min(1, available / 740)
      setScale(s)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const handleSelect = useCallback((planet: Planet) => {
    setSelected(planet)
    setTab('facts')
    setQuizState('idle')
    setChosenAnswer(null)
    setPaused(true)
    if (!exploredRef.current.has(planet.id)) {
      exploredRef.current.add(planet.id)
      onExplore?.(planet.id)
    }
  }, [onExplore])

  const handleClose = () => {
    setSelected(null)
    setPaused(false)
    setQuizState('idle')
    setChosenAnswer(null)
  }

  const handleAnswer = (idx: number) => {
    if (quizState === 'answered') return
    setChosenAnswer(idx)
    setQuizState('answered')
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0d1b3e 0%, #050510 60%, #000008 100%)' }}>
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
        style={{ transform: `scale(${scale})`, transformOrigin: '50% 50%' }}
      >
        {/* Orbit rings — pointer-events-none so they don't block planet taps */}
        {PLANETS.map((planet) => (
          <div
            key={`orbit-${planet.id}`}
            className="absolute rounded-full border border-white/8 pointer-events-none"
            style={{
              width: planet.orbitRadius * 2,
              height: planet.orbitRadius * 2,
              marginLeft: -planet.orbitRadius,
              marginTop: -planet.orbitRadius,
            }}
          />
        ))}

        {/* Sun */}
        <div className="absolute z-10 pointer-events-none" style={{ width: 52, height: 52, marginLeft: -26, marginTop: -26 }}>
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
            className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl shadow-2xl"
            style={{ background: 'linear-gradient(160deg, #1a1a3e 0%, #0a0a20 100%)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '70vh', overflowY: 'auto' }}
          >
            <div className="px-5 pt-6 pb-8">
              {/* Drag handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
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

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['facts', 'quiz'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setQuizState('idle'); setChosenAnswer(null) }}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: tab === t ? `${selected.color}33` : 'rgba(255,255,255,0.06)',
                      color: tab === t ? selected.glowColor : 'rgba(255,255,255,0.5)',
                      border: tab === t ? `1px solid ${selected.color}44` : '1px solid transparent',
                    }}
                  >
                    {t === 'facts' ? '🔭 Explore' : '🧠 Quiz me'}
                  </button>
                ))}
              </div>

              {tab === 'facts' && (
                <>
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

                  {/* Size vs Earth bar */}
                  <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Size compared to Earth</p>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-none" style={{ background: '#4FC3F7' }} />
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (selected.diameterKm / 139820) * 100)}%`,
                            background: `linear-gradient(90deg, ${selected.color}, ${selected.glowColor})`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/50 flex-none w-14 text-right">
                        {selected.id === 'earth'
                          ? '1× Earth'
                          : selected.diameterKm < EARTH_DIAMETER_KM
                            ? `${(selected.diameterKm / EARTH_DIAMETER_KM).toFixed(2)}× Earth`
                            : `${Math.round(selected.diameterKm / EARTH_DIAMETER_KM)}× Earth`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-3 h-3 rounded-full flex-none" style={{ background: selected.color }} />
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (EARTH_DIAMETER_KM / 139820) * 100)}%`,
                            background: '#4FC3F7',
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/50 flex-none w-14 text-right">Earth</span>
                    </div>
                  </div>

                  {/* Fun fact */}
                  <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.2)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#FFD43B' }}>✨ Wow fact</p>
                    <p className="text-sm text-white/80 leading-snug">{selected.fact}</p>
                  </div>

                  {/* Ask Decifer */}
                  <button
                    onClick={() => { onAskDecifer?.(`the planet ${selected.name}`); handleClose() }}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' }}
                  >
                    💬 Ask Decifer about {selected.name}
                  </button>
                </>
              )}

              {tab === 'quiz' && (
                <QuizPanel
                  planet={selected}
                  quizState={quizState}
                  chosenAnswer={chosenAnswer}
                  onAnswer={handleAnswer}
                  onAskDecifer={() => { onAskDecifer?.(`the planet ${selected.name}`); handleClose() }}
                />
              )}
            </div>
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

function QuizPanel({
  planet,
  quizState,
  chosenAnswer,
  onAnswer,
  onAskDecifer,
}: {
  planet: Planet
  quizState: 'idle' | 'answered'
  chosenAnswer: number | null
  onAnswer: (idx: number) => void
  onAskDecifer: () => void
}) {
  const correct = planet.quizAnswer

  return (
    <div>
      <p className="text-sm font-semibold text-white/90 leading-snug mb-4">
        {planet.quizQuestion}
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {planet.quizOptions.map((opt, idx) => {
          let bg = 'rgba(255,255,255,0.06)'
          let border = '1px solid transparent'
          let textColor = 'rgba(255,255,255,0.75)'

          if (quizState === 'answered') {
            if (idx === correct) {
              bg = 'rgba(64, 192, 87, 0.18)'
              border = '1px solid rgba(64,192,87,0.5)'
              textColor = '#40C057'
            } else if (idx === chosenAnswer) {
              bg = 'rgba(255, 107, 107, 0.18)'
              border = '1px solid rgba(255,107,107,0.5)'
              textColor = '#FF6B6B'
            }
          }

          return (
            <button
              key={idx}
              onClick={() => onAnswer(idx)}
              disabled={quizState === 'answered'}
              className="w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition-all active:scale-98 disabled:cursor-default"
              style={{ background: bg, border, color: textColor }}
            >
              <span className="mr-2 text-white/30">{['A', 'B', 'C', 'D'][idx]}.</span>
              {opt}
              {quizState === 'answered' && idx === correct && ' ✓'}
              {quizState === 'answered' && idx === chosenAnswer && idx !== correct && ' ✗'}
            </button>
          )
        })}
      </div>

      {quizState === 'answered' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 mb-4"
          style={{
            background: chosenAnswer === correct ? 'rgba(64,192,87,0.1)' : 'rgba(255,107,107,0.1)',
            border: `1px solid ${chosenAnswer === correct ? 'rgba(64,192,87,0.3)' : 'rgba(255,107,107,0.3)'}`,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: chosenAnswer === correct ? '#40C057' : '#FF6B6B' }}>
            {chosenAnswer === correct ? '🎉 Correct!' : '💡 Not quite — here\'s why:'}
          </p>
          <p className="text-sm text-white/80 leading-snug">{planet.quizExplanation}</p>
        </motion.div>
      )}

      <button
        onClick={onAskDecifer}
        className="w-full rounded-2xl py-3 text-sm font-bold text-white transition-all active:scale-95"
        style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' }}
      >
        💬 Ask Decifer more about {planet.name}
      </button>
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

  // Hit area is at least 48×48px regardless of visual size
  const hitSize = Math.max(48, planet.size * 2 + 16)

  return (
    <>
      <style>{`
        @keyframes orbit-${planet.id} {
          from { transform: rotate(${startAngle}deg); }
          to   { transform: rotate(${startAngle + 360}deg); }
        }
      `}</style>
      {/* Orbit arm — rotates, planet rides at the top */}
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
        {/* Planet hit target (larger invisible area) + visual */}
        <button
          onClick={() => onSelect(planet)}
          className="absolute focus:outline-none"
          style={{
            width: hitSize,
            height: hitSize,
            top: -hitSize / 2,
            left: planet.orbitRadius - hitSize / 2,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={`Explore ${planet.name}`}
        >
          <motion.div
            animate={isSelected ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 0.4 }}
            className="rounded-full flex items-center justify-center"
            style={{
              width: planet.size * 2,
              height: planet.size * 2,
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
          </motion.div>
        </button>
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
