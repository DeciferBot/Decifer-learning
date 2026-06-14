'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type {
  AtlasExplorer, AtlasNode, AtlasContinent, AtlasWonderType, AtlasLayer,
} from '@/lib/explore/types'
import { ExplorableCanvas } from './engine/ExplorableCanvas'
import type { CameraApi } from './engine/CameraRig'
import { Starfield } from './engine/Starfield'
import { useBodies } from './engine/focusContext'
import { useReducedMotion } from './engine/useReducedMotion'
import { useMediaQuery } from './engine/useMediaQuery'
import { useExploreTexture } from './engine/useExploreTexture'

// ─── Continent metadata ──────────────────────────────────────────────────────

const CONTINENTS: Record<AtlasContinent, { name: string; emoji: string; color: string; lat: number; lng: number }> = {
  europe:          { name: 'Europe',     emoji: '🏰', color: '#6C9EFF', lat: 54,  lng: 15   },
  asia:            { name: 'Asia',       emoji: '🏯', color: '#A78BFA', lat: 34,  lng: 100  },
  africa:          { name: 'Africa',     emoji: '🌍', color: '#FBBF24', lat: 5,   lng: 22   },
  'north-america': { name: 'N. America', emoji: '🗽', color: '#F87171', lat: 45,  lng: -100 },
  'south-america': { name: 'S. America', emoji: '🌿', color: '#34D399', lat: -15, lng: -60  },
  oceania:         { name: 'Oceania',    emoji: '🦘', color: '#FB923C', lat: -27, lng: 133  },
}

const JOURNEY_CONTINENTS: AtlasContinent[] = ['europe', 'africa', 'asia', 'north-america', 'south-america', 'oceania']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function latLngTo3D(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// Flattened country consumed by the panels. Derived from a DB node.
interface Country {
  key: string
  name: string
  continent: AtlasContinent
  lat: number
  lng: number
  color: string
  capital: string
  population: string
  area: string
  flag: string
  narration: string
  layers: AtlasLayer[]
  wonderType: AtlasWonderType
  whatIf: string
}

function toCountry(n: AtlasNode): Country {
  return {
    key: n.key,
    name: n.name,
    continent: n.visual.continent,
    lat: n.visual.lat,
    lng: n.visual.lng,
    color: n.visual.color,
    capital: n.stats.capital,
    population: n.stats.population,
    area: n.stats.area,
    flag: n.stats.flag,
    narration: n.content.narration,
    layers: n.content.layers,
    wonderType: n.visual.wonderType,
    whatIf: n.visual.whatIf,
  }
}

// ─── 3D scene ─────────────────────────────────────────────────────────────────

function Globe({ texture, radius }: { texture: string; radius: number }) {
  const map = useExploreTexture(texture)
  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial map={map} roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.032, 32, 32]} />
        <meshStandardMaterial color="#4FC3F7" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// Invisible anchor so the camera can fly to a continent centroid.
function FocusAnchor({ id, lat, lng, markerRadius }: { id: string; lat: number; lng: number; markerRadius: number }) {
  const { register, unregister } = useBodies()
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    posRef.current = register(id, 1)
    posRef.current.copy(latLngTo3D(lat, lng, markerRadius))
  }
  useEffect(() => () => unregister(id), [id, unregister])
  return null
}

function CountryHotspot({ country, markerRadius, isSelected, reducedMotion, onSelect }: {
  country: Country
  markerRadius: number
  isSelected: boolean
  reducedMotion: boolean
  onSelect: (c: Country) => void
}) {
  const { register, unregister } = useBodies()
  const pos = useMemo(() => latLngTo3D(country.lat, country.lng, markerRadius), [country.lat, country.lng, markerRadius])
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    posRef.current = register(country.key, 1)
    posRef.current.copy(pos)
  }
  useEffect(() => {
    posRef.current?.copy(pos)
    return () => unregister(country.key)
  }, [country.key, pos, unregister])

  const glowRef = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  useFrame((_, delta) => {
    if (reducedMotion || !glowRef.current) return
    t.current += delta * 1.5
    glowRef.current.scale.setScalar(isSelected ? 1.5 + Math.sin(t.current) * 0.3 : 1)
  })

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[isSelected ? 0.07 : 0.055, 16, 16]} />
        <meshBasicMaterial color={country.color} transparent opacity={isSelected ? 0.5 : 0.3} />
      </mesh>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(country) }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[isSelected ? 0.06 : 0.042, 12, 12]} />
        <meshBasicMaterial color={isSelected ? '#FFFFFF' : country.color} />
      </mesh>
    </group>
  )
}

