'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Check, Star, BookOpen } from '@/components/ui/icons'

export type NodeState = 'locked' | 'available' | 'completed'

type Props = {
  title: string
  state: NodeState
  href: string
  subjectColor: string
  xPct: number // 0–100, horizontal centre as a percentage of the canvas width
  yPx: number  // px offset of the node box top within the canvas
  quizOptional?: boolean // Learn-only topic — show book icon instead of star
  chapterCount?: number  // number of Oak curriculum chapters in this topic
}

export const NODE_CIRCLE = 64 // px — satisfies the ≥48 tap-target requirement
export const NODE_BOX_W = 94  // px column reserved for circle + label + chip

export function TopicNode({ title, state, href, subjectColor, xPct, yPx, quizOptional = false, chapterCount }: Props) {
  const circle = (
    <div
      className={state === 'locked' ? 'bg-black/10' : ''}
      style={{
        width: NODE_CIRCLE,
        height: NODE_CIRCLE,
        flexShrink: 0,
        borderRadius: '50%',
        backgroundColor: state === 'locked' ? undefined : subjectColor,
        border:
          state === 'completed'
            ? '3px solid var(--correct)'
            : state === 'available'
              ? `3px solid ${subjectColor}`
              : '3px dashed #C9CFD8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: state === 'locked' ? 'default' : 'pointer',
      }}
      aria-hidden
    >
      {state === 'locked'    ? <Lock size={20} className="text-ink-2" />           :
       state === 'completed' ? <Check size={20} style={{ color: '#ffffff' }} />    :
       quizOptional          ? <BookOpen size={20} style={{ color: '#ffffff' }} /> :
                               <Star size={20} style={{ color: '#ffffff' }} />}
    </div>
  )

  const label = (
    <div className="pointer-events-none flex flex-col items-center gap-1" style={{ width: NODE_BOX_W }}>
      <p
        className={`mt-1.5 text-center text-[11px] font-bold leading-tight ${state === 'locked' ? 'text-ink-2' : 'text-ink'}`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
        title={title}
      >
        {title}
      </p>
      {chapterCount !== undefined && chapterCount > 1 && (
        <span
          className={`rounded-full px-2 text-[11px] font-bold leading-[18px] ${state === 'locked' ? 'bg-black/5 text-ink-2' : 'text-ink'}`}
          style={state === 'locked' ? undefined : { backgroundColor: `${subjectColor}2E` }}
        >
          {chapterCount} chapters
        </span>
      )}
    </div>
  )

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${xPct}%`,
    top: yPx,
    transform: 'translateX(-50%)',
    width: NODE_BOX_W,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  if (state === 'locked') {
    return (
      <div style={positionStyle}>
        {circle}
        {label}
        <span className="sr-only">{title} — locked</span>
      </div>
    )
  }

  const linked = (
    <Link
      href={href}
      aria-label={`${title}${state === 'completed' ? ' — completed' : ''}`}
      className="block rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {circle}
    </Link>
  )

  return (
    <div style={positionStyle}>
      {state === 'available' ? (
        // MotionConfig reducedMotion="user" (child layout) disables this pulse
        // for children who prefer reduced motion.
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          {linked}
        </motion.div>
      ) : (
        linked
      )}
      {label}
    </div>
  )
}
