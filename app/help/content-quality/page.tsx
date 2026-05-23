import Link from 'next/link'

export const metadata = {
  title: 'Content quality — Decifer Learning',
}

export default function ContentQualityPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Content quality</h1>
        <p className="mt-2 text-muted">
          How every question and lesson is verified before your child ever sees it.
        </p>
      </div>

      <div className="rounded-2xl bg-brand-50 p-5 text-sm text-muted space-y-2">
        <p className="font-heading font-bold text-ink">The core principle</p>
        <p>No question reaches a child that has not passed every stage of an automated quality pipeline. There is no shortcut, no override, and no guessing. <strong className="text-ink">Computations are always verified by code — never by AI alone.</strong></p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">The six-stage pipeline</h2>
        <p className="text-sm text-muted">Every piece of content passes through six sequential checks.</p>
        <ol className="space-y-3">
          {PIPELINE_STAGES.map((stage, i) => (
            <li key={i} className="flex items-start gap-4 rounded-xl border border-black/5 bg-surface px-4 py-4 shadow-sm">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-50 text-sm font-black text-brand font-heading">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink">{stage.title}</p>
                <p className="mt-0.5 text-sm text-muted">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Verification by subject</h2>
        <p className="text-sm text-muted">Different subjects use different verification tools. AI generates and explains — code verifies.</p>
        <div className="space-y-2">
          {VERIFIERS.map((v, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 text-sm shadow-sm">
              <span className="font-semibold text-ink flex-none min-w-[120px]">{v.subject}</span>
              <span className="text-muted">{v.tool}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Content status</h2>
        <p className="text-sm text-muted">Every piece of content carries a status. Only <strong className="text-ink">published</strong> content is ever shown to children.</p>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <div key={s.status} className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 text-sm shadow-sm">
              <span className="font-mono font-semibold text-ink flex-none">{s.status}</span>
              <span className="text-muted">{s.meaning}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">What is currently available</h2>
        <div className="text-sm text-muted space-y-2">
          <p>Maths content for Year 3 and Year 7 is the most complete. English and Science content is progressively expanding: topics are published only once they have passed the full pipeline. Your child will only ever see content that is ready.</p>
          <p>New topics and subjects are added as they clear all quality checks. The pipeline runs continuously, so the range of available topics grows over time without any code changes.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Ongoing monitoring</h2>
        <div className="text-sm text-muted space-y-2">
          <p>Every night, an automated check reviews all published questions. If a question has a high error rate (more than 60% of children getting it wrong) or high hint-3 usage (more than 50% of attempts using the biggest hint), it is automatically flagged and removed from the child-facing pool.</p>
          <p>Flagged questions are sent back through the pipeline for regeneration. A child will never encounter a question that has been identified as consistently confusing.</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/help/how-decifer-works" className="font-semibold text-brand hover:underline">
          How Decifer works →
        </Link>
        <Link href="/help" className="text-muted hover:text-ink hover:underline">
          All guides
        </Link>
      </div>
    </div>
  )
}

const PIPELINE_STAGES = [
  { title: 'RAG generation', body: 'Questions are generated using only curriculum-approved source material retrieved from a knowledge base. AI cannot invent facts — it must cite sources.' },
  { title: 'Code verification', body: 'All mathematical and scientific calculations are verified by code — SymPy for maths, Pint for physics, ChemPy for chemistry, a local periodic table for element facts. If the calculation is wrong, the question fails.' },
  { title: 'Consensus check', body: 'A second independent AI pass reviews the question at zero temperature and confirms the answer is correct, unambiguous, and at the right difficulty level.' },
  { title: 'Constitutional critique', body: 'A third pass checks the question against a written constitution covering age-appropriateness, cultural sensitivity, distractor plausibility, hint progression quality, and single-answer clarity.' },
  { title: 'Semantic deduplication', body: 'The question is compared against all existing published questions in the same topic. If it is too similar to an existing question, it is rejected to ensure children see a variety of questions.' },
  { title: 'Confidence scoring and decision', body: 'A weighted score is calculated across all checks. Content must meet a subject-specific confidence threshold before it is published. Maths requires ≥ 85%, English comprehension and Biology require ≥ 90%.' },
]

const VERIFIERS = [
  { subject: 'Maths (arithmetic)', tool: 'Safe-eval whitelist — arithmetic is computed directly, not estimated.' },
  { subject: 'Maths (algebra)', tool: 'SymPy — symbolic mathematics solver.' },
  { subject: 'Physics', tool: 'Pint (units) + SymPy — unit-aware calculation checking.' },
  { subject: 'Chemistry', tool: 'ChemPy + local periodic table — no AI guessing on element facts.' },
  { subject: 'English grammar', tool: 'LanguageTool (en-GB) — grammar rule enforcement.' },
  { subject: 'English comprehension', tool: 'Source grounding — answers must cite curriculum source chunks.' },
]

const STATUSES = [
  { status: 'published', meaning: 'Passed all pipeline checks. Visible to children.' },
  { status: 'staged', meaning: 'Passed structure checks but below the confidence threshold. Not visible to children.' },
  { status: 'flagged', meaning: 'Live monitoring detected a high error rate or hint misuse. Removed from child-facing pool and queued for regeneration.' },
  { status: 'regenerating', meaning: 'Currently being reprocessed through the pipeline after being flagged.' },
]
