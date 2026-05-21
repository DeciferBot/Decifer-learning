'use client'

import { useState } from 'react'

export type TopicOption = {
  id: string
  title: string
  subject: string
  year_group: string
  published_count: number
  staged_count: number
}

type HealthResponse = { status?: string; version?: string; error?: string }

type GenerateResponse = {
  topic_id?: string
  tier?: string
  published?: number
  staged?: number
  regenerating?: number
  failed?: number
  input_tokens?: number
  output_tokens?: number
  model?: string
  error?: string
  detail?: unknown
}

export function PipelinePanel({
  topics,
  signedInAs,
}: {
  topics: TopicOption[]
  signedInAs: string
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthStatus, setHealthStatus] = useState<number | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const [topicId, setTopicId] = useState(topics[0]?.id ?? '')
  const [tier, setTier] = useState<'sprout' | 'explorer' | 'lightning'>('sprout')
  const [count, setCount] = useState(3)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateResult, setGenerateResult] =
    useState<GenerateResponse | null>(null)
  const [generateStatus, setGenerateStatus] = useState<number | null>(null)

  async function checkHealth() {
    setHealthLoading(true)
    setHealth(null)
    try {
      const res = await fetch('/api/pipeline/health', { cache: 'no-store' })
      const body = (await res.json()) as HealthResponse
      setHealth(body)
      setHealthStatus(res.status)
    } catch (err) {
      setHealth({ error: err instanceof Error ? err.message : String(err) })
      setHealthStatus(0)
    } finally {
      setHealthLoading(false)
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!topicId) return
    setGenerateLoading(true)
    setGenerateResult(null)
    try {
      const res = await fetch('/api/pipeline/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, tier, count }),
      })
      const body = (await res.json()) as GenerateResponse
      setGenerateResult(body)
      setGenerateStatus(res.status)
    } catch (err) {
      setGenerateResult({
        error: err instanceof Error ? err.message : String(err),
      })
      setGenerateStatus(0)
    } finally {
      setGenerateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-black/10 bg-surface p-4">
        <p className="text-xs text-muted">
          Signed in as <code>{signedInAs}</code>
        </p>
      </div>

      {/* Health */}
      <div className="space-y-2 rounded-lg border border-black/10 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Health check</h2>
          <button
            type="button"
            onClick={checkHealth}
            disabled={healthLoading}
            className="h-10 rounded-lg bg-maths px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {healthLoading ? 'Checking…' : 'Check pipeline'}
          </button>
        </div>
        {health && (
          <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs">
{`HTTP ${healthStatus}\n${JSON.stringify(health, null, 2)}`}
          </pre>
        )}
      </div>

      {/* Generate */}
      <form
        onSubmit={generate}
        className="space-y-3 rounded-lg border border-black/10 bg-surface p-4"
      >
        <h2 className="font-heading text-lg font-semibold">Generate content</h2>

        {topics.length === 0 ? (
          <p className="text-sm text-muted">
            No topics without published content. Seed a topic shell first
            (see <code>scripts/seed-phase8a-test-topic.mjs</code>).
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-medium">Topic</span>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.year_group} · {t.subject} · {t.title}
                    {t.staged_count > 0 ? ` (${t.staged_count} staged)` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Tier</span>
              <select
                value={tier}
                onChange={(e) =>
                  setTier(
                    e.target.value as 'sprout' | 'explorer' | 'lightning',
                  )
                }
                className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base"
              >
                <option value="sprout">sprout</option>
                <option value="explorer">explorer</option>
                <option value="lightning">lightning</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                Count (1–10, capped to prevent accidental bulk-generation)
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) =>
                  setCount(Math.min(10, Math.max(1, Number(e.target.value))))
                }
                className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base"
              />
            </label>

            <button
              type="submit"
              disabled={generateLoading || !topicId}
              className="h-12 w-full rounded-lg bg-maths font-semibold text-white disabled:opacity-60"
            >
              {generateLoading ? 'Generating…' : 'Run pipeline'}
            </button>
          </>
        )}

        {generateResult && (
          <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs">
{`HTTP ${generateStatus}\n${JSON.stringify(generateResult, null, 2)}`}
          </pre>
        )}
      </form>
    </div>
  )
}
