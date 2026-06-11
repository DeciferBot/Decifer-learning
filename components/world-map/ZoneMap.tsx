'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Check, Star, BookOpen, Leaf, TreePine, Mountain, Hexagon, ScrollText, Flame, MapFold, FlagCheckered, Swords } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export type ZoneTopic = {
  id: string
  title: string
  state: 'locked' | 'available' | 'completed'
  href: string
  quizOptional?: boolean
  chapterCount?: number
}

type Props = {
  zoneId: string
  zoneName: string
  subjectName: string
  theme: string | null
  subjectColor: string
  topics: ZoneTopic[]
  allCompleted: boolean
  checkpointTopicId?: string | null
}

const THEME_ICON: Record<string, IconType> = {
  jungle:   Leaf,
  woodland: TreePine,
  cave:     Mountain,
  crystal:  Hexagon,
  library:  ScrollText,
  forge:    Flame,
}

function TopicBubble({ topic, subjectColor }: { topic: ZoneTopic; subjectColor: string }) {
  const { state, href, title, quizOptional, chapterCount } = topic

  const bubble = (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        backgroundColor: state === 'locked' ? '#E2E8F0' : subjectColor,
        border: state === 'completed'
          ? '3px solid #40C057'
          : state === 'available'
            ? `3px solid ${subjectColor}`
            : '3px solid #CBD5E0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: state === 'locked' ? 0.5 : 1,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {state === 'locked'    ? <Lock size={18} style={{ color: '#718096' }} />      :
       state === 'completed' ? <Check size={18} style={{ color: '#ffffff' }} />    :
       quizOptional          ? <BookOpen size={18} style={{ color: '#ffffff' }} /> :
                               <Star size={18} style={{ color: '#ffffff' }} />}
    </div>
  )

  const inner = (
    <div className="flex flex-col items-center gap-1.5 w-20">
      {state === 'available' ? (
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
          <Link href={href} aria-label={title}>{bubble}</Link>
        </motion.div>
      ) : state === 'completed' ? (
        <Link href={href} aria-label={`${title} — completed`}>{bubble}</Link>
      ) : (
        bubble
      )}
      <p
        className="text-center font-bold leading-snug"
        style={{
          fontSize: 10,
          color: state === 'locked' ? '#718096' : '#2D3748',
          maxWidth: 80,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {title}
      </p>
      {chapterCount && chapterCount > 1 && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: state === 'locked' ? '#718096' : '#fff',
            backgroundColor: state === 'locked' ? '#CBD5E0' : subjectColor,
            borderRadius: 99,
            padding: '1px 5px',
            opacity: state === 'locked' ? 0.6 : 0.85,
          }}
        >
          {chapterCount} ch
        </span>
      )}
    </div>
  )

  return inner
}

export function ZoneMap({ zoneId, zoneName, subjectName, theme, subjectColor, topics, allCompleted, checkpointTopicId }: Props) {
  const ThemeIcon: IconType = theme ? (THEME_ICON[theme] ?? MapFold) : MapFold
  const completedCount = topics.filter((t) => t.state === 'completed').length

  return (
    <div
      className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm"
      style={{ borderLeft: `4px solid ${subjectColor}` }}
    >
      {/* Zone header */}
      <div className="flex items-center gap-3 px-5 pb-2 pt-4">
        <ThemeIcon size={20} style={{ color: subjectColor }} aria-hidden />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: subjectColor }}>{subjectName}</p>
          <h3 className="font-heading text-base font-bold text-ink leading-tight">{zoneName}</h3>
        </div>
      </div>

      {/* Topic grid */}
      <div className="flex flex-wrap gap-x-4 gap-y-5 px-5 py-4">
        {topics.map((topic) => (
          <TopicBubble key={topic.id} topic={topic} subjectColor={subjectColor} />
        ))}
      </div>

      {/* Checkpoint banner */}
      {checkpointTopicId && !allCompleted && (
        <div
          className="mx-5 mb-3 rounded-xl p-4"
          style={{ backgroundColor: '#EEF4FF', border: '2px solid #6C9EFF' }}
        >
          <p className="flex items-center gap-2 font-heading font-bold text-ink">
            <FlagCheckered size={18} className="text-brand" /> Zone Checkpoint!
          </p>
          <p className="mt-1 text-sm text-muted">Great progress — 3 quick questions to check you&apos;re on track.</p>
          <Link
            href={`/topics/${checkpointTopicId}/checkpoint`}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#6C9EFF' }}
          >
            Take Checkpoint →
          </Link>
        </div>
      )}

      {/* Guardian banner */}
      {allCompleted && (
        <div
          className="mx-5 mb-4 rounded-xl p-4 text-center"
          style={{ backgroundColor: '#FFF9E6', border: '2px solid #FFD43B' }}
        >
          <p className="flex items-center justify-center gap-2 font-heading font-bold text-ink">
            <Swords size={18} className="text-lightning" /> Zone Guardian Awakens!
          </p>
          <p className="mt-1 text-sm text-muted">All topics complete — face the guardian!</p>
          <Link
            href={`/guardian/${zoneId}`}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: subjectColor }}
          >
            Battle Guardian →
          </Link>
        </div>
      )}

      {/* Progress footer */}
      <div className="px-5 pb-4 pt-1">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-muted">{completedCount} / {topics.length} topic{topics.length !== 1 ? 's' : ''} complete</p>
          <p className="text-xs font-bold" style={{ color: subjectColor }}>
            {topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0}%
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/8">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${topics.length > 0 ? (completedCount / topics.length) * 100 : 0}%`, backgroundColor: subjectColor }}
          />
        </div>
      </div>
    </div>
  )
}
