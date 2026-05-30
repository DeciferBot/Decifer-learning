'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MVP_YEAR_GROUPS, type YearGroupLabel } from '@/lib/auth/roles'

type Tab = 'existing' | 'create'

export function LinkChildForm() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('existing')

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1">
        <button
          type="button"
          onClick={() => setTab('existing')}
          className={`h-9 rounded-lg text-sm font-semibold transition ${
            tab === 'existing' ? 'bg-white text-ink shadow-sm' : 'text-muted'
          }`}
        >
          They have an account
        </button>
        <button
          type="button"
          onClick={() => setTab('create')}
          className={`h-9 rounded-lg text-sm font-semibold transition ${
            tab === 'create' ? 'bg-white text-ink shadow-sm' : 'text-muted'
          }`}
        >
          Create one for them
        </button>
      </div>

      {tab === 'existing' ? (
        <LinkByEmailForm onLinked={() => router.refresh()} />
      ) : (
        <CreateChildForm onCreated={() => router.refresh()} />
      )}
    </div>
  )
}

// ── Tab 1: link by email ────────────────────────────────────────────────────

function LinkByEmailForm({ onLinked }: { onLinked: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/family/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childEmail: email.trim() }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setSuccess(`${data.displayName} is now linked to your account.`)
        setEmail('')
        onLinked()
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-muted">
        Your child needs their own Decifer account first. Ask them to sign up at{' '}
        <strong>decifer.app/register</strong> and choose &ldquo;Student&rdquo;. Once
        they&rsquo;ve confirmed their email, enter it below.
      </p>

      <label className="block">
        <span className="text-sm font-medium text-ink">{"Child's email address"}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="child@example.com"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md bg-science/10 px-3 py-2 text-sm text-science">
          ✓ {success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Linking…' : 'Link child account'}
      </button>
    </form>
  )
}

// ── Tab 2: parent creates child account ─────────────────────────────────────

function CreateChildForm({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [yearGroup, setYearGroup] = useState<YearGroupLabel>('year-3')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4–6 digits.')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/family/create-child', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: displayName.trim(), yearGroup, pin }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong.')
          return
        }
        setSuccess(`${data.displayName}'s account is ready! ${data.loginHint}`)
        setDisplayName('')
        setPin('')
        setConfirmPin('')
        onCreated()
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-muted">
        No email needed — set a name and a PIN. Your child logs in with their name and PIN.
        You can change the PIN any time from their settings.
      </p>

      <label className="block">
        <span className="text-sm font-medium text-ink">{"Child's name"}</span>
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Aaina"
          autoComplete="off"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Year group</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {MVP_YEAR_GROUPS.map((y) => {
            const active = yearGroup === y.label
            return (
              <button
                key={y.label}
                type="button"
                onClick={() => setYearGroup(y.label)}
                aria-pressed={active}
                className={`h-12 rounded-lg border text-sm font-semibold transition ${
                  active
                    ? 'border-maths bg-maths/10 text-maths'
                    : 'border-black/10 bg-white text-ink'
                }`}
              >
                {y.display}
                <span className="ml-1 text-xs font-normal text-muted">({y.keyStage})</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-ink">PIN (4–6 digits)</span>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          autoComplete="new-password"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Confirm PIN</span>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4,6}"
          required
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="••••"
          autoComplete="new-password"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md bg-science/10 px-3 py-2 text-sm text-science">
          ✓ {success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Creating…' : "Create child's account"}
      </button>
    </form>
  )
}
