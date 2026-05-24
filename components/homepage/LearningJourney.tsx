'use client'

import { ScrollReveal } from '@/components/ui/ScrollReveal'

const STEPS = [
  {
    step: 1,
    label: 'Learn',
    color: '#6C9EFF',
    colorBg: 'rgba(108,158,255,0.10)',
    textColor: '#6C9EFF',
    icon: '📖',
    body: 'Clear explanations and worked examples at the right level. No pressure, no time limit.',
  },
  {
    step: 2,
    label: 'Practise',
    color: '#52D9A0',
    colorBg: 'rgba(82,217,160,0.10)',
    textColor: '#52D9A0',
    icon: '✏️',
    body: 'Guided exercises with up to three hint levels and instant feedback. Retries are never penalised.',
  },
  {
    step: 3,
    label: 'Quiz',
    color: '#FFD43B',
    colorBg: 'rgba(255,212,59,0.12)',
    textColor: '#A08000',
    icon: '⚡',
    body: 'Ten questions across three difficulty tiers. Instant feedback. Every mistake is explained, not just marked wrong.',
  },
  {
    step: 4,
    label: 'Progress',
    color: '#F05A28',
    colorBg: 'rgba(240,90,40,0.08)',
    textColor: '#F05A28',
    icon: '📊',
    body: 'Scores, XP, streaks, and topic completion tracked automatically. Parents see results the same day.',
  },
]

export function LearningJourney() {
  return (
    <div className="relative">
      {/* Connector line — desktop only, sits behind step number circles */}
      <div
        className="absolute left-[calc(12.5%+1rem)] right-[calc(12.5%+1rem)] top-[2.6rem] hidden h-px lg:block"
        style={{
          background:
            'linear-gradient(to right, #6C9EFF 0%, #52D9A0 33%, #FFD43B 66%, #F05A28 100%)',
          opacity: 0.25,
        }}
        aria-hidden
      />

      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <ScrollReveal key={step.step} delay={i * 0.09}>
            <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-background p-5 shadow-sm">
              {/* Color accent bar */}
              <div
                className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                style={{ backgroundColor: step.color }}
                aria-hidden
              />

              <div className="mb-3 flex items-center gap-2.5 pt-1">
                {/* Step number */}
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full font-heading text-sm font-black text-white"
                  style={{ backgroundColor: step.color }}
                  aria-label={`Step ${step.step}`}
                >
                  {step.step}
                </span>
                <span className="text-xl" aria-hidden>
                  {step.icon}
                </span>
              </div>

              <p className="font-heading text-base font-bold text-ink">{step.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>

              <div className="mt-3">
                <span
                  className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: step.colorBg, color: step.textColor }}
                >
                  Step {step.step} of 4
                </span>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
