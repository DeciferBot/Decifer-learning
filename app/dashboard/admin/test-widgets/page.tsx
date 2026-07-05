export const dynamic = 'force-dynamic'
/**
 * Widget test page — NOT auth-gated, dev-only.
 * Renders all widget types with realistic test data.
 * Delete before production if desired, or leave (it's read-only public data).
 */
import { DragLabel } from '@/components/learn/widgets/DragLabel'
import { SentenceBuilder } from '@/components/learn/widgets/SentenceBuilder'
import { ParticleModel } from '@/components/learn/widgets/ParticleModel'
import type { DragLabelWidget, SentenceBuilderWidget, ParticleModelWidget } from '@/lib/learn-widgets'

const plantWidget: DragLabelWidget = {
  type: 'drag_label',
  position: 'end',
  config: {
    title: 'Label the parts of a plant',
    instructions: 'Tap a label, then tap where it belongs on the diagram.',
    diagram_type: 'plant',
    items: [
      { id: 'roots',  label: 'Roots',  hotspot: { x: 50, y: 88 } },
      { id: 'stem',   label: 'Stem',   hotspot: { x: 50, y: 55 } },
      { id: 'leaves', label: 'Leaves', hotspot: { x: 75, y: 35 } },
      { id: 'flower', label: 'Flower', hotspot: { x: 50, y: 12 } },
    ],
  },
}

const circleWidget: DragLabelWidget = {
  type: 'drag_label',
  position: 'end',
  config: {
    title: 'Label the parts of a circle',
    instructions: 'Tap a label, then tap where it belongs.',
    diagram_type: 'circle',
    items: [
      { id: 'centre',       label: 'Centre',       hotspot: { x: 50, y: 50 } },
      { id: 'radius',       label: 'Radius',       hotspot: { x: 75, y: 25 } },
      { id: 'diameter',     label: 'Diameter',     hotspot: { x: 88, y: 50 } },
      { id: 'circumference',label: 'Circumference',hotspot: { x: 50, y: 10 } },
    ],
  },
}

const cellWidget: DragLabelWidget = {
  type: 'drag_label',
  position: 'end',
  config: {
    title: 'Label the animal cell',
    instructions: 'Tap a label, then tap where it belongs.',
    diagram_type: 'animal_cell',
    items: [
      { id: 'cell_membrane', label: 'Cell membrane', hotspot: { x: 88, y: 50 } },
      { id: 'nucleus',       label: 'Nucleus',       hotspot: { x: 38, y: 45 } },
      { id: 'cytoplasm',     label: 'Cytoplasm',     hotspot: { x: 70, y: 70 } },
      { id: 'mitochondria',  label: 'Mitochondria',  hotspot: { x: 72, y: 35 } },
    ],
  },
}

const sentenceWidget: SentenceBuilderWidget = {
  type: 'sentence_builder',
  position: 'end',
  config: {
    title: 'Build the sentence',
    instructions: 'Tap a word tile, then tap a slot to place it.',
    tiles: [
      { id: 't1', text: 'Carefully',  type: 'adverb' },
      { id: 't2', text: 'the',        type: 'other' },
      { id: 't3', text: 'cat',        type: 'noun' },
      { id: 't4', text: 'stepped',    type: 'verb' },
      { id: 't5', text: 'over',       type: 'preposition' },
      { id: 't6', text: 'puddle',     type: 'noun' },
      { id: 't7', text: '.',          type: 'punctuation' },
      { id: 't8', text: 'the',        type: 'other' },
      { id: 't9', text: 'slowly',     type: 'adverb' },   // distractor
    ],
    slots: [
      { id: 's1', accepts: ['t1'], placeholder: 'adverb' },
      { id: 's2', accepts: ['t3'], placeholder: 'noun' },
      { id: 's3', accepts: ['t4'], placeholder: 'verb' },
      { id: 's4', accepts: ['t5'], placeholder: 'prep' },
      { id: 's5', accepts: ['t2', 't8'], placeholder: 'det' },
      { id: 's6', accepts: ['t6'], placeholder: 'noun' },
      { id: 's7', accepts: ['t7'], placeholder: '.' },
    ],
    target_sentence: 'Carefully the cat stepped over the puddle.',
  },
}

const particleWidget: ParticleModelWidget = {
  type: 'particle_model',
  position: 'end',
  config: {
    title: 'States of matter: water',
    substance: 'water',
    start_state: 'solid',
    interactive: true,
  },
}

export default function TestWidgetsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-12">
      <h1 className="font-heading text-2xl font-bold text-ink">Widget Test Page</h1>

      <section>
        <h2 className="font-heading text-lg font-bold mb-2">DragLabel: Plant</h2>
        <DragLabel widget={plantWidget} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold mb-2">DragLabel: Circle</h2>
        <DragLabel widget={circleWidget} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold mb-2">DragLabel: Animal Cell</h2>
        <DragLabel widget={cellWidget} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold mb-2">SentenceBuilder: Fronted Adverbial</h2>
        <SentenceBuilder widget={sentenceWidget} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold mb-2">ParticleModel: States of Matter</h2>
        <ParticleModel widget={particleWidget} />
      </section>
    </div>
  )
}
