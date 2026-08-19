'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// The email gate.
//
// It says plainly what is behind it, so a parent is trading an address for a
// known thing. No countdown, no "calculating your child's score" theatre, and no
// pretending the result is still being worked out — it is already finished and
// the headline is on the page above this.
//
// Addressed to the parent, in adult language, because the child may be the one
// holding the screen.

type Props = { token: string }

export function UnlockForm({ token }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reasoning/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, source: 'result-page' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not send the report.')
      // Re-render from the server, which now returns the full report.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report.')
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-ember/20 bg-brand-50 p-5">
      <h2 className="text-lg font-semibold text-ink">Get the full breakdown</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Enter your email and we will show you, and send you:
      </p>
      <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-ink-2">
        <li>
          How your child did on each of the four kinds of puzzle, and the hardest level they
          solved in each.
        </li>
        <li>How long they took per kind, and which one slowed them down.</li>
        <li>Up to three things to practise, each with a worked example.</li>
        <li>A straight explanation of why there is no IQ number here, and what a CAT4 SAS is.</li>
      </ul>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="parent-email" className="mb-1 block text-sm font-semibold text-ink">
            Parent or guardian email
          </label>
          <input
            id="parent-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-describedby="parent-email-note"
            className="min-h-[48px] w-full rounded-xl border border-black/10 bg-surface px-4 text-[15px] text-ink outline-none focus:border-ember focus:ring-2 focus:ring-ember/30"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Sending…' : 'Show me the breakdown'}
        </button>
        {error && (
          <p role="alert" className="text-sm font-medium text-error">
            {error}
          </p>
        )}
      </form>

      <p id="parent-email-note" className="mt-3 text-xs leading-relaxed text-ink-2">
        This should be a grown-up&apos;s email address. We use it to send this one report, and
        every email has a one-click link to delete it. We hold nothing that identifies your
        child.
      </p>
    </section>
  )
}