// ─── Wonder visualisations (presentation, not curriculum content) ─────────────

const WONDER_CONTENT: Record<AtlasWonderType, { title: string; description: string; render: () => React.ReactNode }> = {
  population: {
    title: 'World Population Scale',
    description: 'How the world\'s 8 billion people are distributed',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { label: 'Asia', pct: 60, color: '#A78BFA' },
          { label: 'Africa', pct: 18, color: '#FBBF24' },
          { label: 'Europe', pct: 9, color: '#6C9EFF' },
          { label: 'Americas', pct: 13, color: '#F87171' },
        ].map((r, i) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-16 text-right">{r.label}</span>
            <motion.div
              className="h-6 rounded-full flex items-center pl-2"
              style={{ background: r.color }}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct * 2.5}px` }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="text-[10px] font-bold text-black/80">{r.pct}%</span>
            </motion.div>
          </div>
        ))}
        <p className="text-xs text-white/40 mt-3 text-center">Total: 8 billion people</p>
      </div>
    ),
  },
  size: {
    title: 'Country Size Comparison',
    description: 'How countries compare in area to the UK (243,000 km²)',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { label: 'Russia', mult: 70.4, color: '#FCA5A5' },
          { label: 'Australia', mult: 31.9, color: '#FB923C' },
          { label: 'USA', mult: 40.5, color: '#F87171' },
          { label: 'Brazil', mult: 35.1, color: '#34D399' },
          { label: 'UK', mult: 1, color: '#6C9EFF' },
        ].map((r, i) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-16 text-right">{r.label}</span>
            <motion.div
              className="h-5 rounded-sm flex items-center pl-2"
              style={{ background: r.color, maxWidth: '180px' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(r.mult * 2.5, 180)}px` }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="text-[9px] font-bold text-black/80">{r.mult}×</span>
            </motion.div>
          </div>
        ))}
      </div>
    ),
  },
  climate: {
    title: 'Climate Zones',
    description: 'The 5 main climate zones of Earth',
    render: () => (
      <div className="grid grid-cols-1 gap-2 mt-4">
        {[
          { name: 'Tropical', emoji: '🌴', desc: 'Hot & wet year-round. 40% of Earth\'s species live here.', color: '#059669' },
          { name: 'Arid', emoji: '🏜️', desc: 'Hot & dry. Covers 30% of land — the Sahara, Arabian, Gobi.', color: '#D97706' },
          { name: 'Temperate', emoji: '🌿', desc: 'Mild seasons. Where most of Europe and China sit.', color: '#2563EB' },
          { name: 'Continental', emoji: '❄️', desc: 'Extreme seasons. Canada, Russia, Scandinavia.', color: '#7C3AED' },
          { name: 'Polar', emoji: '🧊', desc: 'Frozen year-round. Barely 0.1% of humans live here.', color: '#94A3B8' },
        ].map((z, i) => (
          <motion.div
            key={z.name}
            className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: z.color + '22', border: `1px solid ${z.color}44` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-xl">{z.emoji}</span>
            <div>
              <p className="text-sm font-bold text-white">{z.name}</p>
              <p className="text-xs text-white/60">{z.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  trade: {
    title: 'Global Trade Network',
    description: 'The world\'s biggest trading relationships',
    render: () => (
      <div className="space-y-3 mt-4">
        <p className="text-xs text-white/50">World trade is $32 trillion per year. Top trading pairs:</p>
        {[
          { pair: 'USA ↔ China', value: '$690bn', color: '#F87171' },
          { pair: 'Germany ↔ France', value: '$180bn', color: '#6C9EFF' },
          { pair: 'USA ↔ Mexico', value: '$800bn', color: '#34D399' },
          { pair: 'China ↔ Japan', value: '$330bn', color: '#A78BFA' },
          { pair: 'UK ↔ EU', value: '$850bn', color: '#FBBF24' },
        ].map((t, i) => (
          <motion.div
            key={t.pair}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-sm text-white/80">{t.pair}</span>
            <span className="text-sm font-bold" style={{ color: t.color }}>{t.value}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  language: {
    title: 'World\'s Languages',
    description: 'Over 7,000 languages — half may disappear this century',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { family: 'Indo-European', speakers: '3.2bn', examples: 'English, Hindi, Spanish, Russian', color: '#6C9EFF' },
          { family: 'Sino-Tibetan', speakers: '1.4bn', examples: 'Mandarin, Cantonese, Tibetan', color: '#F87171' },
          { family: 'Afro-Asiatic', speakers: '500m', examples: 'Arabic, Amharic, Hebrew', color: '#FBBF24' },
          { family: 'Dravidian', speakers: '220m', examples: 'Tamil, Telugu, Kannada', color: '#34D399' },
          { family: 'All others', speakers: '2.7bn', examples: '6,900+ languages', color: '#A78BFA' },
        ].map((l, i) => (
          <motion.div
            key={l.family}
            className="rounded-lg p-2.5"
            style={{ background: l.color + '18', border: `1px solid ${l.color}30` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-white">{l.family}</span>
              <span className="text-xs font-bold" style={{ color: l.color }}>{l.speakers}</span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">{l.examples}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
  extremes: {
    title: 'Earth\'s Extremes',
    description: 'The most remarkable records on our planet',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { record: 'Hottest place', value: '56.7°C', where: 'Death Valley, USA', emoji: '🌡️' },
          { record: 'Coldest place', value: '−89.2°C', where: 'Antarctica', emoji: '🥶' },
          { record: 'Wettest place', value: '11,862mm/yr', where: 'Mawsynram, India', emoji: '🌧️' },
          { record: 'Driest place', value: '0mm/yr', where: 'Atacama, Chile', emoji: '🏜️' },
          { record: 'Highest point', value: '8,849m', where: 'Everest, Nepal', emoji: '⛰️' },
          { record: 'Deepest ocean', value: '10,935m', where: 'Mariana Trench', emoji: '🌊' },
        ].map((r, i) => (
          <motion.div
            key={r.record}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-xl">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">{r.record}</p>
              <p className="text-sm font-bold text-white">{r.value}</p>
            </div>
            <p className="text-xs text-white/40 text-right">{r.where}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
}

// ─── Wonder overlay ───────────────────────────────────────────────────────────

function WonderOverlay({ type, onClose }: { type: AtlasWonderType; onClose: () => void }) {
  const wonder = WONDER_CONTENT[type]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-0 sm:px-6"
      style={{ background: 'rgba(0,0,8,0.8)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 overflow-y-auto"
        style={{ maxHeight: '80dvh', background: 'linear-gradient(160deg, #0c1024, #05070f)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading text-lg font-bold text-white">{wonder.title}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full text-white/50"
            style={{ minWidth: 44, minHeight: 44, background: 'rgba(255,255,255,0.08)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-white/40">{wonder.description}</p>
        {wonder.render()}
      </motion.div>
    </motion.div>
  )
}

// ─── Info panel (responsive: sheet on phone, rail on tablet) ──────────────────

const PANEL_BG = 'linear-gradient(180deg, rgba(10,12,28,0.98) 0%, rgba(5,7,20,0.99) 100%)'

function InfoPanel({ country, wide, onClose, onAskDecifer, onOpenWonder, muted, onToggleMute, onNarrated }: {
  country: Country
  wide: boolean
  onClose: () => void
  onAskDecifer?: (context: string) => void
  onOpenWonder: (type: AtlasWonderType) => void
  muted: boolean
  onToggleMute: () => void
  onNarrated: () => void
}) {
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3>(1)
  useEffect(() => { setActiveLayer(1) }, [country.key])
  const layer = country.layers[activeLayer - 1]
  const continent = CONTINENTS[country.continent]

  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'

  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '60dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div
      key={country.key}
      {...motionProps}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={className}
      style={style}
    >
      <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: PANEL_BG }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{country.flag}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: continent.color }}>{continent.emoji} {continent.name}</p>
              <h2 className="font-heading text-xl font-extrabold text-white leading-tight">{country.name}</h2>
              <p className="text-xs text-white/40">{country.capital} · {country.population}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NarrationButton text={layer.narration} muted={muted} onToggleMute={onToggleMute} autoPlay onComplete={onNarrated} />
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-full text-white/60"
              style={{ minWidth: 48, minHeight: 48, background: 'rgba(255,255,255,0.08)' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Layer tabs */}
        <div className="flex gap-2">
          {country.layers.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLayer(l.id as 1 | 2 | 3)}
              className="flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95"
              style={{
                minHeight: 48,
                background: activeLayer === l.id ? 'rgba(108,158,255,0.25)' : 'rgba(255,255,255,0.07)',
                border: activeLayer === l.id ? '1px solid rgba(108,158,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: activeLayer === l.id ? '#6C9EFF' : 'rgba(255,255,255,0.5)',
              }}
            >
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={activeLayer}
            className="text-sm leading-relaxed text-white/85"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {layer.content}
          </motion.p>
        </AnimatePresence>

        {/* Wonder trigger */}
        <button
          onClick={() => onOpenWonder(country.wonderType)}
          className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(108,158,255,0.12)', border: '1px solid rgba(108,158,255,0.25)', minHeight: 48 }}
        >
          <span className="text-2xl">🌐</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Explore a world wonder</p>
            <p className="text-xs text-white/40">{WONDER_CONTENT[country.wonderType].title}</p>
          </div>
          <span className="ml-auto text-white/40">→</span>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Capital', value: country.capital },
            { label: 'Population', value: country.population },
            { label: 'Area', value: country.area },
            { label: 'Continent', value: continent.name },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* What if → Ask Decifer */}
        <button
          onClick={() => onAskDecifer?.(country.whatIf)}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: 48 }}
        >
          <span>💭</span> {country.whatIf}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Journey panel ────────────────────────────────────────────────────────────

function JourneyPanel({ continentKey, step, total, wide, onNext, onStay, onFinish }: {
  continentKey: AtlasContinent
  step: number
  total: number
  wide: boolean
  onNext: () => void
  onStay: () => void
  onFinish: () => void
}) {
  const continent = CONTINENTS[continentKey]
  const isLast = step === total - 1

  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)]'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl'

  const style: React.CSSProperties = wide
    ? { background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '46dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div key={step} {...motionProps} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={className} style={style}>
      <div className="px-5 pt-4 pb-6">
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-1 rounded-full flex-1 transition-all duration-500" style={{ background: i <= step ? continent.color : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{continent.emoji}</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: continent.color }}>Stop {step + 1} of {total}</p>
            <h2 className="font-heading text-xl font-extrabold text-white">{continent.name}</h2>
          </div>
        </div>
        <p className="text-sm text-white/70 mb-5">Tap a glowing country to explore it, or continue the tour.</p>
        <div className="flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white/70 active:scale-[0.97] transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', minHeight: 48 }}
          >
            Stay here
          </button>
          <button
            onClick={isLast ? onFinish : onNext}
            className="flex-[2] rounded-2xl py-3 text-sm font-bold text-white active:scale-[0.97] transition-transform"
            style={{ background: isLast ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : `linear-gradient(135deg, ${continent.color}cc, ${continent.color}88)`, minHeight: 48 }}
          >
            {isLast ? '🏆 Complete' : 'Next →'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Journey complete ─────────────────────────────────────────────────────────

function JourneyComplete({ title, body, points, onDismiss }: { title: string; body: string; points: number; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,8,0.85)' }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{ background: 'linear-gradient(160deg, #0c1024, #05070f)', border: '2px solid rgba(255,215,0,0.4)' }}
      >
        <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }} className="text-6xl mb-4">🏆</motion.div>
        <h2 className="text-2xl font-extrabold text-white mb-2">{title}</h2>
        <p className="text-sm text-white/60 mb-2">{body}</p>
        <p className="text-sm font-bold text-yellow-300 mb-6">+{points} points earned</p>
        <button onClick={onDismiss} className="w-full rounded-2xl py-3 text-sm font-bold text-black active:scale-95" style={{ background: 'linear-gradient(135deg, #ffd700, #ffaa00)', minHeight: 48 }}>
          Explore freely
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface WorldAtlasProps {
  explorer: AtlasExplorer
  onAskDecifer?: (context: string) => void
  onExplore?: (key: string) => void
}

export function WorldAtlas({ explorer, onAskDecifer, onExplore }: WorldAtlasProps) {
  const countries = useMemo(() => explorer.nodes.map(toCountry), [explorer.nodes])
  const cfg = explorer.config

  const reducedMotion = useReducedMotion()
  const wide = useMediaQuery('(min-width: 768px)')

  const [selected, setSelected] = useState<Country | null>(null)
  const [filterContinent, setFilterContinent] = useState<AtlasContinent | null>(null)
  const [muted, setMuted] = useState(false)
  const [journeyStep, setJourneyStep] = useState<number | null>(null)
  const [journeyDone, setJourneyDone] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const [wonder, setWonder] = useState<AtlasWonderType | null>(null)

  const rewardedRef = useRef<Set<string>>(new Set())
  const selectedKeyRef = useRef<string | null>(null)
  const pendingCardRef = useRef<DroppedCard | null>(null)
  const cameraApi = useRef<CameraApi | null>(null)

  const journeyActive = journeyStep !== null
  const journeyContinent = journeyActive ? JOURNEY_CONTINENTS[journeyStep] : null

  const focusKey = selected
    ? selected.key
    : journeyContinent
      ? `cont:${journeyContinent}`
      : filterContinent
        ? `cont:${filterContinent}`
        : null

  const visibleCountries = filterContinent
    ? countries.filter(c => c.continent === filterContinent)
    : countries

  const handleSelect = useCallback((country: Country) => {
    stopNarration()
    setSelected(country)
    selectedKeyRef.current = country.key
    onExplore?.(country.key)
  }, [onExplore])

  // Card drops only when the narration plays through and the child is still on
  // that country — listening, not just tapping.
  const handleNarrated = useCallback(async (key: string) => {
    if (key !== selectedKeyRef.current || rewardedRef.current.has(key)) return
    rewardedRef.current.add(key)
    try {
      const res = await fetch('/api/explore/card-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'world-atlas', topicKey: key }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.card) pendingCardRef.current = data.card
      }
    } catch { /* non-fatal */ }
  }, [])

  const handleClose = useCallback(() => {
    stopNarration()
    setSelected(null)
    selectedKeyRef.current = null
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleAskDecifer = useCallback((context: string) => {
    stopNarration()
    setSelected(null)
    selectedKeyRef.current = null
    onAskDecifer?.(context)
  }, [onAskDecifer])

  const handleContinentSelect = useCallback((c: AtlasContinent) => {
    setFilterContinent(prev => (prev === c ? null : c))
  }, [])

  const startJourney = useCallback(() => {
    stopNarration()
    setSelected(null)
    setFilterContinent(null)
    setJourneyStep(0)
  }, [])

  const journeyNext = useCallback(() => {
    stopNarration()
    setJourneyStep(s => (s !== null && s < JOURNEY_CONTINENTS.length - 1 ? s + 1 : s))
  }, [])

  const journeyFinish = useCallback(async () => {
    stopNarration()
    setJourneyStep(null)
    setTimeout(() => setJourneyDone(true), 350)
    try {
      await fetch('/api/explore/journey-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'world-atlas' }),
      })
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => () => {
    document.body.style.cursor = 'auto'
    stopNarration()
  }, [])

  const controlsVisible = !selected && !journeyActive

  return (
    <div className="fixed inset-0" style={{ background: cfg.background }}>
      {/* Zoom controls */}
      {controlsVisible && (
        <div className="absolute right-4 z-30 flex flex-col gap-2" style={{ top: '72px' }}>
          <button
            onClick={() => cameraApi.current?.dolly(2)}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: 48, minWidth: 48 }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => cameraApi.current?.dolly(-2)}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: 48, minWidth: 48 }}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      )}

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
        framing="surface"
        apiRef={cameraApi}
      >
        <directionalLight position={cfg.directionalLight.position} intensity={cfg.directionalLight.intensity} />
        <Starfield count={cfg.starfield.count} radius={cfg.starfield.radius} depth={cfg.starfield.depth} reducedMotion={reducedMotion} />
        <Globe texture={cfg.globe.texture} radius={cfg.globe.radius} />
        {visibleCountries.map(country => (
          <CountryHotspot
            key={country.key}
            country={country}
            markerRadius={cfg.globe.markerRadius}
            isSelected={selected?.key === country.key}
            reducedMotion={reducedMotion}
            onSelect={handleSelect}
          />
        ))}
        {(Object.keys(CONTINENTS) as AtlasContinent[]).map(c => (
          <FocusAnchor key={c} id={`cont:${c}`} lat={CONTINENTS[c].lat} lng={CONTINENTS[c].lng} markerRadius={cfg.globe.markerRadius} />
        ))}
      </ExplorableCanvas>

      {/* World Tour */}
      {controlsVisible && (
        <div className="absolute bottom-24 inset-x-0 z-20 flex flex-col items-center gap-2 px-4">
          <button
            onClick={startJourney}
            className="rounded-full px-6 text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(108,158,255,0.35), rgba(167,139,250,0.25))', border: '1px solid rgba(108,158,255,0.4)', minHeight: 48 }}
          >
            🌍 Take the World Tour
          </button>
          <p className="text-[11px] text-white/30 text-center">Drag to spin · pinch to zoom · tap a country</p>
        </div>
      )}

      {/* Continent filter chips */}
      {controlsVisible && (
        <div className="absolute bottom-0 inset-x-0 z-20 pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(2,4,8,0.95) 0%, transparent 100%)' }}>
          <div className="flex gap-2 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(Object.keys(CONTINENTS) as AtlasContinent[]).map(c => {
              const meta = CONTINENTS[c]
              const active = filterContinent === c
              return (
                <button
                  key={c}
                  onClick={() => handleContinentSelect(c)}
                  className="flex-none flex items-center gap-1.5 rounded-full px-4 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
                  style={{
                    minHeight: 44,
                    background: active ? meta.color + '33' : 'rgba(255,255,255,0.08)',
                    border: active ? `1px solid ${meta.color}66` : '1px solid rgba(255,255,255,0.1)',
                    color: active ? meta.color : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Info panel */}
      <AnimatePresence>
        {selected && !journeyActive && (
          <InfoPanel
            country={selected}
            wide={wide}
            onClose={handleClose}
            onAskDecifer={handleAskDecifer}
            onOpenWonder={(type) => setWonder(type)}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            onNarrated={() => handleNarrated(selected.key)}
          />
        )}
      </AnimatePresence>

      {/* Journey panel */}
      <AnimatePresence>
        {journeyActive && journeyContinent && (
          <JourneyPanel
            continentKey={journeyContinent}
            step={journeyStep}
            total={JOURNEY_CONTINENTS.length}
            wide={wide}
            onNext={journeyNext}
            onStay={() => { stopNarration(); setJourneyStep(null) }}
            onFinish={journeyFinish}
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
            onDismiss={() => setJourneyDone(false)}
          />
        )}
      </AnimatePresence>

      {/* Wonder overlay */}
      <AnimatePresence>
        {wonder && <WonderOverlay type={wonder} onClose={() => setWonder(null)} />}
      </AnimatePresence>

      {/* Card reveal */}
      {revealCard && <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />}
    </div>
  )
}
