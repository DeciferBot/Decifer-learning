'use client'

/**
 * ChildCurriculumMap — child dashboard visual year overview.
 * Shows every subject and topic with status + Learn/Practise/Quiz action buttons.
 * Mobile: stacked lanes, horizontal card scroll.
 * Desktop (lg+): 3-column grid per subject.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { CurriculumSubject, CurriculumTopic } from '@/lib/parent-dashboard'
import { Clock, Star, Check, MapPin, BookOpen, Zap, Flame } from '@/components/ui/icons'

// ─── canonical subject order ─────────────────────────────────────────────────
const SUBJECT_ORDER = ['Maths', 'English', 'Science', 'Geography', 'History']
function sortSubjects(s: CurriculumSubject[]) {
  return [...s].sort((a, b) => {
    const ia = SUBJECT_ORDER.indexOf(a.subjectName), ib = SUBJECT_ORDER.indexOf(b.subjectName)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

// ─── colours ────────────────────────────────────────────────────────────────

const COLS: Record<string, { bg: string; border: string; text: string; light: string; dot: string; btnBg: string }> = {
  Maths:     { bg: 'bg-[#6C9EFF]', border: 'border-[#6C9EFF]', text: 'text-[#6C9EFF]', light: 'bg-[#EEF3FF]', dot: '#6C9EFF', btnBg: 'bg-[#6C9EFF]/10 hover:bg-[#6C9EFF]/20 text-[#6C9EFF]' },
  English:   { bg: 'bg-[#FF8FAB]', border: 'border-[#FF8FAB]', text: 'text-[#FF8FAB]', light: 'bg-[#FFF0F4]', dot: '#FF8FAB', btnBg: 'bg-[#FF8FAB]/10 hover:bg-[#FF8FAB]/20 text-[#FF8FAB]' },
  Science:   { bg: 'bg-[#52D9A0]', border: 'border-[#52D9A0]', text: 'text-[#52D9A0]', light: 'bg-[#EDFAF4]', dot: '#52D9A0', btnBg: 'bg-[#52D9A0]/10 hover:bg-[#52D9A0]/20 text-[#52D9A0]' },
  Geography: { bg: 'bg-[#FF9F43]', border: 'border-[#FF9F43]', text: 'text-[#FF9F43]', light: 'bg-[#FFF5EB]', dot: '#FF9F43', btnBg: 'bg-[#FF9F43]/10 hover:bg-[#FF9F43]/20 text-[#FF9F43]' },
  History:   { bg: 'bg-[#A78BFA]', border: 'border-[#A78BFA]', text: 'text-[#A78BFA]', light: 'bg-[#F3EFFE]', dot: '#A78BFA', btnBg: 'bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA]' },
}
const fallback = { bg: 'bg-gray-400', border: 'border-gray-300', text: 'text-gray-500', light: 'bg-gray-50', dot: '#9CA3AF', btnBg: 'bg-gray-100 hover:bg-gray-200 text-gray-600' }
function c(name: string) { return COLS[name] ?? fallback }

// ─── status ──────────────────────────────────────────────────────────────────

// ─── path states ─────────────────────────────────────────────────────────────
//
// A child sees where they are on a path, never a mark. This screen used to show
// every topic's percentage and put a red border, a red warning triangle and the
// words "try again" on anything under 70%, which is a school report rendered in
// pastel. Scores are still recorded and are still shown in full on the parent
// dashboard, which is where they are actually useful.
//
// Four states, and none of them is a failure: not started, current, done,
// mastered. A topic the child has started but not yet finished is "current", the
// same state whether they scored 20% or 69%.
function statusMeta(topic: CurriculumTopic, subjectName: string) {
  const col = c(subjectName)
  const score = topic.lastScore ?? 0
  if (topic.progressStatus === 'not_started')
    return { icon: null as React.ReactNode, label: 'Not started', ring: 'border border-gray-200/80', bg: col.light.replace('bg-[#', 'bg-[#').replace(']', ']/40'), badge: 'bg-gray-100 text-gray-400' }
  if (topic.progressStatus === 'in_progress')
    return { icon: <Clock className="w-2.5 h-2.5" aria-hidden /> as React.ReactNode, label: 'Carry on',  ring: 'border-solid', bg: '',          badge: 'bg-[#6C9EFF]/15 text-[#6C9EFF]' }
  if (score >= 0.95)
    return { icon: <Star className="w-2.5 h-2.5" aria-hidden /> as React.ReactNode, label: 'Mastered',    ring: 'border-solid border-[#FFC107]', bg: 'bg-[#FFFBEA]', badge: 'bg-[#FFC107]/20 text-[#B45309]' }
  return   { icon: <Check className="w-2.5 h-2.5" aria-hidden /> as React.ReactNode, label: 'Done',       ring: 'border-solid border-[#40C057]', bg: 'bg-[#F0FDF4]', badge: 'bg-[#40C057]/15 text-[#166534]' }
}

/**
 * The one action this topic should offer.
 *
 * Learn / Practise / Quiz on every card asked a child to make a teacher's
 * decision on every topic, forever. The app has the progress data, so it picks:
 * a topic never started begins at Learn, one already under way goes to its quiz,
 * and a finished one offers a replay.
 */
