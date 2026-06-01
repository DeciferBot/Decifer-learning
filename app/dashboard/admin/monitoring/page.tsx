// Admin monitoring page.
// Queries Prisma directly — no self-HTTP-fetch anti-pattern.

import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { MonitoringActions } from './MonitoringActions'
import { RegenerateButton } from './RegenerateButton'
import { Flag } from '@/components/ui/icons'

export const metadata = { title: 'Monitoring — Admin' }
export const revalidate = 30

export default async function MonitoringPage() {
  await requireAdmin('/dashboard/admin/monitoring')

  const [questionCounts, flaggedQuestions, recentActivity] = await Promise.all([
    prisma.quizQuestion.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.quizQuestion.findMany({
      where: { status: 'flagged' },
      select: {
        id: true, question_text: true,
        topic: { select: { title: true, subject: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.quizAttempt.count({
      where: { created_at: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
  ])

  const openReports = await prisma.questionReport.findMany({
    where: { status: 'open' },
    include: {
      question: { select: { id: true, question_text: true, topic: { select: { title: true } } } },
      profile: { select: { display_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 30,
  }).catch(() => [])

  const countMap = Object.fromEntries(questionCounts.map((r) => [r.status, r._count._all]))
  const questionStats = {
    published: countMap.published ?? 0,
    staged: countMap.staged ?? 0,
    flagged: countMap.flagged ?? 0,
    regenerating: countMap.regenerating ?? 0,
  }

  return (
    <section className="space-y-6 max-w-3xl mx-auto px-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink">Monitoring</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RegenerateButton />
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">← Admin</Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Published',  value: questionStats.published,  colour: 'text-correct'   },
          { label: 'Staged',     value: questionStats.staged,     colour: 'text-muted'     },
          { label: 'Flagged',    value: questionStats.flagged,    colour: 'text-incorrect' },
          { label: 'Quizzes 7d', value: recentActivity,          colour: 'text-brand'     },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/5 bg-surface p-4 text-center shadow-sm">
            <p className={`font-heading text-2xl font-bold ${s.colour}`}>{s.value.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">Open reports ({openReports.length})</h2>
        {openReports.length === 0 ? (
          <p className="text-sm text-muted">No open reports. ✓</p>
        ) : (
          <div className="space-y-2">
            {openReports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted mb-0.5">{r.question.topic.title} · {r.profile.display_name}</p>
                    <p className="text-sm font-medium text-ink leading-snug">&ldquo;{r.question.question_text}&rdquo;</p>
                    <p className="mt-1 text-xs text-muted italic">Report: {r.reason}</p>
                  </div>
                  <MonitoringActions reportId={r.id} questionId={r.question.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">Flagged questions ({flaggedQuestions.length})</h2>
        {flaggedQuestions.length === 0 ? (
          <p className="text-sm text-muted">No flagged questions. ✓</p>
        ) : (
          <div className="space-y-2">
            {flaggedQuestions.map((q) => (
              <div key={q.id} className="flex items-start gap-3 rounded-2xl border border-incorrect/20 bg-incorrect/5 p-4 shadow-sm">
                <Flag className="flex-none w-4 h-4 text-incorrect" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-muted mb-0.5">{q.topic.subject.name} · {q.topic.title}</p>
                  <p className="text-sm text-ink leading-snug">{q.question_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
