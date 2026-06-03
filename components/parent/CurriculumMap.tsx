'use client'

/**
 * CurriculumMap — parent dashboard visual curriculum overview.
 * Shows subject swimlanes with topic cards colour-coded by status.
 */

import { useRef } from 'react'
import type { CurriculumSubject, CurriculumTopic } from '@/lib/parent-dashboard'

// ─── colour config ──────────────────────────────────────────────────────────

const SUBJECT_COLOURS: Record<string, {
  bg: string; border: string; text: string; pill: string; light: string; dot: string
}> = {
  Maths:     { bg: 'bg-[#6C9EFF]',  border: 'border-[#6C9EFF]',  text: 'text-[#6C9EFF]',  pill: 'bg-[#6C9EFF]/15',  light: 'bg-[#EEF3FF]', dot: '#6C9EFF' },
  English:   { bg: 'bg-[#FF8FAB]',  border: 'border-[#FF8FAB]',  text: 'text-[#FF8FAB]',  pill: 'bg-[#FF8FAB]/15',  light: 'bg-[#FFF0F4]', dot: '#FF8FAB' },
  Science:   { bg: 'bg-[#52D9A0]',  border: 'border-[#52D9A0]',  text: 'text-[#52D9A0]',  pill: 'bg-[#52D9A0]/15',  light: 'bg-[#EDFAF4]', dot: '#52D9A0' },
  Geography: { bg: 'bg-[#FF9F43]',  border: 'border-[#FF9F43]',  text: 'text-[#FF9F43]',  pill: 'bg-[#FF9F43]/15',  light: 'bg-[#FFF5EB]', dot: '#FF9F43' },
  History:   { bg: 'bg-[#A78BFA]',  border: 'border-[#A78BFA]',  text: 'text-[#A78BFA]',  pill: 'bg-[#A78BFA]/15',  light: 'bg-[#F3EFFE]', dot: '#A78BFA' },
}

const fallbackColour = { bg: 'bg-gray-400', border: 'border-gray-400', text: 'text-gray-500', pill: 'bg-gray-100', light: 'bg-gray-50', dot: '#9CA3AF' }

function getColour(name: string) {
  return SUBJECT_COLOURS[name] ?? fallbackColour
}

// ─── status helpers ──────────────────────────────────────────────────────────

type StatusMeta = {
  label: string
  cardBg: string
  cardBorder: string
  badgeBg: string
  badgeText: string
  icon: string
}

