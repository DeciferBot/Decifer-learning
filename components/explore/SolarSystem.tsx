'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Ring } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import { WonderOverlay, WONDER_LABELS } from './WonderOverlay'
import type { WonderType } from './WonderOverlay'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type { ExplorerData, ExplorerNode } from '@/lib/explore/types'
import { ExplorableCanvas } from './engine/ExplorableCanvas'
import type { CameraApi } from './engine/CameraRig'
import { Starfield } from './engine/Starfield'
import { useBodies } from './engine/focusContext'
import { useReducedMotion } from './engine/useReducedMotion'
import { useMediaQuery } from './engine/useMediaQuery'
import { useExploreTexture } from './engine/useExploreTexture'

// ---------------------------------------------------------------------------
// Flattened planet shape consumed by the panels. Derived from a DB node so the
// content is data-driven (CLAUDE.md §16 r5 — no hardcoded content).
// ---------------------------------------------------------------------------

interface Planet {
  id: string
  name: string
  color: string
  glowColor: string
  radius: number
  orbitRadius: number
  period: number
  rings: boolean
  texture: string
  wonderType: WonderType
  diameter: string
  distanceFromSun: string
  orbitalPeriod: string
  moons: number
  description: string
  fact: string
  narration: string
  layers: { label: string; emoji: string; text: string; narration: string; whatIf: string }[]
  quizQuestion: string
  quizOptions: string[]
  quizAnswer: number
  quizExplanation: string
}

function toPlanet(n: ExplorerNode): Planet {
  return {
    id: n.key,
    name: n.name,
    color: n.visual.color,
    glowColor: n.visual.glowColor,
    radius: n.visual.radius,
    orbitRadius: n.visual.orbitRadius,
    period: n.visual.period,
    rings: n.visual.rings,
    texture: n.visual.texture,
    wonderType: n.visual.wonderType as WonderType,
    diameter: n.stats.diameter,
    distanceFromSun: n.stats.distanceFromSun,
    orbitalPeriod: n.stats.orbitalPeriod,
    moons: n.stats.moons,
    description: n.content.description,
    fact: n.content.fact,
    narration: n.content.narration,
    layers: n.content.layers,
    quizQuestion: n.quiz.question,
    quizOptions: n.quiz.options,
    quizAnswer: n.quiz.answer,
    quizExplanation: n.quiz.explanation,
  }
}

// ---------------------------------------------------------------------------
// Sun
// ---------------------------------------------------------------------------

