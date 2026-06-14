'use client'

import { useState, useCallback, useRef } from 'react'
import type { CurriculumSubject, CurriculumTopic, CurriculumOutcomeItem } from '@/lib/parent-dashboard'
import { MapPin, Check, ChevronRight } from '@/components/ui/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  subjects:       CurriculumSubject[]
  childName:      string
  childProfileId: string
  yearGroupLabel: string | null
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function tileBg(topic: CurriculumTopic): string {
  if (topic.progressStatus === 'completed') {
    const score = topic.lastScore ?? 1
    if (score >= 0.85) return '#40C057'   // correct — bright green
    if (score >= 0.70) return '#74C0FC'   // explorer blue — good pass
    return '#A8E6CF'                       // sprout — completed but weak
  }
  if (topic.progressStatus === 'in_progress') return '#FFD43B'  // lightning amber
  return '#EEF0F5'                                               // not started
}

function tileText(topic: CurriculumTopic): string {
  if (topic.progressStatus === 'completed') return '#FFFFFF'
  if (topic.progressStatus === 'in_progress') return '#5C4200'
  return '#9BA3B2'
}

function tileBorder(topic: CurriculumTopic): string {
  if (topic.isAssigned && topic.progressStatus !== 'completed') return '#FFC107'
  if (topic.progressStatus === 'completed') return 'transparent'
  if (topic.progressStatus === 'in_progress') return '#FCBA03'
  return '#DDE1EA'
}

// ── Zoom levels ───────────────────────────────────────────────────────────────

