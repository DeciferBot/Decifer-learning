'use client'

import { useEffect, useRef, useState } from 'react'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { XPBadge } from '@/components/ui/XPBadge'
import { Flame } from '@/components/ui/icons'

const MOCK_STATS = [
  { label: 'Topics done', value: '4' },
  { label: 'Quiz avg', value: '82%' },
  { label: 'Streak', value: '5 days' },
]

const TARGET_PERCENT = 72

export function HeroMockup() {
  const [ringPercent, setRingPercent] = useState(0)
  const [barPercent, setBarPercent] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const animated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion: skip the count-up and show final values
    // immediately. The CSS global collapses transitions, but the rAF loop is
    // JavaScript-driven and must be guarded here explicitly.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRingPercent(TARGET_PERCENT)
      setBarPercent(TARGET_PERCENT)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true
          const startTime = performance.now()
          const duration = 900

          const tick = (now: number) => {
            const raw = Math.min((now - startTime) / duration, 1)
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - raw, 3)
            const val = Math.round(TARGET_PERCENT * ease)
            setRingPercent(val)
            setBarPercent(val)
            if (raw < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {/* Parent insight card */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-md">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <div>
            <p className="font-heading text-sm font-bold text-ink">Aaina&apos;s progress</p>
            <p className="text-xs text-muted">Year 7 · Maths</p>
          </div>
          <ProgressRing percent={ringPercent} size={44} color="#F05A28">
            <span className="text-[10px] font-bold text-ink">{ringPercent}%</span>
          </ProgressRing>
        </div>

        <div className="grid grid-cols-3 divide-x divide-black/5">
          {MOCK_STATS.map((s) => (
            <div key={s.label} className="px-3 py-3 text-center sm:px-4">
              <p className="font-heading text-lg font-bold text-ink">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 px-4 py-3">
          <p className="text-xs font-semibold text-ink">Needs more practice</p>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink">Solving Equations</span>
            <span className="text-xs text-muted">65% correct</span>
          </div>
        </div>
      </div>

      {/* Topic card + quiz result */}
      <div className="grid grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm">
          <div className="h-1.5 bg-maths" aria-hidden />
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Maths · Year 7</p>
            <p className="mt-1 font-heading text-sm font-bold text-ink">Algebra Basics</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-1.5 rounded-full bg-maths"
                style={{
                  width: `${barPercent}%`,
                  transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-muted">{barPercent}%</p>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs font-semibold">
              <span className="rounded bg-maths/10 py-1 text-ink">Learn</span>
              <span className="rounded bg-science/10 py-1 text-ink">Prac.</span>
              <span className="rounded bg-lightning/20 py-1 text-ink">Quiz</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-black/5 bg-surface p-3 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Latest quiz</p>
            <p className="mt-1 font-heading text-2xl font-black text-ink">8/10</p>
            <p className="text-xs text-muted">Algebra Basics</p>
          </div>
          <div className="mt-2 space-y-1.5">
            <XPBadge points={80} size="sm" variant="gold" />
            <p className="text-xs text-muted flex items-center gap-1"><Flame className="w-3 h-3" aria-hidden /> 5 day streak</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted">
        Example preview. Real data shown once your child is active.
      </p>
    </div>
  )
}
