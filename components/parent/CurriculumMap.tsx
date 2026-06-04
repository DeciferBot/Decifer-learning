'use client'

/**
 * CurriculumMap — parent dashboard visual curriculum overview.
 * Designed to sit inside a wider layout — no internal heading or summary bar
 * (those live in the parent card above it).
 *
 * Mobile:  stacked subject lanes, horizontal card scroll per lane.
 * Desktop: 3-column topic card grid per subject.
 */

import { useState } from 'react'
import type { CurriculumSubject, CurriculumTopic } from '@/lib/parent-dashboard'

// ─── canonical subject order ─────────────────────────────────────────────────
const SUBJECT_ORDER = ['Maths', 'English', 'Science', 'Geography', 'History']
function sortSubjects(subjects: CurriculumSubject[]): CurriculumSubject[] {
  return [...subjects].sort((a, b) => {
    const ia = SUBJECT_ORDER.indexOf(a.subjectName)
    const ib = SUBJECT_ORDER.indexOf(b.subjectName)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

// ─── colours ─────────────────────────────────────────────────────────────────
const COLS: Record<string, { bg: string; border: string; text: string; pill: string; light: string; dot: string; warmBg: string }> = {
  Maths:     { bg: 'bg-[#6C9EFF]', border: 'border-[#6C9EFF]', text: 'text-[#6C9EFF]', pill: 'bg-[#6C9EFF]/15', light: 'bg-[#EEF3FF]', dot: '#6C9EFF', warmBg: 'bg-[#F4F7FF]' },
  English:   { bg: 'bg-[#FF8FAB]', border: 'border-[#FF8FAB]', text: 'text-[#FF8FAB]', pill: 'bg-[#FF8FAB]/15', light: 'bg-[#FFF0F4]', dot: '#FF8FAB', warmBg: 'bg-[#FFF5F8]' },
  Science:   { bg: 'bg-[#52D9A0]', border: 'border-[#52D9A0]', text: 'text-[#52D9A0]', pill: 'bg-[#52D9A0]/15', light: 'bg-[#EDFAF4]', dot: '#52D9A0', warmBg: 'bg-[#F2FBF7]' },
  Geography: { bg: 'bg-[#FF9F43]', border: 'border-[#FF9F43]', text: 'text-[#FF9F43]', pill: 'bg-[#FF9F43]/15', light: 'bg-[#FFF5EB]', dot: '#FF9F43', warmBg: 'bg-[#FFF8F2]' },
  History:   { bg: 'bg-[#A78BFA]', border: 'border-[#A78BFA]', text: 'text-[#A78BFA]', pill: 'bg-[#A78BFA]/15', light: 'bg-[#F3EFFE]', dot: '#A78BFA', warmBg: 'bg-[#F7F4FF]' },
}
const fallback = { bg: 'bg-gray-400', border: 'border-gray-300', text: 'text-gray-500', pill: 'bg-gray-100', light: 'bg-gray-50', dot: '#9CA3AF', warmBg: 'bg-gray-50' }
function col(name: string) { return COLS[name] ?? fallback }

// ─── status ───────────────────────────────────────────────────────────────────
function getStatus(topic: CurriculumTopic, subjectName: string) {
  const c = col(subjectName)
  const score = topic.lastScore ?? 0
  if (topic.progressStatus === 'not_started')
    return { label: 'Not started', icon: '○', cardBg: c.warmBg,       cardBorder: 'border border-gray-200/80',          badgeBg: 'bg-gray-100',        badgeText: 'text-gray-400' }
  if (topic.progressStatus === 'in_progress')
    return { label: 'In progress', icon: '◐', cardBg: c.light,        cardBorder: `border-2 border-solid ${c.border}`,  badgeBg: c.pill,               badgeText: c.text }
  if (score >= 0.95)
    return { label: 'Excelled ⭐', icon: '★', cardBg: 'bg-[#FFFBEA]', cardBorder: 'border-2 border-solid border-[#FFC107]', badgeBg: 'bg-[#FFC107]/20', badgeText: 'text-[#B45309]' }
  if (score >= 0.70)
    return { label: 'Passed',      icon: '✓', cardBg: 'bg-[#F0FDF4]', cardBorder: 'border-2 border-solid border-[#40C057]', badgeBg: 'bg-[#40C057]/15', badgeText: 'text-[#166534]' }
  return   { label: 'Needs support', icon: '!', cardBg: 'bg-[#FFF5F5]', cardBorder: 'border-2 border-solid border-[#FF6B6B]', badgeBg: 'bg-[#FF6B6B]/15', badgeText: 'text-[#B91C1C]' }
}

// ─── Topic card ───────────────────────────────────────────────────────────────
function TopicCard({ topic, subjectName }: { topic: CurriculumTopic; subjectName: string }) {
  const c = col(subjectName)
  const st = getStatus(topic, subjectName)
  const score = topic.lastScore ?? 0
  const scoreLabel = topic.progressStatus === 'completed' ? `${Math.round(score * 100)}%` : null
  const isExcelled = topic.progressStatus === 'completed' && score >= 0.95
  const isFailed   = topic.progressStatus === 'completed' && score < 0.70

  return (
    <div className={`
      relative flex flex-col gap-2 rounded-2xl p-3.5
      transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
      ${st.cardBg} ${st.cardBorder}
      ${isExcelled ? 'shadow-[0_0_14px_rgba(255,193,7,0.25)]' : ''}
    `}>
      <span className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${st.badgeBg} ${st.badgeText}`}>
        {st.icon}
      </span>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      <p className="text-[12px] font-semibold text-[#2D3748] leading-snug pr-6 flex-1">{topic.title}</p>
      {topic.progressStatus === 'in_progress' && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${c.bg} opacity-80`} style={{ width: `${Math.max(10, Math.round((score || 0.2) * 100))}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.badgeBg} ${st.badgeText}`}>{st.label}</span>
        {scoreLabel && <span className={`text-[11px] font-bold ${st.badgeText}`}>{scoreLabel}</span>}
      </div>
      {isFailed && <span className="text-[10px] text-[#B91C1C] font-medium">⚠ Review recommended</span>}
      {topic.isAssigned && <span className="text-[10px] text-[#FF9F43] font-semibold">📌 Parent focus</span>}
    </div>
  )
}

// ─── Subject lane ─────────────────────────────────────────────────────────────
function SubjectLane({ subject }: { subject: CurriculumSubject }) {
  const c = col(subject.subjectName)
  const pct = subject.totalCount > 0 ? Math.round((subject.completedCount / subject.totalCount) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.bg}`} />
        <h3 className={`font-extrabold text-xs tracking-widest uppercase ${c.text}`}>{subject.subjectName}</h3>
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-400 font-medium tabular-nums">{subject.completedCount}/{subject.totalCount}</span>
        <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${c.bg}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {/* mobile scroll */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 lg:hidden">
        {subject.topics.map((t) => (
          <div key={t.topicId} className="flex-shrink-0 w-44"><TopicCard topic={t} subjectName={subject.subjectName} /></div>
        ))}
      </div>
      {/* desktop 3-col grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-2.5">
        {subject.topics.map((t) => <TopicCard key={t.topicId} topic={t} subjectName={subject.subjectName} />)}
      </div>
    </div>
  )
}

// ─── Weak areas ───────────────────────────────────────────────────────────────
function WeakAreasPanel({ subjects, childProfileId }: { subjects: CurriculumSubject[]; childProfileId?: string }) {
  const weak = subjects.flatMap((s) =>
    s.topics.filter((t) => t.progressStatus === 'completed' && (t.lastScore ?? 1) < 0.70).map((t) => ({ ...t, subjectName: s.subjectName }))
  )
  const [assignedIds, setAssignedIds] = useState<Set<string>>(() => new Set(weak.filter((t) => t.isAssigned).map((t) => t.topicId)))
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (weak.length === 0) return null

  async function toggleAssign(topicId: string) {
    if (!childProfileId) return
    const isAssigned = assignedIds.has(topicId)
    setLoadingId(topicId)
    try {
      const method = isAssigned ? 'DELETE' : 'POST'
      await fetch('/api/parent/assign-topic', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childProfileId, topicId }),
      })
      setAssignedIds((prev) => {
        const next = new Set(prev)
        isAssigned ? next.delete(topicId) : next.add(topicId)
        return next
      })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-[#FF6B6B]/25 bg-[#FFF5F5] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>⚠️</span>
        <h3 className="font-extrabold text-[#B91C1C] text-xs tracking-widest uppercase">Needs support</h3>
        <span className="ml-auto text-xs text-[#B91C1C]/70 bg-[#FF6B6B]/15 px-2 py-0.5 rounded-full font-semibold">{weak.length} topic{weak.length !== 1 ? 's' : ''}</span>
      </div>
      {childProfileId && (
        <p className="mb-3 text-[11px] text-[#B91C1C]/70">Tap 📌 to pin a topic for your child — it appears on their dashboard as a focus area.</p>
      )}
      <div className="flex flex-col gap-1.5">
        {weak.map((t) => {
          const c = col(t.subjectName)
          const assigned = assignedIds.has(t.topicId)
          const loading = loadingId === t.topicId
          return (
            <div key={t.topicId} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-[#FF6B6B]/15">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.bg}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#2D3748] truncate">{t.title}</p>
                <p className={`text-[10px] ${c.text} font-medium`}>{t.subjectName}</p>
              </div>
              <span className="text-sm font-bold text-[#B91C1C]">{Math.round((t.lastScore ?? 0) * 100)}%</span>
              {childProfileId && (
                <button
                  onClick={() => toggleAssign(t.topicId)}
                  disabled={loading}
                  title={assigned ? 'Remove focus' : 'Assign for review'}
                  className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border text-sm font-bold transition-colors ${
                    assigned
                      ? 'border-[#FF9F43] bg-[#FF9F43]/15 text-[#FF9F43]'
                      : 'border-black/10 bg-white text-muted hover:bg-[#FF9F43]/10 hover:border-[#FF9F43] hover:text-[#FF9F43]'
                  } ${loading ? 'opacity-50' : ''}`}
                >
                  {loading ? '…' : assigned ? '📌' : '＋'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { icon: '○', bg: 'bg-gray-100',      text: 'text-gray-400',   label: 'Not started' },
    { icon: '◐', bg: 'bg-[#6C9EFF]/15', text: 'text-[#6C9EFF]', label: 'In progress' },
    { icon: '✓', bg: 'bg-[#40C057]/15', text: 'text-[#166534]', label: 'Passed' },
    { icon: '★', bg: 'bg-[#FFC107]/20', text: 'text-[#B45309]', label: 'Excelled' },
    { icon: '!', bg: 'bg-[#FF6B6B]/15', text: 'text-[#B91C1C]', label: 'Needs support' },
  ]
  return (
    <div className="flex flex-wrap gap-2.5 mb-5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${i.bg} ${i.text}`}>{i.icon}</span>
          <span className="text-[11px] text-gray-400 font-medium">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CurriculumMap({ subjects, childProfileId }: { subjects: CurriculumSubject[]; childProfileId?: string }) {
  const sorted = sortSubjects(subjects)
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-sm text-[#2D3748] uppercase tracking-widest">Full curriculum</h3>
        <Legend />
      </div>
      <div className="flex flex-col gap-6">
        {sorted.map((s) => <SubjectLane key={s.subjectId} subject={s} />)}
      </div>
      <WeakAreasPanel subjects={sorted} childProfileId={childProfileId} />
    </div>
  )
}