const ZOOM_SIZES = [
  { label: 'Overview',  tileW: 56,  tileH: 48,  showLabel: false },
  { label: 'Normal',    tileW: 90,  tileH: 76,  showLabel: true  },
  { label: 'Detail',    tileW: 130, tileH: 100, showLabel: true  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function SyllabusHeatmap({ subjects, childName, childProfileId, yearGroupLabel }: Props) {
  const [zoom, setZoom]               = useState(1)            // 0 | 1 | 2
  const [selected, setSelected]       = useState<CurriculumTopic | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<CurriculumSubject | null>(null)
  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    () => new Set(subjects.flatMap(s => s.topics.filter(t => t.isAssigned).map(t => t.topicId)))
  )
  const [assigning, setAssigning]     = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalTopics    = subjects.reduce((n, s) => n + s.totalCount, 0)
  const completedCount = subjects.reduce((n, s) => n + s.completedCount, 0)
  const inProgressCount = subjects.reduce((n, s) => n + s.topics.filter(t => t.progressStatus === 'in_progress').length, 0)
  const pct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0

  const { tileW, tileH, showLabel } = ZOOM_SIZES[zoom]

  const openTopic = useCallback((topic: CurriculumTopic, subj: CurriculumSubject) => {
    setSelected(topic)
    setSelectedSubject(subj)
  }, [])

  const closeModal = useCallback(() => {
    setSelected(null)
    setSelectedSubject(null)
  }, [])

  async function toggleAssign(topicId: string) {
    if (assigning) return
    setAssigning(true)
    try {
      const isCurrentlyAssigned = assignedIds.has(topicId)
      if (isCurrentlyAssigned) {
        const res = await fetch(
          `/api/parent/assign-topic?childProfileId=${childProfileId}&topicId=${topicId}`,
          { method: 'DELETE' }
        )
        if (res.ok) {
          setAssignedIds(prev => { const s = new Set(prev); s.delete(topicId); return s })
          if (selected?.topicId === topicId) setSelected(p => p ? { ...p, isAssigned: false } : p)
        }
      } else {
        const res = await fetch('/api/parent/assign-topic', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ childProfileId, topicId }),
        })
        if (res.ok) {
          setAssignedIds(prev => new Set([...prev, topicId]))
          if (selected?.topicId === topicId) setSelected(p => p ? { ...p, isAssigned: true } : p)
        }
      }
    } finally {
      setAssigning(false)
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
        <h2 className="font-heading text-base font-bold text-ink">Full Syllabus Map</h2>
        <p className="mt-1 text-sm text-muted">No topics published for {yearGroupLabel ?? 'this year group'} yet.</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface shadow-sm overflow-hidden">

        {/* Header bar */}
        <div
          className="px-5 py-4"
          style={{ background: 'linear-gradient(135deg, #1A1F2E 0%, #252B3B 100%)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-0.5">
                Full Syllabus Map
              </p>
              <h2 className="font-heading text-lg font-bold text-white leading-tight">
                {yearGroupLabel} · {childName}
              </h2>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              {ZOOM_SIZES.map((z, i) => (
                <button
                  key={i}
                  onClick={() => setZoom(i)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    zoom === i
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                  aria-label={`Zoom: ${z.label}`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-correct" />
              <span className="text-xs text-white/70">{completedCount} done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-lightning" />
              <span className="text-xs text-white/70">{inProgressCount} in progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-white/20" />
              <span className="text-xs text-white/70">{totalTopics - completedCount - inProgressCount} not started</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="font-heading text-sm font-bold text-white">{pct}%</span>
              <span className="text-xs text-white/50">complete</span>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-correct transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 border-b border-black/5 px-4 py-2 overflow-x-auto">
          {(['all', 'not_started', 'in_progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`flex-none rounded-lg px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                filterStatus === f
                  ? 'bg-ink text-white'
                  : 'text-muted hover:text-ink hover:bg-black/5'
              }`}
            >
              {f === 'all' ? 'All topics' : f === 'not_started' ? 'Not started' : f === 'in_progress' ? 'In progress' : 'Completed'}
            </button>
          ))}
          {assignedIds.size > 0 && (
            <span className="ml-auto flex-none rounded-lg bg-points-gold/15 px-3 py-1 text-xs font-semibold text-points-gold-700 flex items-center gap-1">
              <MapPin className="w-3 h-3" aria-hidden /> {assignedIds.size} assigned
            </span>
          )}
        </div>

        {/* Heatmap grid */}
        <div ref={scrollRef} className="overflow-x-auto p-4 space-y-6">
          {subjects.map((subj) => {
            const filtered = filterStatus === 'all'
              ? subj.topics
              : subj.topics.filter(t => t.progressStatus === filterStatus)
            if (filtered.length === 0) return null

            return (
              <div key={subj.subjectId}>
                {/* Subject label */}
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 flex-none rounded-full"
                      style={{ backgroundColor: subj.colourToken }}
                    />
                    <span className="font-heading text-sm font-bold text-ink">{subj.subjectName}</span>
                    <span className="text-xs text-muted">{subj.completedCount}/{subj.totalCount}</span>
                  </div>
                  {/* Subject mini progress bar */}
                  <div className="flex-1 max-w-[120px] h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${subj.totalCount > 0 ? (subj.completedCount / subj.totalCount) * 100 : 0}%`,
                        backgroundColor: subj.colourToken,
                      }}
                    />
                  </div>
                </div>

                {/* Topic tiles */}
                <div
                  className="flex flex-wrap gap-1.5"
                  style={{ minWidth: 0 }}
                >
                  {filtered.map((topic) => {
                    const isAssigned = assignedIds.has(topic.topicId)
                    const bg     = tileBg(topic)
                    const color  = tileText(topic)
                    const border = isAssigned && topic.progressStatus !== 'completed'
                      ? '#FFC107'
                      : tileBorder(topic)

                    return (
                      <button
                        key={topic.topicId}
                        onClick={() => openTopic(topic, subj)}
                        className="relative rounded-xl text-left transition-all duration-150 hover:scale-105 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-maths"
                        style={{
                          width:       tileW,
                          height:      tileH,
                          minWidth:    tileW,
                          background:  bg,
                          borderWidth: isAssigned ? 2 : 1,
                          borderStyle: 'solid',
                          borderColor: border,
                          padding:     '6px 7px',
                        }}
                        title={topic.title}
                        aria-label={`${topic.title} — ${topic.progressStatus.replace('_', ' ')}`}
                      >
                        {/* Assigned pin */}
                        {isAssigned && (
                          <span
                            className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
                            style={{ background: '#FFC107' }}
                            aria-label="Assigned"
                          >
                            <MapPin className="w-2.5 h-2.5 text-white" aria-hidden />
                          </span>
                        )}

                        {/* Score badge (completed) */}
                        {topic.progressStatus === 'completed' && topic.lastScore !== null && (
                          <span
                            className="absolute bottom-1.5 right-1.5 rounded-md px-1 text-[9px] font-bold"
                            style={{ background: 'rgba(0,0,0,0.18)', color: '#FFFFFF' }}
                          >
                            {Math.round(topic.lastScore * 100)}%
                          </span>
                        )}

                        {/* In-progress bar */}
                        {topic.progressStatus === 'in_progress' && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
                            style={{ background: '#F59E0B' }}
                          />
                        )}

                        {/* Label */}
                        {showLabel && (
                          <p
                            className="text-[10px] font-semibold leading-tight"
                            style={{
                              color,
                              display:           '-webkit-box',
                              WebkitLineClamp:   tileW >= 120 ? 3 : 2,
                              WebkitBoxOrient:   'vertical',
                              overflow:          'hidden',
                              wordBreak:         'break-word',
                            }}
                          >
                            {topic.title}
                          </p>
                        )}

                        {/* Compact view: status icon only */}
                        {!showLabel && (
                          <div className="flex h-full items-center justify-center">
                            <span className="flex items-center justify-center" aria-hidden>
                              {topic.progressStatus === 'completed'
                                ? <Check className="w-3.5 h-3.5" />
                                : topic.progressStatus === 'in_progress'
                                  ? <ChevronRight className="w-3.5 h-3.5" />
                                  : '·'}
                            </span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="border-t border-black/5 px-4 py-3 flex flex-wrap gap-3">
          {[
            { color: '#40C057', label: 'Completed (85%+)' },
            { color: '#74C0FC', label: 'Completed (70–85%)' },
            { color: '#A8E6CF', label: 'Completed (<70%)' },
            { color: '#FFD43B', label: 'In progress' },
            { color: '#EEF0F5', label: 'Not started', border: '#DDE1EA' },
            { color: '#FFC107', label: 'Assigned focus', border: '#FFC107' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 flex-none rounded-sm"
                style={{
                  background:   l.color,
                  border:       l.border ? `1.5px solid ${l.border}` : undefined,
                }}
              />
              <span className="text-[11px] text-muted">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Topic detail modal ─────────────────────────────────────────────── */}
      {selected && selectedSubject && (
        <TopicModal
          topic={selected}
          subject={selectedSubject}
          childName={childName}
          isAssigned={assignedIds.has(selected.topicId)}
          assigning={assigning}
          onClose={closeModal}
          onToggleAssign={() => toggleAssign(selected.topicId)}
        />
      )}
    </>
  )
}

// ── Topic detail modal ────────────────────────────────────────────────────────

function TopicModal({
  topic,
  subject,
  childName,
  isAssigned,
  assigning,
  onClose,
  onToggleAssign,
}: {
  topic:           CurriculumTopic
  subject:         CurriculumSubject
  childName:       string
  isAssigned:      boolean
  assigning:       boolean
  onClose:         () => void
  onToggleAssign:  () => void
}) {
  const statusLabel = topic.progressStatus === 'completed'
    ? 'Completed'
    : topic.progressStatus === 'in_progress'
      ? 'In progress'
      : 'Not started yet'

  const statusColor = topic.progressStatus === 'completed'
    ? 'bg-correct/15 text-correct'
    : topic.progressStatus === 'in_progress'
      ? 'bg-lightning/30 text-amber-700'
      : 'bg-black/5 text-muted'

  // Group outcomes by domain
  const domainMap = new Map<string, CurriculumOutcomeItem[]>()
  for (const o of topic.outcomes) {
    if (!domainMap.has(o.domain)) domainMap.set(o.domain, [])
    domainMap.get(o.domain)!.push(o)
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(15, 18, 30, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-surface shadow-2xl"
        style={{ animation: 'slideUp 0.22s ease-out' }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        {/* Coloured subject stripe */}
        <div
          className="mx-4 mt-2 mb-0 h-1 rounded-full"
          style={{ background: subject.colourToken }}
        />

        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted mb-0.5">{subject.subjectName}</p>
              <h3 className="font-heading text-xl font-bold text-ink leading-tight">{topic.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="flex-none rounded-xl bg-black/5 p-2 text-muted hover:bg-black/10 hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Status + score row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColor}`}>
              {statusLabel}
            </span>
            {topic.progressStatus === 'completed' && topic.lastScore !== null && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                topic.lastScore >= 0.85
                  ? 'bg-correct/15 text-correct'
                  : topic.lastScore >= 0.70
                    ? 'bg-maths/15 text-maths'
                    : 'bg-incorrect/10 text-incorrect'
              }`}>
                {Math.round(topic.lastScore * 100)}% last score
              </span>
            )}
            {topic.completedAt && (
              <span className="text-xs text-muted">
                Completed {new Date(topic.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {/* NC Outcomes */}
        <div className="px-5 pb-2">
          {topic.outcomes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                National Curriculum outcomes
              </p>
              {Array.from(domainMap.entries()).map(([domain, outcomes]) => (
                <div key={domain}>
                  <p
                    className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: subject.colourToken }}
                  >
                    {domain}
                  </p>
                  <ul className="space-y-2">
                    {outcomes.map((o) => (
                      <li key={o.id} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
                          style={{ backgroundColor: subject.colourToken }}
                        />
                        <p className="text-sm text-ink leading-relaxed">{o.statutoryOutcome}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-black/[0.03] px-4 py-3">
              <p className="text-sm text-muted">
                National Curriculum statements for this topic will appear here once mapped.
              </p>
            </div>
          )}
        </div>

        {/* Assign button */}
        <div className="sticky bottom-0 bg-surface border-t border-black/5 px-5 py-4">
          {topic.progressStatus === 'completed' ? (
            <div className="rounded-xl bg-correct/8 border border-correct/15 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-correct flex items-center justify-center gap-1">
                <Check className="w-4 h-4" aria-hidden /> {childName} has completed this topic
              </p>
              {topic.lastScore !== null && (
                <p className="text-xs text-muted mt-0.5">Last score: {Math.round(topic.lastScore * 100)}%</p>
              )}
            </div>
          ) : (
            <button
              onClick={onToggleAssign}
              disabled={assigning}
              className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                isAssigned
                  ? 'bg-points-gold/15 text-points-gold-700 border border-points-gold/30 hover:bg-points-gold/25'
                  : 'text-white hover:opacity-90'
              }`}
              style={isAssigned ? {} : { background: 'linear-gradient(135deg, #1A1F2E 0%, #2D3748 100%)' }}
            >
              {assigning
                ? '…'
                : isAssigned
                  ? <span className="flex items-center justify-center gap-1.5"><MapPin className="w-4 h-4" aria-hidden /> Remove focus assignment</span>
                  : <span className="flex items-center justify-center gap-1.5"><MapPin className="w-4 h-4" aria-hidden /> Assign as focus topic for {childName}</span>}
            </button>
          )}
          <p className="mt-2 text-center text-xs text-muted">
            {isAssigned && topic.progressStatus !== 'completed'
              ? `${childName} will see this highlighted as a priority on their dashboard.`
              : topic.progressStatus !== 'completed'
                ? 'Assigned topics appear as priority missions on the child\'s dashboard.'
                : ''}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
