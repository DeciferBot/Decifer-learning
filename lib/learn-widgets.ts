export type WidgetPosition = 'top' | 'after_intro' | 'middle' | 'end'

export interface BaseWidget {
  type: string
  position: WidgetPosition
  title?: string
}

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
    diagram_type:
      | 'circle'
      | 'triangle'
      | 'plant'
      | 'animal_cell'
      | 'water_cycle'
      | 'human_heart'
      | 'volcano'
      | 'river'
      | 'right_triangle'
    items: DragLabelItem[]
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
  | ParticleModelWidget
  | TimelineWidget
  | SentenceBuilderWidget
