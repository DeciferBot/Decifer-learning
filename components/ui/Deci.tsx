// Deci the navigator — the product's guide, drawn in code.
//
// Decifer's brand voice is "the guide in the conversation". Until the nautical
// theme (2026-09) that guide had no face: questions were headings on a page.
// Duolingo's owl is the proof of what a face does — a child reads a question
// as being ASKED by someone, and a wrong answer becomes a conversation rather
// than a verdict.
//
// Drawn as SVG so it costs nothing to load, scales to any size, and can change
// expression by prop instead of shipping image files.

type Mood = 'happy' | 'thinking' | 'cheering'

const MOUTHS: Record<Mood, string> = {
  happy: 'M25 43q7 6 14 0',
  thinking: 'M27 44h10',
  cheering: 'M24 42q8 9 16 0',
}

export function Deci({
  mood = 'happy',
  size = 64,
  className = '',
}: {
  mood?: Mood
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* face */}
      <circle cx="32" cy="36" r="22" fill="#FFF3EC" />
      <circle cx="32" cy="36" r="22" fill="none" stroke="#B83300" strokeWidth="3" />
      {/* eyes — closed crescents when cheering */}
      {mood === 'cheering' ? (
        <>
          <path d="M21 34q4-4 8 0" stroke="#12314B" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M35 34q4-4 8 0" stroke="#12314B" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="34" r="3.4" fill="#12314B" />
          <circle cx="39" cy="34" r="3.4" fill="#12314B" />
        </>
      )}
      <path d={MOUTHS[mood]} stroke="#12314B" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* captain's cap: sea brim, deep-sea crown, ember button */}
      <path d="M12 22q20-16 40 0l-4 6q-16-11-32 0z" fill="#1B6FA8" />
      <rect x="24" y="10" width="16" height="9" rx="3" fill="#0F3A5C" />
      <circle cx="32" cy="8" r="3" fill="#FB5A24" />
    </svg>
  )
}

/**
 * Deci asking something: the face plus a speech bubble.
 * Sits on a sea-coloured header; the bubble is the readable surface.
 */
export function DeciSays({
  children,
  mood = 'happy',
}: {
  children: React.ReactNode
  mood?: Mood
}) {
  return (
    <div className="flex items-end gap-2.5">
      <Deci mood={mood} size={56} className="flex-none" />
      <div className="mb-1.5 rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 font-heading text-[15px] font-bold text-ink shadow-[0_2px_0_rgba(15,58,92,0.15)]">
        {children}
      </div>
    </div>
  )
}
