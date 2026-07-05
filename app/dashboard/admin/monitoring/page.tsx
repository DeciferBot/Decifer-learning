// Admin monitoring page.
// Queries Prisma directly — no self-HTTP-fetch anti-pattern.
export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { MonitoringActions } from './MonitoringActions'
import { RegenerateButton } from './RegenerateButton'
import { FlaggedQuestionActions } from './FlaggedQuestionActions'
import { RunAnomalyButton } from './RunAnomalyButton'
import { Flag, AlertTriangle } from '@/components/ui/icons'
import MathText from '@/components/ui/MathText'

export const metadata = { title: 'Monitoring | Admin' }
export const revalidate = 30

export default async function MonitoringPage() {
  await requireAdmin()

  const [questionCounts, flaggedQuestions, recentActivity, lastRun] = await Promise.all([
    prisma.quizQuestion.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.quizQuestion.findMany({
      where: { status: 'flagged' },
      select: {
        id: true, question_text: true, tier: true,
        correct_answer: true, distractors: true,
        hint_1: true, hint_2: true, hint_3: true,
        confidence_score: true, created_at: true,
        foundation_images: true, source_text: true, source_label: true,
        explanation: true,
        topic: { select: { title: true, subject: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.quizAttempt.count({
      where: { created_at: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.$queryRaw<{ ran_at: Date; result: Record<string, number> }[]>`
      SELECT ran_at, result FROM cron_run_log
      WHERE job = 'anomaly-detect'
      ORDER BY ran_at DESC LIMIT 5
    `.catch(() => []),
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

  // Compute per-question answer stats for flagged questions
  const flaggedIds = flaggedQuestions.map((q) => q.id)
  type AnswerStats = { question_id: string; total: bigint; wrong: bigint; hint3: bigint }
  const answerStats: AnswerStats[] = flaggedIds.length > 0
    ? await prisma.$queryRaw`
        SELECT
          question_id,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE was_correct = false) AS wrong,
          COUNT(*) FILTER (WHERE hint_number = 3) AS hint3
        FROM quiz_answers
        WHERE question_id = ANY(${flaggedIds}::uuid[])
        GROUP BY question_id
      `
    : []
  const statsMap = Object.fromEntries(
    answerStats.map((r) => [
      r.question_id,
      {
        total: Number(r.total),
        errorRate: Number(r.total) > 0 ? Number(r.wrong) / Number(r.total) : null,
        hint3Rate: Number(r.total) > 0 ? Number(r.hint3) / Number(r.total) : null,
      },
    ])
  )

  const countMap = Object.fromEntries(questionCounts.map((r) => [r.status, r._count._all]))
  const questionStats = {
    published:   countMap.published   ?? 0,
    staged:      countMap.staged      ?? 0,
    flagged:     countMap.flagged     ?? 0,
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Published',  value: questionStats.published,  colour: 'text-correct'   },
          { label: 'Staged',     value: questionStats.staged,     colour: 'text-muted'     },
          { label: 'Flagged',    value: questionStats.flagged,    colour: questionStats.flagged > 0 ? 'text-incorrect' : 'text-muted' },
          { label: 'Quizzes 7d', value: recentActivity,          colour: 'text-brand'     },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/5 bg-surface p-4 text-center shadow-sm">
            <p className={`font-heading text-2xl font-bold ${s.colour}`}>{s.value.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Anomaly detection */}
      <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-bold text-ink flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-lightning" aria-hidden />
              Anomaly detection
            </h2>
            <p className="text-xs text-muted mt-0.5">Runs nightly at 02:00 UTC · flags high-error, high-hint, and missing-visual questions</p>
          </div>
          <RunAnomalyButton />
        </div>

        {lastRun.length === 0 ? (
          <p className="text-sm text-muted">No runs recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {lastRun.map((row, i) => {
              const r = row.result as Record<string, number>
              const total = r.total ?? 0
              return (
                <div key={i} className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted w-36 flex-none">
                    {new Date(row.ran_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {total === 0 ? (
                    <span className="text-correct font-medium">No issues found ✓</span>
                  ) : (
                    <span className="text-incorrect font-medium">
                      Flagged {total}: {r.flagged_high_error ?? 0} error rate · {r.flagged_high_hint ?? 0} hint rate · {r.flagged_missing_visual ?? 0} missing visual
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Open reports */}
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
                    <p className="text-sm font-medium text-ink leading-snug">&ldquo;<MathText text={r.question.question_text} />&rdquo;</p>
                    <p className="mt-1 text-xs text-muted italic">Report: {r.reason}</p>
                  </div>
                  <MonitoringActions reportId={r.id} questionId={r.question.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flagged questions — with actions */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">Flagged questions ({flaggedQuestions.length})</h2>
        {flaggedQuestions.length === 0 ? (
          <p className="text-sm text-muted">No flagged questions. ✓</p>
        ) : (
          <div className="space-y-2">
            {flaggedQuestions.map((q) => {
              const distractors = Array.isArray(q.distractors) ? q.distractors as string[] : []
              const tier = q.tier ?? '–'
              const confidence = q.confidence_score != null ? `${Math.round(q.confidence_score)}%` : '–'
              const stats = statsMap[q.id]
              const flagReasons: string[] = []
              if (stats) {
                if (stats.errorRate != null && stats.errorRate > 0.6)
                  flagReasons.push(`Error rate ${Math.round(stats.errorRate * 100)}% (${stats.total} attempts)`)
                if (stats.hint3Rate != null && stats.hint3Rate > 0.5)
                  flagReasons.push(`Hint 3 used ${Math.round(stats.hint3Rate * 100)}% of the time`)
                if (flagReasons.length === 0 && stats.total > 0)
                  flagReasons.push(`${Math.round((stats.errorRate ?? 0) * 100)}% error rate · ${Math.round((stats.hint3Rate ?? 0) * 100)}% hint-3 rate (${stats.total} attempts)`)
              }
              if (flagReasons.length === 0) flagReasons.push('No attempt data yet, flagged manually or via pipeline')
              return (
                <details key={q.id} className="rounded-2xl border border-incorrect/20 bg-incorrect/5 shadow-sm group">
                  <summary className="flex items-start gap-3 p-4 cursor-pointer list-none select-none">
                    <Flag className="flex-none w-4 h-4 text-incorrect mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted mb-0.5">{q.topic.subject.name} · {q.topic.title} · <span className="capitalize">{tier}</span></p>
                      <p className="text-sm text-ink leading-snug"><MathText text={q.question_text} /></p>
                      {flagReasons.map((r, i) => (
                        <p key={i} className="text-xs text-incorrect mt-1">⚑ {r}</p>
                      ))}
                    </div>
                    <span className="flex-none text-xs text-muted mt-0.5 group-open:hidden">▶ expand</span>
                    <span className="flex-none text-xs text-muted mt-0.5 hidden group-open:inline">▼ collapse</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-incorrect/10 pt-3">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {/* Images / diagrams */}
                      {Array.isArray(q.foundation_images) && (q.foundation_images as {url:string;alt?:string}[]).length > 0 && (
                        <div className="rounded-xl bg-black/5 border border-black/10 px-3 py-2">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">Question image(s)</span>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {(q.foundation_images as {url:string;alt?:string}[]).map((img, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={img.url} alt={img.alt ?? `Image ${i+1}`} className="max-h-48 rounded-lg border border-black/10 object-contain bg-surface" />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Source text (source_analysis questions) */}
                      {q.source_text && (
                        <div className="rounded-xl bg-black/5 border border-black/10 px-3 py-2">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">{q.source_label ?? 'Source'}</span>
                          <p className="text-ink text-sm mt-1 whitespace-pre-wrap leading-relaxed">{q.source_text}</p>
                        </div>
                      )}
                      {/* Correct answer */}
                      <div className="rounded-xl bg-correct/10 border border-correct/20 px-3 py-2">
                        <span className="text-xs font-medium text-correct uppercase tracking-wide">Correct answer</span>
                        <p className="text-ink mt-0.5 font-medium"><MathText text={q.correct_answer} /></p>
                      </div>
                      {/* Distractors */}
                      {distractors.length > 0 && (
                        <div className="rounded-xl bg-incorrect/5 border border-incorrect/15 px-3 py-2">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">Wrong options (distractors)</span>
                          <ul className="mt-1 space-y-0.5">
                            {distractors.map((d, i) => (
                              <li key={i} className="text-ink text-sm">✗ <MathText text={d} /></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Explanation */}
                      {q.explanation && (
                        <div className="rounded-xl bg-explorer/10 border border-explorer/20 px-3 py-2">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">Explanation</span>
                          <p className="text-ink text-sm mt-1 leading-relaxed"><MathText text={q.explanation} /></p>
                        </div>
                      )}
                      {/* Hints */}
                      {(q.hint_1 || q.hint_2 || q.hint_3) && (
                        <div className="rounded-xl bg-black/5 border border-black/10 px-3 py-2">
                          <span className="text-xs font-medium text-muted uppercase tracking-wide">Hints (1 → 3)</span>
                          <ol className="mt-1 space-y-0.5 list-decimal list-inside">
                            {q.hint_1 && <li className="text-ink text-sm"><MathText text={q.hint_1} /></li>}
                            {q.hint_2 && <li className="text-ink text-sm"><MathText text={q.hint_2} /></li>}
                            {q.hint_3 && <li className="text-ink text-sm"><MathText text={q.hint_3} /></li>}
                          </ol>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        <span>Confidence: <strong className="text-ink">{confidence}</strong></span>
                        <span>ID: <code className="text-ink">{q.id.slice(0, 8)}</code></span>
                        <span>Created: <strong className="text-ink">{new Date(q.created_at).toLocaleDateString('en-GB')}</strong></span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <FlaggedQuestionActions questionId={q.id} />
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