function primaryAction(topic: CurriculumTopic): { href: string; label: string; icon: React.ReactNode } {
  if (topic.progressStatus === 'not_started') {
    return { href: `/topics/${topic.topicId}/learn`, label: 'Start', icon: <BookOpen className="w-3 h-3" aria-hidden /> }
  }
  if (topic.progressStatus === 'in_progress') {
    return { href: `/topics/${topic.topicId}/quiz`, label: 'Carry on', icon: <Zap className="w-3 h-3" aria-hidden /> }
  }
  return { href: `/topics/${topic.topicId}/quiz`, label: 'Play again', icon: <Zap className="w-3 h-3" aria-hidden /> }
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  subjectName,
}: {
  topic: CurriculumTopic
  subjectName: string
}) {
  const col = c(subjectName)
  const st  = statusMeta(topic, subjectName)
  const score = topic.lastScore ?? 0
  const excelled = topic.progressStatus === 'completed' && score >= 0.95
  const action = primaryAction(topic)

  return (
    <div className={`
      relative flex flex-col gap-3 rounded-2xl border-2 p-4
      ${st.bg || col.light} ${st.ring}
      ${topic.progressStatus === 'in_progress' ? col.border : ''}
      transition-all duration-200 hover:shadow-md
      ${excelled ? 'shadow-[0_0_16px_rgba(255,193,7,0.3)]' : ''}
    `}>
      {/* status badge top-right */}
      <span className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${st.badge}`}>
        {st.icon}
      </span>

      {/* subject dot + title */}
      <div className="flex items-start gap-2 pr-7">
        <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.dot }} />
        <p className="text-[13px] font-bold text-[#2D3748] leading-snug">{topic.title}</p>
      </div>

      {/* No progress bar here: its width was the child's last score, so a weak
          attempt drew a nearly-empty bar, which reads as a mark by another name.
          The "Carry on" badge says the same thing without ranking them. */}

      {/* state — a word, never a mark. Percentages live on the parent dashboard. */}
      {topic.progressStatus === 'completed' && (
        <p className={`text-xs font-bold flex items-center gap-1 ${st.badge.split(' ')[1]}`}>
          {excelled ? <Star className="w-3 h-3" aria-hidden /> : <Check className="w-3 h-3" aria-hidden />}
          {excelled ? 'Mastered' : 'Done'}
        </p>
      )}

      {/* parent-assigned flag */}
      {topic.isAssigned && (
        <span className="text-[10px] font-semibold text-[#FF9F43] flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" aria-hidden /> Focus topic</span>
      )}

      {/* One primary action, chosen by where the child already is. The other two
          routes stay reachable from the topic page itself. */}
      <div className="flex items-center gap-1.5 mt-auto">
        <Link
          href={action.href}
          className={`flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors ${col.btnBg}`}
        >
          {action.icon} {action.label}
        </Link>
        {topic.progressStatus !== 'not_started' && (
          <Link
            href={`/topics/${topic.topicId}/learn`}
            aria-label={`Read the ${topic.title} lesson again`}
            title="Read the lesson again"
            className="flex-none min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Subject lane ─────────────────────────────────────────────────────────────

function SubjectLane({
  subject,
}: {
  subject: CurriculumSubject
}) {
  const col = c(subject.subjectName)
  const pct = subject.totalCount > 0 ? Math.round((subject.completedCount / subject.totalCount) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex items-center gap-3 px-1">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${col.bg}`} />
        <h3 className={`font-extrabold text-sm tracking-wide uppercase ${col.text}`}>{subject.subjectName}</h3>
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-400 font-medium">{subject.completedCount}/{subject.totalCount} done</span>
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* mobile: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 pl-1 pr-4 scrollbar-thin scrollbar-thumb-gray-200 lg:hidden">
        {subject.topics.map((t) => (
          <div key={t.topicId} className="flex-shrink-0 w-52">
            <TopicCard topic={t} subjectName={subject.subjectName} />
          </div>
        ))}
      </div>

      {/* desktop: 3-col grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-3">
        {subject.topics.map((t) => (
          <TopicCard key={t.topicId} topic={t} subjectName={subject.subjectName} />
        ))}
      </div>
    </div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ subjects, streak, points }: { subjects: CurriculumSubject[]; streak: number; points: number }) {
  const total     = subjects.reduce((n, s) => n + s.totalCount, 0)
  const completed = subjects.reduce((n, s) => n + s.completedCount, 0)
  const inProg    = subjects.flatMap((s) => s.topics.filter((t) => t.progressStatus === 'in_progress')).length
  const excelled  = subjects.flatMap((s) => s.topics.filter((t) => t.progressStatus === 'completed' && (t.lastScore ?? 0) >= 0.95)).length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  const stats = [
    { label: 'Topics done',   value: `${completed}/${total}`, sub: `${pct}% of your year`, colour: 'text-[#2D3748]' },
    { label: 'On the go',     value: inProg,                  sub: 'keep going!',          colour: 'text-[#6C9EFF]' },
    { label: 'Mastered',      value: excelled,                sub: 'nailed it',            colour: 'text-[#B45309]' },
    { label: 'Streak',        value: streak,                  sub: 'days in a row',        colour: 'text-[#FF9F43]' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
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
  // Four states, no failure state. See statusMeta above for why.
  const items: { icon: React.ReactNode; bg: string; text: string; label: string }[] = [
    { icon: null,                                          bg: 'bg-gray-100',      text: 'text-gray-400',  label: 'Not started' },
    { icon: <Clock className="w-2.5 h-2.5" aria-hidden />, bg: 'bg-[#6C9EFF]/15', text: 'text-[#6C9EFF]', label: 'Carry on' },
    { icon: <Check className="w-2.5 h-2.5" aria-hidden />, bg: 'bg-[#40C057]/15', text: 'text-[#166534]', label: 'Done' },
    { icon: <Star className="w-2.5 h-2.5" aria-hidden />,  bg: 'bg-[#FFC107]/20', text: 'text-[#B45309]', label: 'Mastered' },
  ]
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${i.bg} ${i.text}`}>{i.icon}</span>
          <span className="text-[11px] text-gray-500 font-medium">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function ChildCurriculumMap({
  subjects,
  displayName,
  yearLabel,
  streak = 0,
  points = 0,
}: {
  subjects: CurriculumSubject[]
  displayName: string
  yearLabel: string
  streak?: number
  points?: number
}) {
  const sorted = sortSubjects(subjects)
  const totalTopics = sorted.reduce((n, s) => n + s.totalCount, 0)
  const totalDone   = sorted.reduce((n, s) => n + s.completedCount, 0)
  const pct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0

  // Render first subject immediately (above the fold), defer the rest until
  // after first paint so they don't block the Speed Index metric.
  const [visibleCount, setVisibleCount] = useState(1)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisibleCount(sorted.length))
    return () => cancelAnimationFrame(id)
  }, [sorted.length])

  return (
    <section className="w-full">
      {/* hero banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#6C9EFF] to-[#A78BFA] p-5 mb-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">{yearLabel} · Your full curriculum</p>
        <h2 className="text-2xl font-extrabold leading-tight mb-3">
          {totalDone === 0 ? `Let's get started, ${displayName}!` : `Keep going, ${displayName}!`}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-surface/30 rounded-full overflow-hidden">
            <div className="h-full bg-surface rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-bold tabular-nums">{totalDone}/{totalTopics} topics</span>
        </div>
        <div className="flex gap-4 mt-3 text-xs font-semibold opacity-80">
          {streak > 0 && <span className="flex items-center gap-1"><Flame className="w-3 h-3" aria-hidden /> {streak} day streak</span>}
          {points > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3" aria-hidden /> {points.toLocaleString()} pts</span>}
          <span>{sorted.length} subjects</span>
        </div>
      </div>

      <SummaryBar subjects={sorted} streak={streak} points={points} />
      <Legend />

      <div className="flex flex-col gap-8">
        {sorted.slice(0, visibleCount).map((s) => (
          <SubjectLane key={s.subjectId} subject={s} />
        ))}
      </div>
    </section>
  )
}
