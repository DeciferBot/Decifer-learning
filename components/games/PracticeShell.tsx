'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Sparkles, ArrowRight } from '@/components/ui/icons'

/**
 * Shared chrome for the five in-lesson practice activities: Fill Blank,
 * Number Line, Equation Balancer, Drag Drop and Speed Round.
 *
 * They each carried their own header, progress bar, feedback banner and
 * "practice complete" card. Five copies meant five different paddings, three
 * different ways of saying the same thing, and one dead `bg-black/8` progress
 * track that Tailwind never generated a rule for, so it rendered invisible.
 *
 * Colour follows the product policy in tokens.css: progress is teal, actions
 * are brand, and feedback text uses the -700 inks. The raw --correct and
 * --incorrect hues these used to print in measure 1.85:1 and 3.06:1 as text,
 * both under the 4.5:1 the product requires.
 */

/** Title, position, and how far through you are. */
export function PracticeHeader({
  title,
  current,
  total,
  aside,
}: {
  title: string
  current: number
  total: number
  /** Replaces the plain "3 of 10" counter — Speed Round puts its clock here. */
  aside?: ReactNode
}) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-ink">{title}</span>
        {aside ?? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-ink-2">
            {current} of {total}
          </span>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-black/[0.08]"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Question ${current} of ${total}`}
      >
        <motion.div
          className="h-full rounded-full bg-teal"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        />
      </div>
    </div>
  )
}

/** The surface a question sits on. One radius, one border, one shadow. */
export function PracticeCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/[0.07] bg-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

/**
 * The answer banner. Wrong answers name the right answer rather than only
 * saying "not quite", and neither state relies on colour alone: each carries
 * its own icon and its own words.
 */
export function PracticeFeedback({ correct, children }: { correct: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mt-4 flex items-start justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-sm font-bold ${
        correct ? 'bg-correct/10 text-correct-700' : 'bg-incorrect/10 text-incorrect-700'
      }`}
    >
      {correct ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>↺</span>
      )}
      <span className="text-pretty">{children}</span>
    </motion.div>
  )
}

/** Primary action. One shape for every "do the thing" button in practice. */
export function PracticeButton({
  onClick,
  disabled,
  children,
  full = true,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  full?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[48px] rounded-xl bg-brand-600 px-6 font-heading font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-black/10 disabled:text-muted ${
        full ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  )
}

/** The secondary "try again" / "play again" shape. */
export function PracticeSecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-[48px] w-full rounded-xl border border-black/10 bg-surface px-6 font-heading font-bold text-ink shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/[0.04]"
    >
      {children}
    </button>
  )
}

/**
 * The end of a practice run. Always offers the quiz, because that is the next
 * step in the Learn → Practise → Quiz loop and a child should never have to
 * find it themselves.
 */
export function PracticeDone({
  title,
  detail,
  topicId,
  icon,
  extra,
  secondary,
}: {
  title: string
  detail: string
  topicId: string
  icon?: ReactNode
  /** Speed Round's per-question result strip goes here. */
  extra?: ReactNode
  secondary?: ReactNode
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-black/[0.07] bg-surface p-7 text-center shadow-sm"
    >
      <div className="mb-3 flex justify-center">
        {icon ?? <Sparkles className="h-11 w-11 text-brand-700" aria-hidden />}
      </div>
      <h2 className="font-heading text-xl font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-[36ch] text-pretty text-sm text-ink-2">{detail}</p>
      {extra}
      <Link
        href={`/topics/${topicId}/quiz`}
        className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 font-heading font-bold text-white transition-colors hover:bg-brand-700"
      >
        Start the quiz <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {secondary && <div className="mt-3">{secondary}</div>}
    </motion.div>
  )
}
