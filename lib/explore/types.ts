// Shared types for the data-driven Explorable engine.
// Mirrors the explorers / explorer_nodes tables (see migration add_explorers).

export type WonderType =
  | 'temperature'
  | 'speed-of-light'
  | 'size-comparison'
  | 'jupiter-size'
  | 'saturn-rings'
  | 'gravity'

export interface ExplorerLayer {
  label: string
  emoji: string
  text: string
  narration: string
  whatIf: string
}

export interface NodeVisual {
  color: string
  glowColor: string
  radius: number
  orbitRadius: number
  period: number
  texture: string
  rings: boolean
  wonderType: WonderType
}

export interface NodeStats {
  diameter: string
  distanceFromSun: string
  orbitalPeriod: string
  moons: number
}

export interface NodeContent {
  description: string
  fact: string
  narration: string
  layers: ExplorerLayer[]
}

export interface NodeQuiz {
  question: string
  options: string[]
  answer: number
  explanation: string
}

// Generic node/explorer shapes — each scene type plugs in its own jsonb shapes.
export interface ExplorerNodeOf<V, S, C, Q> {
  key: string
  name: string
  order_index: number
  visual: V
  stats: S
  content: C
  quiz: Q
}

// Solar System node (the default).
export type ExplorerNode = ExplorerNodeOf<NodeVisual, NodeStats, NodeContent, NodeQuiz>

export interface OrrerySceneConfig {
  background: string
  sun: {
    texture: string
    radius: number
    light: { intensity: number; distance: number; decay: number; color: string }
  }
  starfield: { count: number; radius: number; depth: number }
  camera: {
    overview: [number, number, number]
    fov: number
    near: number
    far: number
    minDistance: number
    maxDistance: number
  }
  ambientLight: number
  completion: { title: string; body: string; points: number }
}

export interface ExplorerOf<Cfg, V, S, C, Q> {
  key: string
  title: string
  tagline: string | null
  emoji: string | null
  scene_type: string
  gradient: string | null
  config: Cfg
  nodes: ExplorerNodeOf<V, S, C, Q>[]
}

// Solar System explorer (the default `loadExplorer` shape).
export type ExplorerData = ExplorerOf<OrrerySceneConfig, NodeVisual, NodeStats, NodeContent, NodeQuiz>

// ---------------------------------------------------------------------------
// World Atlas (globe scene)
// ---------------------------------------------------------------------------

export type AtlasWonderType = 'population' | 'size' | 'climate' | 'trade' | 'language' | 'extremes'
export type AtlasContinent = 'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania'

export interface AtlasLayer {
  id: number
  label: string
  icon: string
  content: string
  narration: string
}

export interface AtlasVisual {
  color: string
  lat: number
  lng: number
  continent: AtlasContinent
  wonderType: AtlasWonderType
  whatIf: string
}

export interface AtlasStats {
  capital: string
  population: string
  area: string
  flag: string
}

export interface AtlasContent {
  narration: string
  layers: AtlasLayer[]
}

export interface GlobeSceneConfig {
  background: string
  globe: { texture: string; radius: number; markerRadius: number }
  starfield: { count: number; radius: number; depth: number }
  camera: {
    overview: [number, number, number]
    fov: number
    near: number
    far: number
    minDistance: number
    maxDistance: number
  }
  ambientLight: number
  directionalLight: { position: [number, number, number]; intensity: number }
  completion: { title: string; body: string; points: number }
}

export type AtlasNode = ExplorerNodeOf<AtlasVisual, AtlasStats, AtlasContent, null>
export type AtlasExplorer = ExplorerOf<GlobeSceneConfig, AtlasVisual, AtlasStats, AtlasContent, null>

// ---------------------------------------------------------------------------
// Periodic Table (2D interactive grid)
// ---------------------------------------------------------------------------

export interface ElementVisual {
  symbol: string
  number: number
  xpos: number
  ypos: number
  group: number | null
  period: number
  categoryKey: string // normalised category for colouring
  color: string
}

export interface ElementStats {
  atomic_mass: number
  phase: string
  category: string
  block: string
  discovered_by: string | null
  named_by: string | null
  appearance: string | null
  electron_configuration_semantic: string | null
}

export interface ElementContent {
  summary: string
  narration: string
  facts: string[]
}

export interface PeriodicSceneConfig {
  background: string
  categories: { key: string; label: string; color: string }[]
  completion?: { title: string; body: string; points: number }
  attribution: string
}

export type ElementNode = ExplorerNodeOf<ElementVisual, ElementStats, ElementContent, null>
export type PeriodicExplorer = ExplorerOf<PeriodicSceneConfig, ElementVisual, ElementStats, ElementContent, null>

// ---------------------------------------------------------------------------
// Human Body (2D interactive anatomy)
// ---------------------------------------------------------------------------

export interface BodyVisual {
  system: string
  x: number // hotspot position, 0-100
  y: number
  color: string
}

export interface BodyContent {
  kidFact: string
  summary: string
  source_url: string | null
}

export interface BodySceneConfig {
  background: string
  systems: { key: string; label: string; color: string }[]
  attribution: string
  completion?: { title: string; body: string; points: number }
}

export type BodyNode = ExplorerNodeOf<BodyVisual, Record<string, never>, BodyContent, null>
export type BodyExplorer = ExplorerOf<BodySceneConfig, BodyVisual, Record<string, never>, BodyContent, null>

// ---------------------------------------------------------------------------
// Animal Kingdom (2D card grid)
// ---------------------------------------------------------------------------

export interface AnimalVisual { group: string; habitat: string; emoji: string; color: string }
export interface AnimalContent { kidFact: string; summary: string; source_url: string | null }
export interface AnimalSceneConfig {
  background: string
  groups: { key: string; label: string; color: string }[]
  attribution: string
  completion?: { title: string; body: string; points: number }
}
export type AnimalNode = ExplorerNodeOf<AnimalVisual, Record<string, never>, AnimalContent, null>
export type AnimalExplorer = ExplorerOf<AnimalSceneConfig, AnimalVisual, Record<string, never>, AnimalContent, null>

// ---------------------------------------------------------------------------
// History Timeline (vertical scroll)
// ---------------------------------------------------------------------------

export interface TimelineVisual { era: string; yearLabel: string; color: string; sortYear: number }
export interface TimelineContent { kidFact: string; summary: string; source_url: string | null }
export interface TimelineSceneConfig {
  background: string
  eras: { key: string; label: string; color: string }[]
  attribution: string
  completion?: { title: string; body: string; points: number }
}
export type TimelineNode = ExplorerNodeOf<TimelineVisual, Record<string, never>, TimelineContent, null>
export type TimelineExplorer = ExplorerOf<TimelineSceneConfig, TimelineVisual, Record<string, never>, TimelineContent, null>
