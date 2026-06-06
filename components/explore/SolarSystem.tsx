'use client'

import { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Stars, Ring } from '@react-three/drei'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'

// ---------------------------------------------------------------------------
// Planet data
// ---------------------------------------------------------------------------

interface Planet {
  id: string
  name: string
  color: string
  glowColor: string
  radius: number          // Visual radius in Three.js units
  orbitRadius: number     // Distance from sun in Three.js units
  period: number          // Orbit period in seconds (visual, not real)
  moons: number
  diameter: string
  distanceFromSun: string
  orbitalPeriod: string
  fact: string
  description: string
  rings?: boolean
  texture: string         // filename in /textures/
  narration: string       // Attenborough-style spoken text
  quizQuestion: string
  quizOptions: string[]
  quizAnswer: number
  quizExplanation: string
}

const PLANETS: Planet[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: '#b5b5b5',
    glowColor: '#d0d0d0',
    radius: 0.38,
    orbitRadius: 7,
    period: 8,
    moons: 0,
    diameter: '4,879 km',
    distanceFromSun: '57.9 million km',
    orbitalPeriod: '88 Earth days',
    fact: 'Mercury has no atmosphere, so temperatures swing from −180°C at night to 430°C during the day.',
    description: 'The smallest planet and closest to the Sun. Despite being closest to the Sun, it\'s not the hottest planet — that\'s Venus.',
    texture: 'mercury.jpg',
    narration: 'Mercury. The smallest world, and the closest to our star. It has no atmosphere to protect it — so by day, it bakes at four hundred degrees. By night, it plunges to minus one hundred and eighty. A world of extremes, battered and ancient.',
    quizQuestion: 'How long is a year on Mercury?',
    quizOptions: ['88 Earth days', '365 Earth days', '12 Earth years', '24 hours'],
    quizAnswer: 0,
    quizExplanation: 'Mercury orbits the Sun so quickly that a year there is only 88 Earth days!',
  },
  {
    id: 'venus',
    name: 'Venus',
    color: '#e8cda0',
    glowColor: '#f0d070',
    radius: 0.95,
    orbitRadius: 11,
    period: 14,
    moons: 0,
    diameter: '12,104 km',
    distanceFromSun: '108.2 million km',
    orbitalPeriod: '225 Earth days',
    fact: 'Venus spins backwards and so slowly that one Venus day is longer than a Venus year!',
    description: 'The hottest planet in our Solar System at 465°C, thanks to a thick atmosphere that traps heat.',
    texture: 'venus.jpg',
    narration: 'Venus. Shrouded in thick clouds of sulphuric acid, its surface reaches four hundred and sixty-five degrees — hot enough to melt lead. Strangely, a day on Venus lasts longer than its entire year. It is, in every sense, a world turned upside down.',
    quizQuestion: 'Why is Venus the hottest planet?',
    quizOptions: ['It\'s closest to the Sun', 'Its thick atmosphere traps heat', 'It has active volcanoes', 'It spins very fast'],
    quizAnswer: 1,
    quizExplanation: 'Venus has a dense atmosphere of carbon dioxide that creates an extreme greenhouse effect, making it hotter than Mercury.',
  },
  {
    id: 'earth',
    name: 'Earth',
    color: '#4fa3e0',
    glowColor: '#70c8ff',
    radius: 1,
    orbitRadius: 16,
    period: 20,
    moons: 1,
    diameter: '12,742 km',
    distanceFromSun: '149.6 million km',
    orbitalPeriod: '365.25 Earth days',
    fact: 'Earth is the only planet known to support life — and the only one with liquid water on its surface.',
    description: 'Our home. Earth\'s magnetic field, liquid water, and just-right distance from the Sun make life possible.',
    texture: 'earth.jpg',
    narration: 'Earth. Our home. The only world we know of, in all the vast cosmos, where life has taken hold. Its oceans, its atmosphere, its magnetic shield — each one a miracle of circumstance. From space, it glows like a pale blue jewel in the darkness.',
    quizQuestion: 'What makes Earth unique in our Solar System?',
    quizOptions: ['It\'s the largest planet', 'It has the most moons', 'It has liquid water and supports life', 'It\'s closest to the Sun'],
    quizAnswer: 2,
    quizExplanation: 'Earth is the only planet known to have liquid water on its surface and to support life — as far as we know!',
  },
  {
    id: 'mars',
    name: 'Mars',
    color: '#c1440e',
    glowColor: '#e05020',
    radius: 0.53,
    orbitRadius: 22,
    period: 30,
    moons: 2,
    diameter: '6,779 km',
    distanceFromSun: '227.9 million km',
    orbitalPeriod: '687 Earth days',
    fact: 'Mars has the tallest volcano in the Solar System — Olympus Mons — three times the height of Mount Everest.',
    description: 'The Red Planet. Mars has seasons, polar ice caps, and the largest dust storms in the Solar System.',
    texture: 'mars.jpg',
    narration: 'Mars. The red planet. Named for the god of war, yet it is a world of eerie stillness — its surface scarred by the tallest volcano in the solar system, and swept by dust storms that can swallow an entire continent for months at a time.',
    quizQuestion: 'What is the tallest volcano in the Solar System?',
    quizOptions: ['Mount Everest', 'Olympus Mons', 'Mauna Kea', 'Maxwell Montes'],
    quizAnswer: 1,
    quizExplanation: 'Olympus Mons on Mars stands about 21 km high — three times taller than Mount Everest!',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: '#c88b3a',
    glowColor: '#e0a050',
    radius: 2.8,
    orbitRadius: 34,
    period: 50,
    moons: 95,
    diameter: '139,820 km',
    distanceFromSun: '778.5 million km',
    orbitalPeriod: '11.9 Earth years',
    fact: 'Jupiter is so massive that 1,300 Earths could fit inside it. Its Great Red Spot is a storm twice the size of Earth.',
    description: 'The king of planets. A gas giant with the famous Great Red Spot — a storm that has raged for over 350 years.',
    texture: 'jupiter.jpg',
    narration: 'Jupiter. The king of planets. So vast that thirteen hundred Earths could fit inside it. That great red swirl you see is a storm — a single storm — that has raged without pause for over three hundred and fifty years. Longer than any nation has existed.',
    quizQuestion: 'How many Earths could fit inside Jupiter?',
    quizOptions: ['About 10', 'About 100', 'About 1,300', 'About 10,000'],
    quizAnswer: 2,
    quizExplanation: 'Jupiter is so enormous that approximately 1,300 Earths could fit inside it!',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: '#e4d191',
    glowColor: '#f0e0a0',
    radius: 2.3,
    orbitRadius: 46,
    period: 65,
    moons: 146,
    diameter: '116,460 km',
    distanceFromSun: '1.4 billion km',
    orbitalPeriod: '29.5 Earth years',
    fact: 'Saturn\'s rings stretch 282,000 km but are only about 100m thick — thinner relative to their width than a piece of paper.',
    description: 'The jewel of the Solar System. Saturn\'s beautiful rings are made of billions of chunks of ice and rock.',
    texture: 'saturn.jpg',
    rings: true,
    narration: 'Saturn. The jewel of the solar system. Those rings — stretching nearly three hundred thousand kilometres — are made not of solid material, but of billions of pieces of ice and rock, each one orbiting silently in the cold dark. Some are the size of a house. Some smaller than a grain of sand.',
    quizQuestion: 'What are Saturn\'s rings mainly made of?',
    quizOptions: ['Gas and dust', 'Ice and rock', 'Iron and nickel', 'Water and clouds'],
    quizAnswer: 1,
    quizExplanation: 'Saturn\'s rings are made of billions of pieces of ice and rock, ranging from tiny grains to chunks as large as a house.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: '#7de8e8',
    glowColor: '#a0f0f0',
    radius: 1.6,
    orbitRadius: 58,
    period: 75,
    moons: 28,
    diameter: '50,724 km',
    distanceFromSun: '2.9 billion km',
    orbitalPeriod: '84 Earth years',
    fact: 'Uranus rotates on its side — tilted at 98°. It\'s like a planet that\'s been knocked over and rolls around the Sun.',
    description: 'The sideways planet. Uranus rotates on its side, possibly due to a collision with an Earth-sized object long ago.',
    texture: 'uranus.jpg',
    narration: 'Uranus. The sideways planet. Long ago, something enormous struck it — and knocked it clean onto its side. It has orbited the Sun tilted ever since, like a rolling ball, its poles experiencing decades of unbroken daylight followed by decades of total darkness.',
    quizQuestion: 'What is unusual about the way Uranus rotates?',
    quizOptions: ['It doesn\'t rotate', 'It rotates on its side (98° tilt)', 'It rotates backwards', 'It rotates extremely fast'],
    quizAnswer: 1,
    quizExplanation: 'Uranus is tilted 98° on its axis, so it essentially rolls around the Sun on its side — making its seasons very extreme.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: '#4b70dd',
    glowColor: '#6090ff',
    radius: 1.5,
    orbitRadius: 70,
    period: 85,
    moons: 16,
    diameter: '49,244 km',
    distanceFromSun: '4.5 billion km',
    orbitalPeriod: '165 Earth years',
    fact: 'Neptune has the strongest winds in the Solar System — reaching 2,100 km/h, faster than the speed of sound on Earth.',
    description: 'The farthest planet. Neptune is so remote that it takes light from the Sun over 4 hours to reach it.',
    texture: 'neptune.jpg',
    narration: 'Neptune. The farthest world. So distant that light from the Sun takes over four hours to reach it. Here, winds howl at two thousand kilometres an hour — the fastest in the solar system. It is a place of perpetual storm, and perpetual darkness.',
    quizQuestion: 'What is Neptune known for?',
    quizOptions: ['Being the hottest planet', 'Having the strongest winds in the Solar System', 'Being closest to Earth', 'Having no moons'],
    quizAnswer: 1,
    quizExplanation: 'Neptune has the most violent weather of any planet — winds can reach 2,100 km/h!',
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SolarSystemProps {
  onAskDecifer?: (context: string) => void
  onExplore?: (topicKey: string) => void
}

// ---------------------------------------------------------------------------
// Sun
// ---------------------------------------------------------------------------

function Sun() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const texture = useLoader(TextureLoader, '/textures/sun.jpg')

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.getElapsedTime() * 0.05
    if (glowRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02
      glowRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial color="#ff9900" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5.5, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
      <pointLight intensity={2} distance={200} decay={1} color="#fff5e0" />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Orbit ring
// ---------------------------------------------------------------------------

function OrbitRing({ radius }: { radius: number }) {
  const lineObj = useRef<THREE.Line | null>(null)
  if (!lineObj.current) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06 })
    lineObj.current = new THREE.Line(geo, mat)
  }
  // Dispose geometry + material when component unmounts
  useEffect(() => {
    const obj = lineObj.current
    return () => {
      obj?.geometry.dispose()
      ;(obj?.material as THREE.Material | undefined)?.dispose()
    }
  }, [])
  return <primitive object={lineObj.current} />
}