function Sun({ texture, radius, light, reducedMotion }: {
  texture: string
  radius: number
  light: { intensity: number; distance: number; decay: number; color: string }
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const map = useExploreTexture(texture)

  useFrame(({ clock }) => {
    if (reducedMotion) return
    if (meshRef.current) meshRef.current.rotation.y = clock.getElapsedTime() * 0.05
    if (glowRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02
      glowRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial map={map} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.2, 32, 32]} />
        <meshBasicMaterial color="#ff9900" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.57, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
      <pointLight intensity={light.intensity} distance={light.distance} decay={light.decay} color={light.color} />
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

function SaturnRings({ planetRadius }: { planetRadius: number }) {
  const map = useExploreTexture('saturn-rings.png')
  return (
    <Ring args={[planetRadius * 1.2, planetRadius * 2.26, 128]}>
      <meshBasicMaterial map={map} side={THREE.DoubleSide} transparent opacity={0.9} />
    </Ring>
  )
}

// ---------------------------------------------------------------------------
// Orbiting planet — registers its live position so the camera can fly to it
// ---------------------------------------------------------------------------

interface OrbitingBodyProps {
  planet: Planet
  paused: boolean
  isSelected: boolean
  initialAngle: number
  onSelect: (planet: Planet) => void
}

function OrbitingBody({ planet, paused, isSelected, initialAngle, onSelect }: OrbitingBodyProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const angleRef = useRef(initialAngle)
  const map = useExploreTexture(planet.texture)

  const { register, unregister } = useBodies()
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) posRef.current = register(planet.id, planet.radius)
  useEffect(() => () => unregister(planet.id), [planet.id, unregister])

  // Place at the starting angle immediately so the first focus has a position.
  useEffect(() => {
    if (!groupRef.current) return
    groupRef.current.position.set(
      Math.cos(angleRef.current) * planet.orbitRadius,
      0,
      Math.sin(angleRef.current) * planet.orbitRadius,
    )
    posRef.current?.copy(groupRef.current.position)
  }, [planet.orbitRadius])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (!paused) angleRef.current += (delta / planet.period) * Math.PI * 2
    groupRef.current.position.x = Math.cos(angleRef.current) * planet.orbitRadius
    groupRef.current.position.z = Math.sin(angleRef.current) * planet.orbitRadius
    posRef.current?.copy(groupRef.current.position)
    if (meshRef.current && !paused) meshRef.current.rotation.y += delta * 0.3
  })

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(planet)
  }, [planet, onSelect])

  return (
    <group ref={groupRef}>
      <mesh scale={isSelected ? 1.5 : 1.2}>
        <sphereGeometry args={[planet.radius, 16, 16]} />
        <meshBasicMaterial color={planet.glowColor} transparent opacity={isSelected ? 0.3 : 0.08} side={THREE.BackSide} />
      </mesh>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[planet.radius, 32, 32]} />
        <meshStandardMaterial map={map} roughness={0.8} metalness={0.1} />
      </mesh>
      {planet.rings && (
        <group rotation={[Math.PI / 6, 0, 0]}>
          <SaturnRings planetRadius={planet.radius} />
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Quiz panel
// ---------------------------------------------------------------------------

function QuizPanel({ planet }: { planet: Planet }) {
  const [chosen, setChosen] = useState<number | null>(null)
  useEffect(() => { setChosen(null) }, [planet.id])

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
// Info panel — responsive: bottom sheet on phones, side rail on tablets
// ---------------------------------------------------------------------------

const LAYER_COLORS = [
  { bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.25)', text: '#ffd700', active: 'linear-gradient(135deg, #ffd700, #ffaa00)' },
  { bg: 'rgba(108,158,255,0.12)', border: 'rgba(108,158,255,0.25)', text: '#6C9EFF', active: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' },
  { bg: 'rgba(82,217,160,0.12)', border: 'rgba(82,217,160,0.25)', text: '#52D9A0', active: 'linear-gradient(135deg, #52D9A0, #00b4d8)' },
]

interface InfoPanelProps {
  planet: Planet
  wide: boolean
  onClose: () => void
  onAskDecifer?: (context: string) => void
  onOpenWonder?: (type: WonderType, name: string) => void
  muted: boolean
  onToggleMute: () => void
  onNarrated: () => void
}

const PANEL_BG = 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)'

function InfoPanel({ planet, wide, onClose, onAskDecifer, onOpenWonder, muted, onToggleMute, onNarrated }: InfoPanelProps) {
  const [tab, setTab] = useState<'discover' | 'quiz'>('discover')
  const [activeLayer, setActiveLayer] = useState(0)
  const [showNudge, setShowNudge] = useState(false)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTab('discover')
    setActiveLayer(0)
    setShowNudge(false)
  }, [planet.id])

  useEffect(() => {
    if (tab !== 'discover' || activeLayer !== 0) { setShowNudge(false); return }
    nudgeTimer.current = setTimeout(() => setShowNudge(true), 5000)
    return () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current) }
  }, [planet.id, tab, activeLayer])

  const handleLayerChange = (i: number) => {
    setActiveLayer(i)
    setShowNudge(false)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
  }

  const layer = planet.layers[Math.min(activeLayer, planet.layers.length - 1)]
  const lc = LAYER_COLORS[Math.min(activeLayer, LAYER_COLORS.length - 1)]

  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'

  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '58dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div
      key={planet.id}
      {...motionProps}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={className}
      style={style}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-3"
        style={{ background: PANEL_BG }}
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
            text={tab === 'discover' ? layer.narration : planet.narration}
            muted={muted}
            onToggleMute={onToggleMute}
            autoPlay
            onComplete={onNarrated}
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

      {/* Top-level tabs */}
      <div className="flex gap-2 px-5 mb-4">
        {(['discover', 'quiz'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 rounded-full text-xs font-semibold transition-all"
            style={{
              background: tab === t ? 'linear-gradient(135deg, #6C9EFF, #a78bfa)' : 'rgba(255,255,255,0.08)',
              color: 'white',
              minHeight: '48px',
            }}
          >
            {t === 'discover' ? '🔍 Discover' : '🧪 Quiz'}
          </button>
        ))}
      </div>

      <div className="px-5 pb-6 space-y-4">
        {tab === 'discover' ? (
          <>
            <div className="flex gap-2">
              {planet.layers.map((l, i) => (
                <button
                  key={l.label}
                  onClick={() => handleLayerChange(i)}
                  className="flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: activeLayer === i ? LAYER_COLORS[i].active : 'rgba(255,255,255,0.08)',
                    color: 'white',
                    minHeight: '48px',
                    border: activeLayer === i ? 'none' : `1px solid ${LAYER_COLORS[i].border}`,
                  }}
                >
                  <span>{l.emoji}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeLayer}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl p-4"
                style={{ background: lc.bg, border: `1px solid ${lc.border}` }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: lc.text }}>
                  {layer.emoji} {layer.label}
                </p>
                <p className="text-sm text-white/90 leading-relaxed">{layer.text}</p>
              </motion.div>
            </AnimatePresence>

            {activeLayer === 0 && planet.wonderType && (
              <button
                onClick={() => onOpenWonder?.(planet.wonderType, planet.name)}
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', minHeight: '48px' }}
              >
                {WONDER_LABELS[planet.wonderType]}
              </button>
            )}

            <AnimatePresence>
              {showNudge && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleLayerChange(1)}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95"
                  style={{ background: 'rgba(108,158,255,0.15)', border: '1px solid rgba(108,158,255,0.3)', minHeight: '48px' }}
                >
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>🔭</motion.span>
                  Go deeper — Explorer view
                </motion.button>
              )}
            </AnimatePresence>

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

            <button
              onClick={() => onAskDecifer?.(layer.whatIf)}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: '48px' }}
            >
              <span>💭</span> {layer.whatIf}
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
// Journey panel
// ---------------------------------------------------------------------------

