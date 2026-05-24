'use client'

import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

const STAGES = [
  {
    n: 1,
    name: 'Curriculum sourced',
    desc: 'Every question begins from approved National Curriculum material. No outside sources.',
    detail: 'RAG retrieval',
  },
  {
    n: 2,
    name: 'Verified by code',
    desc: 'Maths and science answers are checked by a code verifier — SymPy, Pint, or ChemPy. Not by AI.',
    detail: 'Code verification',
  },
  {
    n: 3,
    name: 'Independently re-checked',
    desc: 'A second AI pass at zero temperature independently confirms correctness and clarity.',
    detail: 'Consensus check',
  },
  {
    n: 4,
    name: 'Reviewed for clarity',
    desc: 'Checked against a written standard: age-appropriateness, hint progression, tier alignment.',
    detail: 'Constitutional critique',
  },
  {
    n: 5,
    name: 'Uniqueness confirmed',
    desc: 'Compared semantically against every published question. Similar questions are blocked.',
    detail: 'Deduplication',
  },
  {
    n: 6,
    name: 'Published or blocked',
    desc: 'A confidence score is calculated. Content that does not meet the threshold is not published. No exceptions.',
    detail: 'Confidence gate',
  },
]

export function QualityPipeline() {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, i) => (
          <ScrollReveal key={stage.n} delay={i * 0.07}>
            <div className="flex gap-3.5 rounded-2xl border border-black/[0.06] bg-background p-4 shadow-sm">
              {/* Stage number — orange circle, consistent with brand */}
              <span
                className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand font-heading text-xs font-black text-white"
                aria-label={`Stage ${stage.n}`}
              >
                {stage.n}
              </span>
              <div className="min-w-0">
                <p className="font-heading text-sm font-bold text-ink">{stage.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{stage.desc}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-brand/60">
                  {stage.detail}
                </p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={0.48}>
        <p className="mt-6 text-center">
          <Link
            href="/help/content-quality"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Read how content is verified
            <span aria-hidden>→</span>
          </Link>
        </p>
      </ScrollReveal>
    </div>
  )
}