function getStatusMeta(topic: CurriculumTopic, subjectName: string): StatusMeta {
  const c = getColour(subjectName)
  const score = topic.lastScore ?? 0

  if (topic.progressStatus === 'not_started') {
    return {
      label: 'Not started',
      cardBg: 'bg-white',
      cardBorder: 'border-dashed border-gray-200',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-400',
      icon: '○',
    }
  }

  if (topic.progressStatus === 'in_progress') {
    return {
      label: 'In progress',
      cardBg: c.light,
      cardBorder: `border-solid ${c.border}`,
      badgeBg: c.pill,
      badgeText: c.text,
      icon: '◐',
    }
  }

  // completed
  if (score >= 0.95) {
    return {
      label: 'Excelled ⭐',
      cardBg: 'bg-[#FFFBEA]',
      cardBorder: 'border-solid border-[#FFC107]',
      badgeBg: 'bg-[#FFC107]/20',
      badgeText: 'text-[#B45309]',
      icon: '★',
    }
  }
  if (score >= 0.70) {
    return {
      label: 'Passed',
      cardBg: 'bg-[#F0FDF4]',
      cardBorder: 'border-solid border-[#40C057]',
      badgeBg: 'bg-[#40C057]/15',
      badgeText: 'text-[#166534]',
      icon: '✓',
    }
  }
  return {
    label: 'Needs support',
    cardBg: 'bg-[#FFF5F5]',
    cardBorder: 'border-solid border-[#FF6B6B]',
    badgeBg: 'bg-[#FF6B6B]/15',
    badgeText: 'text-[#B91C1C]',
    icon: '!',
  }
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function TopicCard({ topic, subjectName }: { topic: CurriculumTopic; subjectName: string }) {
  const c = getColour(subjectName)
  const meta = getStatusMeta(topic, subjectName)
  const score = topic.lastScore ?? 0
  const scoreLabel = topic.progressStatus === 'completed' ? `${Math.round(score * 100)}%` : null
  const isExcelled = topic.progressStatus === 'completed' && score >= 0.95
  const isFailed = topic.progressStatus === 'completed' && score < 0.70

  return (
    <div
      className={`
        relative flex-shrink-0 w-44 rounded-2xl border-2 p-3.5 flex flex-col gap-2
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default
        ${meta.cardBg} ${meta.cardBorder}
        ${isExcelled ? 'shadow-[0_0_12px_rgba(255,193,7,0.3)]' : ''}
      `}
    >
      {/* status icon top-right */}
      <span className={`
        absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
        ${meta.badgeBg} ${meta.badgeText}
      `}>
        {meta.icon}
      </span>

      {/* subject dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: c.dot }}
      />

      {/* title */}
      <p className="text-[12px] font-semibold text-[#2D3748] leading-snug pr-5">
        {topic.title}
      </p>

      {/* progress bar — in_progress only */}
      {topic.progressStatus === 'in_progress' && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${c.bg} opacity-80`}
            style={{ width: `${Math.round((score || 0.3) * 100)}%` }}
          />
        </div>
      )}

      {/* score */}
      {scoreLabel && (
        <p className={`text-[11px] font-bold ${meta.badgeText}`}>{scoreLabel}</p>
      )}

      {/* badge */}
      <span className={`
        self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-full
        ${meta.badgeBg} ${meta.badgeText}
      `}>
        {meta.label}
      </span>

      {/* "needs support" flag */}
      {isFailed && (
        <span className="text-[10px] text-[#B91C1C] font-medium">
          ⚠ Review recommended
        </span>
      )}
    </div>
  )
}

// ─── Subject swimlane ────────────────────────────────────────────────────────

function SubjectLane({ subject }: { subject: CurriculumSubject }) {
  const c = getColour(subject.subjectName)
  const pct = subject.totalCount > 0
    ? Math.round((subject.completedCount / subject.totalCount) * 100)
    : 0

  return (
    <div className="flex flex-col gap-3">
      {/* lane header */}
      <div className="flex items-center gap-3 px-1">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${c.bg}`} />
        <h3 className={`font-extrabold text-sm tracking-wide uppercase ${c.text}`}>
          {subject.subjectName}
        </h3>
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-400 font-medium">
          {subject.completedCount}/{subject.totalCount} done
        </span>
        {/* mini progress bar */}
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${c.bg}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* horizontal scroll of topic cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 pl-1 pr-4 scrollbar-thin scrollbar-thumb-gray-200">
        {subject.topics.map((topic) => (
          <TopicCard key={topic.topicId} topic={topic} subjectName={subject.subjectName} />
        ))}
      </div>
    </div>
  )
}

// ─── Weak areas section ──────────────────────────────────────────────────────

function WeakAreasPanel({ subjects }: { subjects: CurriculumSubject[] }) {
  const weakTopics = subjects.flatMap((s) =>
    s.topics
      .filter((t) => t.progressStatus === 'completed' && (t.lastScore ?? 1) < 0.70)
      .map((t) => ({ ...t, subjectName: s.subjectName }))
  )

  if (weakTopics.length === 0) return null

  return (
    <div className="mt-8 rounded-2xl border-2 border-[#FF6B6B]/30 bg-[#FFF5F5] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚠️</span>
        <h3 className="font-extrabold text-[#B91C1C] text-sm tracking-wide uppercase">
          Areas needing support
        </h3>
        <span className="ml-auto text-xs text-[#B91C1C]/70 bg-[#FF6B6B]/15 px-2 py-0.5 rounded-full font-semibold">
          {weakTopics.length} topic{weakTopics.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {weakTopics.map((t) => {
          const c = getColour(t.subjectName)
          const score = Math.round((t.lastScore ?? 0) * 100)
          return (
            <div
              key={t.topicId}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#FF6B6B]/20"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.bg}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#2D3748] truncate">{t.title}</p>
                <p className={`text-[11px] ${c.text} font-medium`}>{t.subjectName}</p>
              </div>
              <span className="text-sm font-bold text-[#B91C1C]">{score}%</span>
              <span className="text-[11px] text-[#B91C1C] bg-[#FF6B6B]/10 px-2 py-0.5 rounded-full font-semibold hidden sm:block">
                Retry recommended
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] text-[#B91C1C]/70 leading-relaxed">
        These topics had scores below 70%. Encourage another attempt — Decifer will serve a fresh set of questions.
      </p>
    </div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({
  subjects,
  streakDays,
  childName,
}: {
  subjects: CurriculumSubject[]
  streakDays: number
  childName: string
}) {
  const total = subjects.reduce((n, s) => n + s.totalCount, 0)
  const completed = subjects.reduce((n, s) => n + s.completedCount, 0)
  const inProgress = subjects.flatMap((s) =>
    s.topics.filter((t) => t.progressStatus === 'in_progress')
  ).length
  const weak = subjects.flatMap((s) =>
    s.topics.filter((t) => t.progressStatus === 'completed' && (t.lastScore ?? 1) < 0.70)
  ).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const stats = [
    { label: 'Topics complete', value: `${completed}/${total}`, sub: `${pct}%`, colour: 'text-[#2D3748]' },
    { label: 'In progress', value: inProgress, sub: 'active', colour: 'text-[#6C9EFF]' },
    { label: '🔥 Streak', value: streakDays, sub: 'days', colour: 'text-[#FF9F43]' },
    { label: '⚠ Need support', value: weak, sub: 'topics', colour: 'text-[#FF6B6B]' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5"
        >
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
          <p className={`text-2xl font-extrabold leading-none ${s.colour}`}>{s.value}</p>
          <p className="text-[11px] text-gray-400">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { icon: '○', bg: 'bg-gray-100', text: 'text-gray-400', label: 'Not started' },
    { icon: '◐', bg: 'bg-[#6C9EFF]/15', text: 'text-[#6C9EFF]', label: 'In progress' },
    { icon: '✓', bg: 'bg-[#40C057]/15', text: 'text-[#166534]', label: 'Passed' },
    { icon: '★', bg: 'bg-[#FFC107]/20', text: 'text-[#B45309]', label: 'Excelled' },
    { icon: '!', bg: 'bg-[#FF6B6B]/15', text: 'text-[#B91C1C]', label: 'Needs support' },
  ]
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i.bg} ${i.text}`}>
            {i.icon}
          </span>
          <span className="text-[11px] text-gray-500 font-medium">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function CurriculumMap({
  subjects,
  childName,
  yearLabel,
  streakDays = 0,
}: {
  subjects: CurriculumSubject[]
  childName: string
  yearLabel: string
  streakDays?: number
}) {
  const totalTopics = subjects.reduce((n, s) => n + s.totalCount, 0)
  const totalSubjects = subjects.length

  return (
    <section className="w-full">
      {/* header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#2D3748] leading-tight">
          Welcome back — <span className="text-[#6C9EFF]">{childName}</span>&apos;s {yearLabel} Journey
        </h2>
        <p className="text-sm text-gray-400 mt-1 font-medium">
          {yearLabel} · {totalTopics} topics across {totalSubjects} subjects
        </p>
      </div>

      {/* summary stats */}
      <SummaryBar subjects={subjects} streakDays={streakDays} childName={childName} />

      {/* legend */}
      <Legend />

      {/* swimlanes */}
      <div className="flex flex-col gap-8">
        {subjects.map((subject) => (
          <SubjectLane key={subject.subjectId} subject={subject} />
        ))}
      </div>

      {/* weak areas */}
      <WeakAreasPanel subjects={subjects} />
    </section>
  )
}
