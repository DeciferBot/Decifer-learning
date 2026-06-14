export type WidgetPosition = 'top' | 'after_intro' | 'middle' | 'end'

export interface BaseWidget {
  type: string
  position: WidgetPosition
  title?: string
}

/**
 * Every illustration the diagram registry can render. Shared by the interactive
 * `drag_label` widget and the static `diagram` widget so both draw from the same
 * inline-SVG set (offline-safe, no network images). Keep in sync with
 * components/learn/diagrams/index.tsx — the unit test enforces full coverage.
 */
export type DiagramType =
  // Maths
  | 'circle'
  | 'triangle'
  | 'right_triangle'
  | 'multiplication_groups'
  | 'bar_model'
  | 'number_line'
  | 'fraction_circle'
  | 'array_grid'
  | 'place_value'
  | 'clock_face'
  // Science
  | 'plant'
  | 'animal_cell'
  | 'water_cycle'
  | 'human_heart'
  | 'volcano'
  | 'river'
  | 'food_chain'
  | 'simple_circuit'
  | 'earth_layers'
  // English
  | 'story_mountain'
  | 'word_anatomy'

export interface DragLabelItem {
  id: string
  label: string
  hotspot: { x: number; y: number } // percentage positions on diagram
}

export interface DragLabelWidget extends BaseWidget {
  type: 'drag_label'
  config: {
    title: string
    instructions?: string
    diagram_type: DiagramType
    items: DragLabelItem[]
  }
}

/** A non-interactive annotation pinned to a point on a diagram (x/y in 0–100%). */
export interface DiagramLabel {
  text: string
  x: number
  y: number
}

/**
 * Static, labelled illustration rendered inside a lesson. Unlike `drag_label`
 * there is no game — it simply surfaces a rich diagram from the registry with
 * optional pinned annotations and a caption.
 */
export interface DiagramWidget extends BaseWidget {
  type: 'diagram'
  config: {
    title?: string
    caption?: string
    diagram_type: DiagramType
    labels?: DiagramLabel[]
  }
}

export interface ParticleModelWidget extends BaseWidget {
  type: 'particle_model'
  config: {
    title: string
    substance: string
    start_state: 'solid' | 'liquid' | 'gas'
    interactive: boolean
  }
}

export interface TimelineWidget extends BaseWidget {
  type: 'timeline'
  config: {
    title: string
    events: Array<{
      id: string
      label: string
      year: number | string
      correct_position: number
    }>
  }
}

export interface SentenceBuilderWidget extends BaseWidget {
  type: 'sentence_builder'
  config: {
    title: string
    instructions?: string
    tiles: Array<{
      id: string
      text: string
      type:
        | 'noun'
        | 'verb'
        | 'adjective'
        | 'adverb'
        | 'conjunction'
        | 'preposition'
        | 'punctuation'
        | 'other'
    }>
    slots: Array<{ id: string; accepts: string[]; placeholder: string }>
    target_sentence: string
  }
}

export type LearnWidget =
  | DragLabelWidget
  | DiagramWidget
  | ParticleModelWidget
  | TimelineWidget
  | SentenceBuilderWidget
