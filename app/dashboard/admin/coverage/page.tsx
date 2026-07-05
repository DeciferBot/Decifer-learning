// Phase 11A: Admin coverage dashboard — server component only.
// Uses service role (admin client) only.
// Admin protection is enforced by middleware at /dashboard/admin/*.
export const dynamic = 'force-dynamic'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Content Coverage · Admin' }

type TopicRow = {
  id: string
  title: string
  is_published: boolean
  year_group: string
  subject: string
  published_questions: number
  staged_questions: number
  flagged_questions: number
}

type PipelineRunRow = {
  id: string
  run_type: string
  year_group: string
  subject: string
  tier: string | null
  status: string
  items_attempted: number
  items_published: number
  items_staged: number
  items_failed: number
  started_at: string
  completed_at: string | null
  pipeline_version: string | null
}

type OutcomeStats = {
  subject: string
  year_group: string
  total: number
  mapped: number
  unmapped: number
  verified: number
  unverified: number
}

async function getTopicCoverage(): Promise<TopicRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_topic_coverage_stats')
  if (error) {
    // Fallback: direct query if RPC not yet created
    const { data: topics, error: topicError } = await supabase
      .from('topics')
      .select(`
        id, title, is_published,
        year_groups!inner(label),
        subjects!inner(name)
      `)
      .order('subjects(name)', { ascending: true })

    if (topicError || !topics) return []

    // Enrich with question counts
    const enriched: TopicRow[] = []
    for (const t of topics as any[]) {
      const { count: published } = await supabase
        .from('quiz_questions')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', t.id)
        .eq('status', 'published')

      const { count: staged } = await supabase
        .from('quiz_questions')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', t.id)
        .eq('status', 'staged')

      const { count: flagged } = await supabase
        .from('quiz_questions')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', t.id)
        .eq('status', 'flagged')

      enriched.push({
        id: t.id,
        title: t.title,
        is_published: t.is_published,
        year_group: t.year_groups?.label ?? '',
        subject: t.subjects?.name ?? '',
        published_questions: published ?? 0,
        staged_questions: staged ?? 0,
        flagged_questions: flagged ?? 0,
      })
    }
    return enriched
  }
  return (data as TopicRow[]) ?? []
}

async function getRecentPipelineRuns(): Promise<PipelineRunRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)
  return (data as PipelineRunRow[]) ?? []
}

async function getOutcomeStats(): Promise<OutcomeStats[]> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('curriculum_outcomes')
    .select('subject, year_group, coverage_status, verification_status')

  if (!data) return []

  const buckets: Record<string, OutcomeStats> = {}
  for (const row of data as any[]) {
    const key = `${row.subject}|${row.year_group}`
    if (!buckets[key]) {
      buckets[key] = {
        subject: row.subject,
        year_group: row.year_group,
        total: 0,
        mapped: 0,
        unmapped: 0,
        verified: 0,
        unverified: 0,
      }
    }
    buckets[key].total++
    if (row.coverage_status === 'mapped') buckets[key].mapped++
    else buckets[key].unmapped++
    if (row.verification_status === 'verified') buckets[key].verified++
    else buckets[key].unverified++
  }
  return Object.values(buckets).sort((a, b) =>
    a.subject.localeCompare(b.subject) || a.year_group.localeCompare(b.year_group)
  )
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    published: 'bg-green-100 text-green-800',
    staged: 'bg-yellow-100 text-yellow-800',
    flagged: 'bg-red-100 text-red-800',
    regenerating: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colours[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default async function CoverageDashboardPage() {
  const [topics, runs, outcomeStats] = await Promise.all([
    getTopicCoverage(),
    getRecentPipelineRuns(),
    getOutcomeStats(),
  ])

  const subjects = Array.from(new Set(topics.map((t) => t.subject))).sort()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Content Coverage</h1>
        <p className="mt-1 text-sm text-text-muted">
          Phase 11A: Year 3 English and Science pipeline status
        </p>
      </div>

      {/* ── Outcome coverage stats ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Curriculum Outcome Coverage</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-text-muted">Subject</th>
                <th className="px-4 py-2 text-left font-medium text-text-muted">Year Group</th>
                <th className="px-4 py-2 text-right font-medium text-text-muted">Total</th>
                <th className="px-4 py-2 text-right font-medium text-text-muted">Mapped</th>
                <th className="px-4 py-2 text-right font-medium text-text-muted">Unmapped</th>
                <th className="px-4 py-2 text-right font-medium text-text-muted">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-surface">
              {outcomeStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-text-muted">
                    No outcomes seeded yet. Run seed-outcomes-english-y3.ts and seed-outcomes-science-y3.ts.
                  </td>
                </tr>
              )}
              {outcomeStats.map((stat) => (
                <tr key={`${stat.subject}|${stat.year_group}`}>
                  <td className="px-4 py-2 font-medium">{stat.subject}</td>
                  <td className="px-4 py-2">{stat.year_group}</td>
                  <td className="px-4 py-2 text-right">{stat.total}</td>
                  <td className="px-4 py-2 text-right text-green-700">{stat.mapped}</td>
                  <td className="px-4 py-2 text-right text-yellow-700">{stat.unmapped}</td>
                  <td className="px-4 py-2 text-right text-blue-700">{stat.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Topic coverage by subject ── */}
      {subjects.map((subject) => {
        const subjectTopics = topics.filter((t) => t.subject === subject)
        return (
          <section key={subject}>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">{subject} Topics</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-text-muted">Topic</th>
                    <th className="px-4 py-2 text-left font-medium text-text-muted">Year</th>
                    <th className="px-4 py-2 text-left font-medium text-text-muted">Live</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Published Qs</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Staged</th>
                    <th className="px-4 py-2 text-right font-medium text-text-muted">Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-surface">
                  {subjectTopics.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-text-muted">
                        No topics seeded yet. Run seed-topics-{subject.toLowerCase()}.ts.
                      </td>
                    </tr>
                  )}
                  {subjectTopics.map((topic) => (
                    <tr key={topic.id}>
                      <td className="px-4 py-2 font-medium">{topic.title}</td>
                      <td className="px-4 py-2 text-text-muted">{topic.year_group}</td>
                      <td className="px-4 py-2">
                        {topic.is_published ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-yellow-600">–</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{topic.published_questions}</td>
                      <td className="px-4 py-2 text-right font-mono text-yellow-700">{topic.staged_questions}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">{topic.flagged_questions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {subjects.length === 0 && (
        <p className="text-sm text-text-muted">
          No topics found. Run seed-topics-english.ts and seed-topics-science.ts first.
        </p>
      )}

      {/* ── Recent pipeline runs ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Recent Pipeline Runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-text-muted">
            No pipeline runs yet. Batch generation has not been run in Phase 11A.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-text-muted">Subject</th>
                  <th className="px-4 py-2 text-left font-medium text-text-muted">Year</th>
                  <th className="px-4 py-2 text-left font-medium text-text-muted">Tier</th>
                  <th className="px-4 py-2 text-left font-medium text-text-muted">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Published</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Staged</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted">Failed</th>
                  <th className="px-4 py-2 text-left font-medium text-text-muted">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-surface">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2">{run.subject}</td>
                    <td className="px-4 py-2">{run.year_group}</td>
                    <td className="px-4 py-2">{run.tier ?? '–'}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-green-700">{run.items_published}</td>
                    <td className="px-4 py-2 text-right font-mono text-yellow-700">{run.items_staged}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-700">{run.items_failed}</td>
                    <td className="px-4 py-2 text-text-muted">
                      {new Date(run.started_at).toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
