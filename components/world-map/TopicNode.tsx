'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Check, Star } from '@/components/ui/icons'

export type NodeState = 'locked' | 'available' | 'completed'

type Props = {
  title: string
  state: NodeState
  href: string
  subjectColor: string
  xPct: number // 0–100, percentage of container width
  yPct: number // 0–100, percentage of container height
}

const SIZE = 64 // px — satisfies the ≥48 tap-target requirement

export function TopicNode({ title, state, href, subjectColor, xPct, yPct }: Props) {
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${xPct}%`,
    top: `${yPct}%`,
    transform: 'translate(-50%, -50%)',
    width: SIZE,
    height: SIZE + 28, // extra for label
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  const circle = (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        borderRadius: '50%',
        backgroundColor: state === 'locked' ? '#E2E8F0' : subjectColor,
        border:
          state === 'completed'
            ? '3px solid #40C057'
            : state === 'available'
              ? `3px solid ${subjectColor}`
              : '3px solid #CBD5E0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: state === 'locked' ? 0.5 : 1,
        fontSize: 20,
        cursor: state === 'locked' ? 'default' : 'pointer',
      }}
      aria-hidden
    >
      {state === 'locked'    ? <Lock size={20} style={{ color: '#718096' }} />    :
       state === 'completed' ? <Check size={20} style={{ color: '#ffffff' }} />  :
                               <Star size={20} style={{ color: '#ffffff' }} />}
    </div>
  )

  const label = (
    <p
      style={{
        marginTop: 6,
        fontSize: 11,
        fontWeight: 700,
        color: state === 'locked' ? '#718096' : '#2D3748',
        maxWidth: 88,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {title}
    </p>
  )

  if (state === 'locked') {
    return (
      <div style={positionStyle}>
        {circle}
        {label}
      </div>
    )
  }

  const linked = (
    <Link href={href} aria-label={`${title}${state === 'completed' ? ' — completed' : ''}`}>
      {circle}
    </Link>
  )

  return (
    <div style={positionStyle}>
      {state === 'available' ? (
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