// ---------------------------------------------------------------------------
// Saturn rings
// ---------------------------------------------------------------------------

function SaturnRings() {
  const texture = useLoader(TextureLoader, '/textures/saturn-rings.png')
  return (
    <Ring args={[2.8, 5.2, 128]}>
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent opacity={0.9} />
    </Ring>
  )
}

// ---------------------------------------------------------------------------
// Planet mesh
// ---------------------------------------------------------------------------

interface PlanetMeshProps {
  planet: Planet
  paused: boolean
  isSelected: boolean
  onSelect: (planet: Planet) => void
  onFirstVisit: (id: string) => void
  visitedRef: React.MutableRefObject<Set<string>>
  initialAngle: number
}

function PlanetMesh({ planet, paused, isSelected, onSelect, onFirstVisit, visitedRef, initialAngle }: PlanetMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const angleRef = useRef(initialAngle)
  const texture = useLoader(TextureLoader, `/textures/${planet.texture}`)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (!paused) angleRef.current += (delta / planet.period) * Math.PI * 2
    groupRef.current.position.x = Math.cos(angleRef.current) * planet.orbitRadius
    groupRef.current.position.z = Math.sin(angleRef.current) * planet.orbitRadius
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.3
  })

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(planet)
    if (!visitedRef.current.has(planet.id)) {
      visitedRef.current.add(planet.id)
      onFirstVisit(planet.id)
    }
  }, [planet, onSelect, onFirstVisit, visitedRef])

  return (
    <group ref={groupRef}>
      {/* Glow */}
      <mesh scale={isSelected ? 1.5 : 1.2}>
        <sphereGeometry args={[planet.radius, 16, 16]} />
        <meshBasicMaterial color={planet.glowColor} transparent opacity={isSelected ? 0.3 : 0.08} side={THREE.BackSide} />
      </mesh>
      {/* Body */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[planet.radius, 32, 32]} />
        <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Saturn rings */}
      {planet.rings && (
        <group rotation={[Math.PI / 6, 0, 0]}>
          <SaturnRings />
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Stable initial angles — computed once, never random per render
// ---------------------------------------------------------------------------
const INITIAL_ANGLES = PLANETS.map((_, i) => (i / PLANETS.length) * Math.PI * 2)

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

interface SceneProps {
  paused: boolean
  selected: Planet | null
  onSelect: (planet: Planet | null) => void
  onFirstVisit: (id: string) => void
  visitedRef: React.MutableRefObject<Set<string>>
}

function Scene({ paused, selected, onSelect, onFirstVisit, visitedRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <Stars radius={150} depth={60} count={3000} factor={4} saturation={0.3} fade speed={0.5} />
      <Sun />
      {PLANETS.map((planet, i) => (
        <group key={planet.id}>
          <OrbitRing radius={planet.orbitRadius} />
          <PlanetMesh
            planet={planet}
            paused={paused}
            isSelected={selected?.id === planet.id}
            onSelect={onSelect}
            onFirstVisit={onFirstVisit}
            visitedRef={visitedRef}
            initialAngle={INITIAL_ANGLES[i]}
          />
        </group>
      ))}
      {/* Invisible backdrop to deselect on background click */}
      <mesh onClick={() => onSelect(null)} visible={false}>
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// Camera controller
// ---------------------------------------------------------------------------

function CameraController({ selected }: { selected: Planet | null }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(0, 30, 80))
  const currentPos = useRef(new THREE.Vector3(0, 30, 80))

  useFrame((_, delta) => {
    if (selected) {
      targetPos.current.set(
        selected.orbitRadius * 0.5,
        selected.orbitRadius * 0.35,
        selected.orbitRadius * 1.1,
      )
    } else {
      targetPos.current.set(0, 30, 80)
    }
    currentPos.current.lerp(targetPos.current, delta * 1.5)
    camera.position.copy(currentPos.current)
    camera.lookAt(0, 0, 0)
  })

  return null
}

// ---------------------------------------------------------------------------
// Quiz panel
// ---------------------------------------------------------------------------

function QuizPanel({ planet }: { planet: Planet }) {
  const [chosen, setChosen] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white/90">{planet.quizQuestion}</p>
      <div className="space-y-2">
        {planet.quizOptions.map((opt, i) => {
          const answered = chosen !== null
          const isCorrect = i === planet.quizAnswer
          const isChosen = i === chosen
          let bg = 'rgba(255,255,255,0.08)'
          if (answered && isCorrect) bg = 'rgba(64,192,87,0.3)'
          else if (answered && isChosen && !isCorrect) bg = 'rgba(255,107,107,0.3)'
          return (
            <button
              key={i}
              onClick={() => !answered && setChosen(i)}
              className="block w-full text-left rounded-xl px-3 py-2 text-sm text-white transition-all"
              style={{
                background: bg,
                border: answered && isCorrect ? '1px solid rgba(64,192,87,0.5)' : '1px solid transparent',
                minHeight: '48px',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {chosen !== null && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-white/70 leading-relaxed"
        >
          {chosen === planet.quizAnswer ? '✅ ' : '❌ '}{planet.quizExplanation}
        </motion.p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info panel
// ---------------------------------------------------------------------------

interface InfoPanelProps {
  planet: Planet
  onClose: () => void
  onAskDecifer?: (context: string) => void
  muted: boolean
  onToggleMute: () => void
}

function InfoPanel({ planet, onClose, onAskDecifer, muted, onToggleMute }: InfoPanelProps) {
  const [tab, setTab] = useState<'facts' | 'quiz'>('facts')

  // Reset tab when planet changes
  useEffect(() => { setTab('facts') }, [planet.id])

  return (
    <motion.div
      key={planet.id}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto"
      style={{
        maxHeight: '68vh',
        background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-3"
        style={{ background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex-none"
            style={{ background: `radial-gradient(circle at 35% 35%, ${planet.glowColor}, ${planet.color})` }}
          />
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{planet.name}</h2>
            <p className="text-xs text-white/40">{planet.moons} moon{planet.moons !== 1 ? 's' : ''} · {planet.diameter}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NarrationButton
            text={planet.narration}
            muted={muted}
            onToggleMute={onToggleMute}
            autoPlay
          />
          <button
            onClick={onClose}
            className="flex-none rounded-full flex items-center justify-center text-white/50"
            style={{ background: 'rgba(255,255,255,0.1)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 mb-4">
        {(['facts', 'quiz'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
            style={{
              background: tab === t ? 'linear-gradient(135deg, #6C9EFF, #a78bfa)' : 'rgba(255,255,255,0.08)',
              color: 'white',
              minHeight: '48px',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="px-5 pb-6 space-y-4">
        {tab === 'facts' ? (
          <>
            <p className="text-sm text-white/80 leading-relaxed">{planet.description}</p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Distance from Sun', value: planet.distanceFromSun },
                { label: 'Year length', value: planet.orbitalPeriod },
                { label: 'Diameter', value: planet.diameter },
                { label: 'Moons', value: String(planet.moons) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(108,158,255,0.12)', border: '1px solid rgba(108,158,255,0.2)' }}
            >
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1.5">✨ Amazing Fact</p>
              <p className="text-sm text-white/90 leading-relaxed">{planet.fact}</p>
            </div>

            <button
              onClick={() => onAskDecifer?.(`the planet ${planet.name}`)}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: '48px' }}
            >
              <span>🔭</span> Ask Decifer about {planet.name}
            </button>
          </>
        ) : (
          <QuizPanel planet={planet} />
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SolarSystem({ onAskDecifer, onExplore }: SolarSystemProps) {
  const [selected, setSelected] = useState<Planet | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const visitedRef = useRef<Set<string>>(new Set())

  const handleSelect = useCallback((planet: Planet | null) => {
    setSelected(planet)
    setPaused(planet !== null)
  }, [])

  const handleClose = useCallback(() => {
    setSelected(null)
    setPaused(false)
    stopNarration()
  }, [])

  const handleFirstVisit = useCallback((id: string) => {
    onExplore?.(id)
  }, [onExplore])

  const handleAskDecifer = useCallback((context: string) => {
    setSelected(null)
    setPaused(false)
    stopNarration()
    onAskDecifer?.(context)
  }, [onAskDecifer])

  // Stop narration on unmount
  useEffect(() => () => {
    document.body.style.cursor = 'auto'
    stopNarration()
  }, [])

  return (
    <div className="fixed inset-0" style={{ background: '#000008' }}>
      {/* Pause / resume */}
      <button
        onClick={() => setPaused(p => !p)}
        className="absolute top-4 right-4 z-30 rounded-full flex items-center justify-center text-sm text-white"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
        aria-label={paused ? 'Resume' : 'Pause'}
      >
        {paused ? '▶' : '⏸'}
      </button>

      {/* 3D canvas */}
      <Canvas
        camera={{ position: [0, 30, 80], fov: 55, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene
            paused={paused}
            selected={selected}
            onSelect={handleSelect}
            onFirstVisit={handleFirstVisit}
            visitedRef={visitedRef}
          />
          <CameraController selected={selected} />
        </Suspense>
      </Canvas>

      {/* Hint */}
      <div className="absolute bottom-32 inset-x-0 z-10 pointer-events-none text-center">
        <p className="text-[11px] text-white/20">Tap any planet to explore</p>
      </div>

      {/* Info panel + backdrop */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={handleClose}
            />
            <InfoPanel
              planet={selected}
              onClose={handleClose}
              onAskDecifer={handleAskDecifer}
              muted={muted}
              onToggleMute={() => setMuted(m => !m)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