interface JourneyPanelProps {
  planet: Planet
  step: number
  total: number
  wide: boolean
  muted: boolean
  onToggleMute: () => void
  onNext: () => void
  onStayHere: () => void
  onFinish: () => void
  onNarrated: () => void
}

function JourneyPanel({ planet, step, total, wide, muted, onToggleMute, onNext, onStayHere, onFinish, onNarrated }: JourneyPanelProps) {
  const isLast = step === total - 1
  const layer = planet.layers[0]

  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl'

  const style: React.CSSProperties = wide
    ? { background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '52dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div
      key={planet.id}
      {...motionProps}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={className}
      style={style}
    >
      <div className="flex justify-center gap-2 pt-3 pb-1">
        {Array.from({ length: total }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: i === step ? 1.4 : 1, opacity: i <= step ? 1 : 0.3 }}
            className="rounded-full"
            style={{ width: i === step ? 10 : 7, height: i === step ? 10 : 7, background: i === step ? planet.glowColor : '#ffffff' }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 px-5 pt-2 pb-1">
        <div className="h-10 w-10 rounded-full flex-none" style={{ background: `radial-gradient(circle at 35% 35%, ${planet.glowColor}, ${planet.color})` }} />
        <div className="flex-1">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">World {step + 1} of {total}</p>
          <h2 className="text-lg font-bold text-white leading-tight">{planet.name}</h2>
        </div>
        <NarrationButton text={layer.narration} muted={muted} onToggleMute={onToggleMute} autoPlay onComplete={onNarrated} />
      </div>

      <div className="mx-5 mt-1.5 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
        <p className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider mb-1">🌟 Wonder</p>
        <p className="text-xs text-white/90 leading-relaxed">{layer.text}</p>
      </div>

      <div className="flex gap-3 px-5 mt-3">
        <button
          onClick={onStayHere}
          className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px' }}
        >
          Stay here
        </button>
        <button
          onClick={isLast ? onFinish : onNext}
          className="flex-[2] rounded-2xl px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-95"
          style={{ background: isLast ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : 'linear-gradient(135deg, #6C9EFF, #a78bfa)', minHeight: '48px' }}
        >
          {isLast ? '🏆 Complete Journey' : <>Next world <span>→</span></>}
        </button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Journey complete overlay
// ---------------------------------------------------------------------------

function JourneyComplete({ title, body, points, onDismiss }: { title: string; body: string; points: number; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,8,0.85)' }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{ background: 'linear-gradient(160deg, #1a1a3e, #0d0d20)', border: '2px solid rgba(255,215,0,0.4)' }}
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          className="text-6xl mb-4"
        >🏆</motion.div>
        <h2 className="text-2xl font-extrabold text-white mb-2">{title}</h2>
        <p className="text-sm text-white/60 mb-2">{body}</p>
        <p className="text-sm font-bold text-yellow-300 mb-6">+{points} points earned</p>
        <button
          onClick={onDismiss}
          className="w-full rounded-2xl py-3 text-sm font-bold text-black active:scale-95"
          style={{ background: 'linear-gradient(135deg, #ffd700, #ffaa00)', minHeight: '48px' }}
        >
          Explore freely
        </button>
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface SolarSystemProps {
  explorer: ExplorerData
  onAskDecifer?: (context: string) => void
  onExplore?: (topicKey: string) => void
}

export function SolarSystem({ explorer, onAskDecifer, onExplore }: SolarSystemProps) {
  const planets = useMemo(() => explorer.nodes.map(toPlanet), [explorer.nodes])
  const initialAngles = useMemo(
    () => planets.map((_, i) => (i / planets.length) * Math.PI * 2),
    [planets],
  )
  const cfg = explorer.config

  const reducedMotion = useReducedMotion()
  const wide = useMediaQuery('(min-width: 768px)')

  const [selected, setSelected] = useState<Planet | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const [journeyStep, setJourneyStep] = useState<number | null>(null)
  const [journeyDone, setJourneyDone] = useState(false)
  const [wonder, setWonder] = useState<{ type: WonderType; planetName: string } | null>(null)
  const visitedRef = useRef<Set<string>>(new Set())
  const rewardedRef = useRef<Set<string>>(new Set())
  // The planet whose narration is currently showing (free-explore or journey).
  const activeKeyRef = useRef<string | null>(null)
  const cameraApi = useRef<CameraApi | null>(null)

  const journeyActive = journeyStep !== null
  const displaySelected = journeyActive ? planets[journeyStep] : selected
  const focusKey = displaySelected?.id ?? null
  // Orbits freeze when a panel is open, on manual pause, or when motion reduced.
  const motionPaused = paused || reducedMotion || focusKey !== null

  const pendingCardRef = useRef<DroppedCard | null>(null)

  // Fire exploration tracking once per planet on first visit.
  const markVisited = useCallback((id: string) => {
    if (visitedRef.current.has(id)) return
    visitedRef.current.add(id)
    onExplore?.(id)
  }, [onExplore])

  // Card drops only when the narration plays through and the child is still on
  // that planet — listening, not just tapping.
  const handleNarrated = useCallback(async (id: string) => {
    if (id !== activeKeyRef.current || rewardedRef.current.has(id)) return
    rewardedRef.current.add(id)
    try {
      const res = await fetch('/api/explore/card-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'solar-system', topicKey: id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.card) pendingCardRef.current = data.card
      }
    } catch {
      // card drop failure is non-fatal
    }
  }, [])

  const handleSelect = useCallback((planet: Planet | null) => {
    if (journeyActive) {
      if (planet) {
        stopNarration()
        setJourneyStep(null)
        setSelected(planet)
        activeKeyRef.current = planet.id
        markVisited(planet.id)
      }
      return
    }
    setSelected(planet)
    activeKeyRef.current = planet?.id ?? null
    if (planet) markVisited(planet.id)
  }, [journeyActive, markVisited])

  const handleClose = useCallback(() => {
    setSelected(null)
    setPaused(false)
    activeKeyRef.current = null
    stopNarration()
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleAskDecifer = useCallback((context: string) => {
    setSelected(null)
    setPaused(false)
    activeKeyRef.current = null
    stopNarration()
    onAskDecifer?.(context)
  }, [onAskDecifer])

  const startJourney = useCallback(() => {
    stopNarration()
    setSelected(null)
    setJourneyStep(0)
  }, [])

  const journeyNext = useCallback(() => {
    stopNarration()
    setJourneyStep(s => (s !== null && s < planets.length - 1 ? s + 1 : s))
  }, [planets.length])

  const journeyStayHere = useCallback(() => {
    stopNarration()
    setJourneyStep(prev => {
      const planet = prev !== null ? planets[prev] : null
      setSelected(planet)
      activeKeyRef.current = planet?.id ?? null
      return null
    })
  }, [planets])

  const journeyFinish = useCallback(async () => {
    stopNarration()
    activeKeyRef.current = null
    setJourneyStep(null)
    setTimeout(() => setJourneyDone(true), 350)
    try {
      await fetch('/api/explore/journey-complete', { method: 'POST' })
    } catch {
      // non-fatal
    }
  }, [])

  // Track the active journey planet so its narration can earn a card on completion.
  useEffect(() => {
    if (journeyStep === null) return
    const planet = planets[journeyStep]
    if (planet) {
      activeKeyRef.current = planet.id
      markVisited(planet.id)
    }
  }, [journeyStep, planets, markVisited])

  useEffect(() => () => {
    document.body.style.cursor = 'auto'
    stopNarration()
  }, [])

  const controlsVisible = !selected && !journeyActive

  return (
    <div className="fixed inset-0" style={{ background: cfg.background }}>
      {/* Pause / resume */}
      {controlsVisible && !reducedMotion && (
        <button
          onClick={() => setPaused(p => !p)}
          className="absolute top-4 right-4 z-30 rounded-full flex items-center justify-center text-sm text-white"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}

      {/* Zoom controls — accessibility fallback for pinch */}
      {controlsVisible && (
        <div className="absolute right-4 z-30 flex flex-col gap-2" style={{ top: reducedMotion ? '16px' : '72px' }}>
          <button
            onClick={() => cameraApi.current?.dolly(8)}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => cameraApi.current?.dolly(-8)}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      )}

      {/* 3D stage */}
      <ExplorableCanvas
        background={cfg.background}
        overview={cfg.camera.overview}
        fov={cfg.camera.fov}
        near={cfg.camera.near}
        far={cfg.camera.far}
        minDistance={cfg.camera.minDistance}
        maxDistance={cfg.camera.maxDistance}
        ambientLight={cfg.ambientLight}
        focusKey={focusKey}
        reducedMotion={reducedMotion}
        apiRef={cameraApi}
      >
        <Starfield count={cfg.starfield.count} radius={cfg.starfield.radius} depth={cfg.starfield.depth} reducedMotion={reducedMotion} />
        <Sun texture={cfg.sun.texture} radius={cfg.sun.radius} light={cfg.sun.light} reducedMotion={reducedMotion} />
        {planets.map((planet, i) => (
          <group key={planet.id}>
            <OrbitRing radius={planet.orbitRadius} />
            <OrbitingBody
              planet={planet}
              paused={motionPaused}
              isSelected={focusKey === planet.id}
              initialAngle={initialAngles[i]}
              onSelect={handleSelect}
            />
          </group>
        ))}
      </ExplorableCanvas>

      {/* Bottom hint + Take the Journey */}
      {controlsVisible && (
        <div className="absolute bottom-6 inset-x-0 z-20 flex flex-col items-center gap-3 px-4">
          <button
            onClick={startJourney}
            className="rounded-full px-6 text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', border: '1px solid rgba(108,158,255,0.4)', minHeight: '48px' }}
          >
            🚀 Take the Journey
          </button>
          <p className="text-[11px] text-white/30 text-center">Drag to look around · pinch to zoom · tap a planet</p>
        </div>
      )}

      {/* Free-explore info panel */}
      <AnimatePresence>
        {selected && !journeyActive && (
          <InfoPanel
            planet={selected}
            wide={wide}
            onClose={handleClose}
            onAskDecifer={handleAskDecifer}
            onOpenWonder={(type, name) => setWonder({ type, planetName: name })}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            onNarrated={() => handleNarrated(selected.id)}
          />
        )}
      </AnimatePresence>

      {/* Journey panel */}
      <AnimatePresence>
        {journeyActive && (
          <JourneyPanel
            planet={planets[journeyStep]}
            step={journeyStep}
            total={planets.length}
            wide={wide}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            onNext={journeyNext}
            onStayHere={journeyStayHere}
            onFinish={journeyFinish}
            onNarrated={() => handleNarrated(planets[journeyStep].id)}
          />
        )}
      </AnimatePresence>

      {/* Journey complete */}
      <AnimatePresence>
        {journeyDone && (
          <JourneyComplete
            title={cfg.completion.title}
            body={cfg.completion.body}
            points={cfg.completion.points}
            onDismiss={() => { setJourneyDone(false); setPaused(false) }}
          />
        )}
      </AnimatePresence>

      {/* Wonder overlay */}
      <AnimatePresence>
        {wonder && (
          <WonderOverlay type={wonder.type} planetName={wonder.planetName} onClose={() => setWonder(null)} />
        )}
      </AnimatePresence>

      {/* Card reveal */}
      {revealCard && (
        <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />
      )}
    </div>
  )
}
