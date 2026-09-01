'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'
import {
  MVP_YEAR_GROUPS,
  EXAM_BOARDS,
  isYearGroupLabel,
  isExamBoard,
  yearGroupRequiresExamBoard,
  type SelfRegisterableRole,
  type YearGroupLabel,
  type ExamBoard,
} from '@/lib/auth/roles'

// Two steps, and the first one is a choice, not a form.
//
// The old page put role, eleven year groups, name, email, a parent's email,
// password and a boxed legal notice on one screen, with "Child" selected by
// default. A seven-year-old cannot fill that in, and a parent arriving to set
// their child up was shown the child's form first. Of 29 registered children,
// 22 never played a round.
//
// Now the parent path is the recommended one: name, email, password, done. The
// child gets set up from the parent dashboard with a name and a PIN, no email
// (components/parent/LinkChildForm.tsx). The student path is the same four
// things for the student: year, name, email, password.
//
// A student does not need parental consent to learn. There is no consent
// gate anywhere in the product any more — no checkbox here, no soft gate on
// quizzes, no parent-verification email. Only a parent-created account (the
// recommended path) links a parent, and that link is informational, not a
// requirement to use Decifer.
type Step = 'choose' | SelfRegisterableRole

const INPUT =
  'mt-1 block h-12 w-full rounded-lg border border-black/10 bg-surface px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

const CHIP = (active: boolean) =>
  `h-12 rounded-lg border text-sm font-semibold transition ${
    active ? 'border-brand bg-brand/10 text-on-maths' : 'border-black/10 bg-surface text-ink'
  }`

export function RegisterForm() {
  const [step, setStep] = useState<Step>('choose')
  // No default on purpose: a pre-selected year sent kids into the wrong year
  // group when they didn't notice the picker. They must choose explicitly.
  const [yearGroup, setYearGroup] = useState<YearGroupLabel | null>(null)
  const [examBoard, setExamBoard] = useState<ExamBoard | ''>('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageConfirm, setAgeConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const role: SelfRegisterableRole | null = step === 'choose' ? null : step
  const needsExamBoard =
    role === 'child' && yearGroup !== null && yearGroupRequiresExamBoard(yearGroup)

  function choose(next: SelfRegisterableRole) {
    setError(null)
    setNotice(null)
    setStep(next)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!role) return

    const trimmedName = displayName.trim()
    if (!trimmedName) { setError(role === 'child' ? 'Tell us what to call you.' : 'Your name is required.'); return }
    if (role === 'child') {
      if (!isYearGroupLabel(yearGroup)) { setError('Choose the school year you are in now.'); return }
      if (needsExamBoard && !isExamBoard(examBoard)) {
        setError('Choose your exam board for GCSE subjects.'); return
      }
    }
    if (role === 'parent' && !ageConfirm) {
      setError('Please confirm you are 18 or over.'); return
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role,
              display_name: trimmedName,
              ...(role === 'child' && yearGroup ? { year_group: yearGroup } : {}),
              ...(needsExamBoard && examBoard ? { exam_board: examBoard } : {}),
            },
          },
        })
        if (signUpError) { setError(signUpError.message); return }

        // GA4 conversion: parent account created only. Child sign-ups are never
        // sent to GA — children's data stays out of analytics (see lib/analytics.ts).
        if (role === 'parent') {
          trackEvent('sign_up', { method: 'email' })
        }

        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in.')
          return
        }
        // Hard navigation: a client-side router.push() here can leave the
        // shared dashboard layout (and its TopBar) served from a Router
        // Cache entry captured under a previous session's cookie.
        window.location.href = '/dashboard'
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  // ── Step 1: who is this for? ──────────────────────────────────────────────
  if (step === 'choose') {
    return (
      <div>
        <h2 className="font-heading text-2xl font-bold text-ink">Who&apos;s signing up?</h2>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => choose('parent')}
            className="block w-full rounded-xl border-2 border-brand bg-brand/5 p-4 text-left transition active:scale-[0.99]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-heading text-lg font-bold text-ink">I&apos;m a parent</span>
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Quickest
              </span>
            </span>
            <span className="mt-1 block text-sm text-muted">
              Set your child up in a minute. They sign in with their name and a PIN. No email needed for them.
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose('child')}
            className="block w-full rounded-xl border border-black/10 bg-surface p-4 text-left transition hover:bg-black/[0.02] active:scale-[0.99]"
          >
            <span className="font-heading text-lg font-bold text-ink">I&apos;m a student</span>
            <span className="mt-1 block text-sm text-muted">
              Sign up yourself with an email and password. Your year, your name, done.
            </span>
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Got a name and PIN from your parent?{' '}
          <Link href="/login?mode=pin" className="font-semibold text-brand-700 underline">
            Sign in with your PIN
          </Link>
        </p>
      </div>
    )
  }

  // ── Step 2: one short form ────────────────────────────────────────────────
  const isChild = step === 'child'

  return (
    <div>
      <button
        type="button"
        onClick={() => { setStep('choose'); setError(null); setNotice(null) }}
        className="-ml-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-muted hover:text-ink"
      >
        <span aria-hidden>←</span>&nbsp;Back
      </button>
      <h2 className="mt-1 font-heading text-2xl font-bold text-ink">
        {isChild ? 'Create your student account.' : 'Create your parent account.'}
      </h2>
      {!isChild ? (
        <p className="mt-1.5 text-sm text-muted">
          You&apos;ll add your child on the next screen.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {/* Year group (student only) */}
        {isChild ? (
          <fieldset>
            <legend className="text-sm font-medium">Which year are you in?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {MVP_YEAR_GROUPS.map((y) => (
                <button
                  key={y.label}
                  type="button"
                  onClick={() => { setYearGroup(y.label); setExamBoard('') }}
                  aria-pressed={yearGroup === y.label}
                  className={CHIP(yearGroup === y.label)}
                >
                  {y.display}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {/* Exam board (Y10/Y11 only) */}
        {needsExamBoard ? (
          <fieldset>
            <legend className="text-sm font-medium">Exam board</legend>
            <p className="mt-0.5 text-xs text-muted">
              Check your school&apos;s website if you&apos;re not sure.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {EXAM_BOARDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setExamBoard(b)}
                  aria-pressed={examBoard === b}
                  className={CHIP(examBoard === b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium">{isChild ? 'What should we call you?' : 'Your name'}</span>
          <input
            type="text"
            autoComplete={isChild ? 'nickname' : 'name'}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">{isChild ? 'Your email' : 'Email'}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
        </label>

        {/* Age confirmation (parent accounts) */}
        {!isChild ? (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 accent-maths"
              checked={ageConfirm}
              onChange={(e) => setAgeConfirm(e.target.checked)}
            />
            <span className="text-sm leading-snug text-ink">
              I confirm I am 18 years old or over.
            </span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md bg-brand/10 px-3 py-2 text-sm text-on-maths">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-center text-xs text-muted">
          By creating an account you agree to our{' '}
          <Link href="/legal/terms" className="underline">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </div>
  )
}
