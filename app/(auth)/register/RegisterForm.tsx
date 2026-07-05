'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'
import {
  MVP_YEAR_GROUPS,
  SELF_REGISTERABLE_ROLES,
  EXAM_BOARDS,
  isSelfRegisterableRole,
  isYearGroupLabel,
  isExamBoard,
  yearGroupRequiresExamBoard,
  type SelfRegisterableRole,
  type YearGroupLabel,
  type ExamBoard,
} from '@/lib/auth/roles'

// Children under 13 require verifiable parental consent (UK Children's Code).
// We gate on Year group as a proxy: Y1–Y6 (ages 5–11) always require consent;
// Y7–Y11 may be 11–16, so we always ask to be safe.
const ALWAYS_CONSENT_REQUIRED = true

export function RegisterForm() {
  const [role, setRole] = useState<SelfRegisterableRole>('child')
  // No default on purpose: a pre-selected year sent kids into the wrong year
  // group when they didn't notice the picker. They must choose explicitly.
  const [yearGroup, setYearGroup] = useState<YearGroupLabel | null>(null)
  const [examBoard, setExamBoard] = useState<ExamBoard | ''>('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [password, setPassword] = useState('')
  const [parentalConsent, setParentalConsent] = useState(false)
  const [ageConfirm, setAgeConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const needsExamBoard =
    role === 'child' && yearGroup !== null && yearGroupRequiresExamBoard(yearGroup)
  const needsConsent = role === 'child' && ALWAYS_CONSENT_REQUIRED

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedName = displayName.trim()
    if (!trimmedName) { setError('Display name is required.'); return }
    if (!isSelfRegisterableRole(role)) { setError('Choose a role.'); return }
    if (role === 'child') {
      if (!isYearGroupLabel(yearGroup)) { setError('Choose the school year you are in now.'); return }
      if (needsExamBoard && !isExamBoard(examBoard)) {
        setError('Choose your exam board for GCSE subjects.'); return
      }
      const trimmedParentEmail = parentEmail.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedParentEmail)) {
        setError('Enter your parent or guardian’s email address.'); return
      }
      if (trimmedParentEmail.toLowerCase() === email.trim().toLowerCase()) {
        setError('Your parent or guardian’s email must be different from your own.'); return
      }
      if (needsConsent && !parentalConsent) {
        setError('A parent or guardian must confirm consent before a child account can be created.'); return
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
              ...(role === 'child' ? { parent_email: parentEmail.trim() } : {}),
              ...(needsExamBoard && examBoard ? { exam_board: examBoard } : {}),
              ...(needsConsent && parentalConsent ? { parental_consent_given: true } : {}),
            },
          },
        })
        if (signUpError) { setError(signUpError.message); return }

        // GA4 conversion: account created (fires for both email-confirm and
        // instant-session paths). method distinguishes parent vs child sign-ups.
        trackEvent('sign_up', { method: 'email', role })

        // Kick off the parent/guardian verification email. Best-effort — the
        // daily parent-verify cron retries any child who never got one.
        if (role === 'child' && data.user?.id) {
          fetch('/api/parent-verification/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id }),
          }).catch(() => {})
        }

        if (!data.session) {
          setNotice(
            role === 'child'
              ? 'Check your email to confirm your account, then sign in. We’ve also emailed your parent or guardian to confirm.'
              : 'Check your email to confirm your account, then sign in.'
          )
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

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      {/* Role */}
      <fieldset>
        <legend className="text-sm font-medium">I am a…</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SELF_REGISTERABLE_ROLES.map((r) => {
            const active = role === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={active}
                className={`h-12 rounded-lg border text-sm font-semibold capitalize transition ${
                  active
                    ? 'border-maths bg-maths/10 text-maths'
                    : 'border-black/10 bg-white text-ink'
                }`}
              >
                {r}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Year group (child only) */}
      {role === 'child' ? (
        <fieldset>
          <legend className="text-sm font-medium">Year group</legend>
          <p className="mt-0.5 text-xs text-muted">
            Pick the school year you&apos;re in now — it decides which topics you see.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MVP_YEAR_GROUPS.map((y) => {
              const active = yearGroup === y.label
              return (
                <button
                  key={y.label}
                  type="button"
                  onClick={() => { setYearGroup(y.label); setExamBoard('') }}
                  aria-pressed={active}
                  className={`h-12 rounded-lg border text-sm font-semibold transition ${
                    active
                      ? 'border-maths bg-maths/10 text-maths'
                      : 'border-black/10 bg-white text-ink'
                  }`}
                >
                  {y.display}
                  <span className="ml-1 text-xs font-normal text-muted">
                    ({y.keyStage})
                  </span>
                </button>
              )
            })}
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
            {EXAM_BOARDS.map((b) => {
              const active = examBoard === b
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setExamBoard(b)}
                  aria-pressed={active}
                  className={`h-12 rounded-lg border text-sm font-semibold transition ${
                    active
                      ? 'border-maths bg-maths/10 text-maths'
                      : 'border-black/10 bg-white text-ink'
                  }`}
                >
                  {b}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {/* Display name */}
      <label className="block">
        <span className="text-sm font-medium">
          {role === 'child' ? 'Display name (shown in the app)' : 'Your name'}
        </span>
        <input
          type="text"
          autoComplete="nickname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      {/* Parent / guardian email (child accounts) — used for consent verification */}
      {role === 'child' ? (
        <label className="block">
          <span className="text-sm font-medium">Parent or guardian&apos;s email</span>
          <input
            type="email"
            autoComplete="off"
            required
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
          />
          <span className="mt-1 block text-xs text-muted">
            We&apos;ll send them one email to confirm it&apos;s OK for you to use Decifer Learning.
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
        <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
      </label>

      {/* Parental consent (child accounts) */}
      {needsConsent ? (
        <div className="rounded-lg border border-black/10 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Parent or guardian — please read
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            Decifer Learning collects limited personal data (name, email, learning progress) to
            operate the service. Under the UK Children&apos;s Code, a parent or guardian must
            consent before a child account can be created.{' '}
            <Link href="/legal/privacy" className="font-semibold text-maths underline">
              Read our privacy policy.
            </Link>
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-black/20 accent-maths"
              checked={parentalConsent}
              onChange={(e) => setParentalConsent(e.target.checked)}
            />
            <span className="text-sm leading-snug text-ink">
              I am the parent or guardian of this child. I consent to Decifer Learning collecting
              and processing their data as described in the privacy policy, and confirm they are
              at least 5 years old.
            </span>
          </label>
        </div>
      ) : null}

      {/* Age confirmation (parent accounts) */}
      {role === 'parent' ? (
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
        <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-maths/10 px-3 py-2 text-sm text-maths">
          {notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
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
  )
}
