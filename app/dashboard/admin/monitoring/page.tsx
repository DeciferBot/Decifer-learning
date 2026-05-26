// Admin monitoring page — Phase 12.
// Shows flagged questions, open child reports, question status breakdown.
// Admin-only. Rendered server-side.

import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import Link from 'next/link'
import { MonitoringActions } from './MonitoringActions'
import { RegenerateButton } from './RegenerateButton'

export const metadata = { title: 'Monitoring — Admin' }
export const dynamic  = 'force-dynamic'

export default async function MonitoringPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || getUserRole(user) !== 'admin') notFound()

  const res  = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring`, {
    headers: { Cookie: (await import('next/headers')).cookies().toString() },
    cache:   'no-store',
  })
  const data = await res.json() as {
    questionStats:    { published: number; staged: number; flagged: number; regenerating: number }
    flaggedQuestions: Array<{ id: string; questionText: string; topicTitle: string; subjectName: string }>
    openReports:      Array<{ id: string; questionId: string; questionText: string; topicTitle: string; childName: string; reason: string; createdAt: string }>
    recentActivity7d: number
  }

  const { questionStats, flaggedQuestions, openReports, recentActivity7d } = data

  return (
    <section className="space-y-6 max-w-3xl mx-auto px-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink">Monitoring</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RegenerateButton />
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">← Admin</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Published', value: questionStats.published, colour: 'text-correct' },
          { label: 'Staged',    value: questionStats.staged,    colour: 'text-muted'   },
          { label: 'Flagged',   value: questionStats.flagged,   colour: 'text-incorrect' },
          { label: 'Quizzes 7d', value: recentActivity7d,       colour: 'text-brand'   },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/5 bg-surface p-4 text-center shadow-sm">
            <p className={`font-heading text-2xl font-bold ${s.colour}`}>{s.value.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Open child reports */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">
          Open reports ({openReports.length})
        </h2>
        {openReports.length === 0 ? (
          <p className="text-sm text-muted">No open reports. ✓</p>
        ) : (
          <div className="space-y-2">
            {openReports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted mb-0.5">{r.topicTitle} · {r.childName}</p>
                    <p className="text-sm font-medium text-ink leading-snug">&ldquo;{r.questionText}&rdquo;</p>
                    <p className="mt-1 text-xs text-muted italic">Report: {r.reason}</p>
                  </div>
                  <MonitoringActions reportId={r.id} questionId={r.questionId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flagged questions */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">
          Flagged questions ({flaggedQuestions.length})
        </h2>
        {flaggedQuestions.length === 0 ? (
          <p className="text-sm text-muted">No flagged questions. ✓</p>
        ) : (
          <div className="space-y-2">
            {flaggedQuestions.map((q) => (
              <div key={q.id} className="flex items-start gap-3 rounded-2xl border border-incorrect/20 bg-incorrect/5 p-4 shadow-sm">
                <span className="flex-none text-base">🚩</span>
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">{q.subjectName} · {q.topicTitle}</p>
                  <p className="text-sm text-ink leading-snug">{q.questionText}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
