'use client'

// Parental-consent banner shown across the child app while the account is
// unconfirmed. Grace state: gentle nudge with days remaining. Gated state:
// explains that quizzes are paused. Offers "send it again" (24h-throttled
// server-side) and, when we have no parent email at all (accounts that
// pre-date the signup field) or it was mistyped, an inline form to add one.

import { useState } from 'react'

type Props = {
  state: 'grace' | 'gated'
  daysLeft?: number
  hasParentEmail: boolean
  userId: string
}

export function ConsentBanner({ state, daysLeft, hasParentEmail, userId }: Props) {
  const [showEmailForm, setShowEmailForm] = useState(!hasParentEmail)
  const [parentEmail, setParentEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/parent-verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setNote('Sent! Ask them to check their inbox (and spam folder).')
    } catch {
      setError('Could not send right now. Try again later.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/parent-verification/set-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentEmail }),
      })
      if (res.ok) {
        setNote('Thanks! We’ve emailed your parent or guardian to confirm.')
        setShowEmailForm(false)
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not save. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const headline =
    state === 'gated'
      ? 'Quizzes are paused until a parent or guardian confirms your account.'
      : `Ask your parent or guardian to check their email. Quizzes pause in ${daysLeft} day${daysLeft === 1 ? '' : 's'} if they don’t confirm.`

  return (
    <div
      role={state === 'gated' ? 'alert' : 'status'}
      className="mx-auto max-w-screen-xl px-4 pt-3 sm:px-6 lg:px-10"
    >
      <div
        className="rounded-2xl border p-4"
        style={{
          background: state === 'gated' ? '#FFF4F2' : '#FFF9E8',
          borderColor: state === 'gated' ? '#FFD2C9' : '#FFE9A8',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary, #2D3748)' }}>
          {state === 'gated' ? '🔒 ' : '👋 '}
          {headline}
        </p>
        {state === 'gated' ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #718096)' }}>
            Lessons still work. Quizzes unlock the moment they confirm.
          </p>
        ) : null}

        {note ? (
          <p role="status" className="mt-2 text-xs font-medium" style={{ color: '#40C057' }}>
            {note}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-xs font-medium" style={{ color: '#FF6B6B' }}>
            {error}
          </p>
        ) : null}

        {showEmailForm ? (
          <form onSubmit={saveEmail} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="Parent or guardian's email"
              aria-label="Parent or guardian's email"
              className="min-h-[48px] flex-1 rounded-xl border border-black/10 bg-surface px-3 text-sm outline-none focus:border-maths"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--brand, #FB5A24)' }}
            >
              {busy ? 'Sending…' : 'Send confirmation'}
            </button>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="min-h-[48px] rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--brand, #FB5A24)' }}
            >
              {busy ? 'Sending…' : 'Send the email again'}
            </button>
            <button
              type="button"
              onClick={() => { setShowEmailForm(true); setNote(null) }}
              className="min-h-[48px] rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold"
              style={{ color: 'var(--text-primary, #2D3748)' }}
            >
              Wrong email? Fix it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
