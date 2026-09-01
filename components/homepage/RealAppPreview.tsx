// What a parent is actually buying, drawn by the product's own code.
//
// This replaces a hand-drawn imitation of the parent dashboard that carried
// invented numbers (72%, "Quiz avg 82%"). Two problems with an imitation: it
// drifts away from the real screens the moment anyone changes them, and it
// shows a parent something their child will never see.
//
// This uses the real ZoneMap, the same one a child opens under Subjects. When
// the map changes, this changes with it, because it is not a copy. Deci sits
// above it because Deci is the only face the product has, and until now it
// appeared on exactly two screens, both of them behind a sign-in.
import { ZoneMap, type ZoneNode } from '@/components/world-map/ZoneMap'
import { DeciSays } from '@/components/ui/Deci'

// A believable Year 4 maths course: three done, one to do now, two ahead.
// Titles are real Year 4 topics, so nothing here promises content we lack.
const NODES: ZoneNode[] = [
  { id: 'p1', topicId: 'p1', topicTitle: 'Place Value to 10,000', state: 'completed',  href: '#', chapterCount: 6 },
  { id: 'p2', topicId: 'p2', topicTitle: 'Adding and Subtracting', state: 'completed',  href: '#', chapterCount: 8 },
  { id: 'p3', topicId: 'p3', topicTitle: 'Times Tables to 12',     state: 'completed',  href: '#', chapterCount: 5 },
  { id: 'p4', topicId: 'p4', topicTitle: 'Fractions of Amounts',   state: 'available',  href: '#', chapterCount: 7 },
  { id: 'p5', topicId: 'p5', topicTitle: 'Decimals',               state: 'locked',     href: '#', chapterCount: 6 },
  { id: 'p6', topicId: 'p6', topicTitle: 'Area and Perimeter',     state: 'locked',     href: '#', chapterCount: 4 },
]

export function RealAppPreview() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-4">
        <DeciSays mood="happy">Fractions next. Ready?</DeciSays>
      </div>

      {/* aria-hidden: this is a picture of the product for a parent to look at,
          not a map to use. Every node links to '#'. A screen reader announcing
          six unreachable topics would be noise, and the paragraph below says
          in words what the picture shows. */}
      <div aria-hidden>
        <ZoneMap
          zoneId="preview"
          subjectName="Maths"
          theme="crystal"
          subjectColor="#6C9EFF"
          nodes={NODES}
          allCompleted={false}
        />
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        A real Year 4 maths course. Green is done, orange is next.
      </p>
    </div>
  )
}
