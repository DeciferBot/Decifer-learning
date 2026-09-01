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
  const circleClass =
    state === 'completed'
      ? 'bg-correct border-[3px] border-solid border-correct-700 shadow-clay-sm'
      : state === 'available'
        ? 'bg-brand border-[3px] border-solid border-brand-700 shadow-clay'
        : 'bg-black/5 border-[3px] border-dashed border-sea-deep/25'
  const circle = (
    <div
      className={`flex flex-none items-center justify-center rounded-full transition-[transform,box-shadow] duration-fast ease-out ${circleClass} ${
        state === 'locked' ? '' : 'cursor-pointer active:translate-y-[2px] active:shadow-clay-pressed motion-reduce:active:translate-y-0'
      }`}
      style={{ width: NODE_CIRCLE, height: NODE_CIRCLE }}
      aria-hidden
    >
      {state === 'locked'    ? <Lock size={20} className="text-muted" /> :
       state === 'completed' ? <Check size={24} className="text-white" strokeWidth={3} /> :
       quizOptional          ? <BookOpen size={22} className="text-white" /> :
                               <Star size={24} className="text-white" />}
    </div>
  )

  const label = (
    <div className="pointer-events-none flex flex-col items-center gap-1" style={{ width: NODE_BOX_W }}>
      <p
        className={`mt-1.5 text-center text-[11px] font-bold leading-tight ${state === 'locked' ? 'text-muted' : 'text-sea-deep'}`}
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
        <span className="sr-only">{title}, locked</span>
      </div>
    )
  }

  const linked = (
    <Link
      href={href}
      aria-label={`${title}${state === 'completed' ? ', completed' : ''}`}
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
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
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
