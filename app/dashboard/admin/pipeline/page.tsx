// Phase 8A — minimal admin trigger for the content pipeline.
//
// Route is gated by middleware.ts (requiredRoleForPath: 'admin'). API routes
// the client calls (/api/pipeline/{health,generate}) re-check admin via
// authoriseAdminRequest. This UI is an internal tool, not a product feature.

import { getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PipelinePanel, type TopicOption } from './PipelinePanel'

export const metadata = { title: 'Pipeline' }
export const dynamic = 'force-dynamic'

export default async function PipelineAdminPage() {
  const user = await getAuthUser()

  // Topics surfaced in the picker: every topic that does not yet have any
  // quiz_questions, or that has only `staged` questions. This deliberately
  // excludes topics that are already fully published, to prevent the admin
  // from re-generating over live child-facing content.
  const topicsRaw = await prisma.topic.findMany({
    select: {
      id: true,
      title: true,
      subject: { select: { name: true } },
      year_group: { select: { label: true } },
      quiz_questions: {
        select: { status: true },
      },
    },
    orderBy: [{ year_group: { label: 'asc' } }, { title: 'asc' }],
  })

  const topics: TopicOption[] = topicsRaw
    .map((t) => {
      const counts = {
        published: 0,
        staged: 0,
        regenerating: 0,
        flagged: 0,
      } as Record<string, number>
      for (const q of t.quiz_questions) {
        counts[q.status] = (counts[q.status] ?? 0) + 1
      }
      return {
        id: t.id,
        title: t.title,
        subject: t.subject.name,
        year_group: t.year_group.label,
        published_count: counts.published ?? 0,
        staged_count: counts.staged ?? 0,
      }
    })
    .filter((t) => t.published_count === 0)

  const pipelineConfigured = Boolean(process.env.PIPELINE_SERVICE_URL?.trim())

  return (
    <section className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-ink">
          Content pipeline
        </h1>
        <p className="mt-1 text-sm text-muted">
          Phase 8A activation gate. Generates Maths content via the Railway
          FastAPI service. Generated questions land as <code>staged</code> or{' '}
          <code>published</code> based on the confidence score (CLAUDE.md §8).
        </p>
      </header>

      {!pipelineConfigured && (
        <div className="rounded-lg border border-incorrect/40 bg-incorrect/5 p-3 text-sm text-incorrect">
          <strong>PIPELINE_SERVICE_URL is not set.</strong> Calls will fail
          closed with 503. Set the env var on Vercel to the Railway public
          URL and redeploy.
        </div>
      )}

      <PipelinePanel
        topics={topics}
        signedInAs={user?.email ?? '(unknown user)'}
      />
    </section>
  )
}
