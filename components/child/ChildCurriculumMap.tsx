'use client'

/**
 * ChildCurriculumMap — child dashboard visual year overview.
 * Shows every subject and topic with status + Learn/Practise/Quiz action buttons.
 * Mobile: stacked lanes, horizontal card scroll.
 * Desktop (lg+): 3-column grid per subject.
 */

import Link from 'next/link'
import type { CurriculumSubject, CurriculumTopic } from '@/lib/parent-dashboard'

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

function statusMeta(topic: CurriculumTopic, subjectName: string) {
  const col = c(subjectName)
  const score = topic.lastScore ?? 0
  if (topic.progressStatus === 'not_started')
    return { icon: '○', label: 'Not started', ring: 'border border-gray-200/80', bg: col.light.replace('bg-[#', 'bg-[#').replace(']', ']/40'), badge: 'bg-gray-100 text-gray-400' }
  if (topic.progressStatus === 'in_progress')
    return { icon: '◐', label: 'In progress',  ring: 'border-solid', bg: '',          badge: 'bg-[#6C9EFF]/15 text-[#6C9EFF]' }
  if (score >= 0.95)
    return { icon: '★', label: 'Excelled!',    ring: 'border-solid border-[#FFC107]', bg: 'bg-[#FFFBEA]', badge: 'bg-[#FFC107]/20 text-[#B45309]' }
  if (score >= 0.70)
    return { icon: '✓', label: 'Passed',       ring: 'border-solid border-[#40C057]', bg: 'bg-[#F0FDF4]', badge: 'bg-[#40C057]/15 text-[#166534]' }
  return   { icon: '!', label: 'Try again',    ring: 'border-solid border-[#FF6B6B]', bg: 'bg-[#FFF5F5]', badge: 'bg-[#FF6B6B]/15 text-[#B91C1C]' }
}

// ─── Topic card ──────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  subjectName,
  hasPractice,
}: {
  topic: CurriculumTopic
  subjectName: string
  hasPractice?: boolean
}) {
  const col = c(subjectName)
  const st  = statusMeta(topic, subjectName)
  const score = topic.lastScore ?? 0
  const excelled = topic.progressStatus === 'completed' && score >= 0.95

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

      {/* progress bar for in-progress */}
      {topic.progressStatus === 'in_progress' && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${col.bg} opacity-80`}
            style={{ width: `${Math.max(10, Math.round((score || 0.2) * 100))}%` }} />
        </div>
      )}

      {/* score */}
      {topic.progressStatus === 'completed' && (
        <p className={`text-xs font-bold ${st.badge.split(' ')[1]}`}>
          {Math.round(score * 100)}% {excelled ? '🌟' : score >= 0.70 ? '✓' : '— try again'}
        </p>
      )}

      {/* parent-assigned flag */}
      {topic.isAssigned && (
        <span className="text-[10px] font-semibold text-[#FF9F43]">📌 Focus topic</span>
      )}

      {/* action buttons */}
      <div className="flex gap-1.5 mt-auto">
        <Link
          href={`/topics/${topic.topicId}/learn`}
          className={`flex-1 min-h-[36px] flex items-center justify-center rounded-xl text-[11px] font-bold transition-colors ${col.btnBg}`}
        >
          📖 Learn
        </Link>
        {hasPractice && (
          <Link
            href={`/topics/${topic.topicId}/practise`}
            className="flex-1 min-h-[36px] flex items-center justify-center rounded-xl text-[11px] font-bold bg-[#52D9A0]/10 hover:bg-[#52D9A0]/20 text-[#52D9A0] transition-colors"
          >
            ✏️ Practise
          </Link>
        )}
        <Link
          href={`/topics/${topic.topicId}/quiz`}
          className="flex-1 min-h-[36px] flex items-center justify-center rounded-xl text-[11px] font-bold bg-[#FFD43B]/20 hover:bg-[#FFD43B]/35 text-[#92400E] transition-colors"
        >
          ⚡ Quiz
        </Link>
      </div>
    </div>
  )
}

// ─── Subject lane ─────────────────────────────────────────────────────────────

// topicPracticeMap: topicId → hasPractice
function SubjectLane({
  subject,
  practiceMap,
}: {
  subject: CurriculumSubject
  practiceMap: Map<string, boolean>
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
            <TopicCard topic={t} subjectName={subject.subjectName} hasPractice={practiceMap.get(t.topicId)} />
          </div>
        ))}
      </div>

      {/* desktop: 3-col grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-3">
        {subject.topics.map((t) => (
          <TopicCard key={t.topicId} topic={t} subjectName={subject.subjectName} hasPractice={practiceMap.get(t.topicId)} />
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
    { label: '⚡ In progress', value: inProg,                  sub: 'keep going!',           colour: 'text-[#6C9EFF]' },
    { label: '🌟 Excelled',   value: excelled,                 sub: '95%+ score',            colour: 'text-[#B45309]' },
    { label: '🔥 Streak',     value: streak,                   sub: 'days in a row',         colour: 'text-[#FF9F43]' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
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
    { icon: '○', bg: 'bg-gray-100',       text: 'text-gray-400',   label: 'Not started' },
    { icon: '◐', bg: 'bg-[#6C9EFF]/15',  text: 'text-[#6C9EFF]', label: 'In progress' },
    { icon: '✓', bg: 'bg-[#40C057]/15',  text: 'text-[#166534]', label: 'Passed' },
    { icon: '★', bg: 'bg-[#FFC107]/20',  text: 'text-[#B45309]', label: 'Excelled' },
    { icon: '!', bg: 'bg-[#FF6B6B]/15',  text: 'text-[#B91C1C]', label: 'Try again' },
  ]
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i.bg} ${i.text}`}>{i.icon}</span>
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
  practiceMap = new Map(),
}: {
  subjects: CurriculumSubject[]
  displayName: string
  yearLabel: string
  streak?: number
  points?: number
  practiceMap?: Map<string, boolean>
}) {
  const sorted = sortSubjects(subjects)
  const totalTopics = sorted.reduce((n, s) => n + s.totalCount, 0)
  const totalDone   = sorted.reduce((n, s) => n + s.completedCount, 0)
  const pct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0

  return (
    <section className="w-full">
      {/* hero banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#6C9EFF] to-[#A78BFA] p-5 mb-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">{yearLabel} · Your full curriculum</p>
        <h2 className="text-2xl font-extrabold leading-tight mb-3">
          {totalDone === 0 ? `Let's get started, ${displayName}! 🚀` : `Keep going, ${displayName}! 🌟`}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-bold tabular-nums">{totalDone}/{totalTopics} topics</span>
        </div>
        <div className="flex gap-4 mt-3 text-xs font-semibold opacity-80">
          {streak > 0 && <span>🔥 {streak} day streak</span>}
          {points > 0 && <span>⭐ {points.toLocaleString()} pts</span>}
          <span>{sorted.length} subjects</span>
        </div>
      </div>

      <SummaryBar subjects={sorted} streak={streak} points={points} />
      <Legend />

      <div className="flex flex-col gap-8">
        {sorted.map((s) => (
          <SubjectLane key={s.subjectId} subject={s} practiceMap={practiceMap} />
        ))}
      </div>
    </section>
  )
}
