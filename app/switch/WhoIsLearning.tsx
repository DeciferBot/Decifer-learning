'use client'

// "Who's learning?" — the shared-iPad hand-over.
//
// Before this, a child on the family iPad had to sign the parent out, then type
// their own name into a box, and that name was searched across every family on
// Decifer. Two children called Zara anywhere in the world and it refused them
// both. Now the parent's own children are the only options, they are pictures,
// and the child taps their own.
//
// The number their parent chose still stands between the tap and the account.
// Removing it needs a server that can hand out a session on the parent's
// say-so, which is a separate piece of work.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AVATAR_ICONS } from '@/lib/icon-tokens'
import { UserCircle } from '@/components/ui/icons'
import { MVP_YEAR_GROUPS } from '@/lib/auth/roles'

export type PickerChild = {
  profileId: string
  displayName: string
  yearLabel: string | null
  avatarBase: string | null
  avatarColour: string | null
  signInEmail: string | null
}

const COLOUR_HEX: Record<string, string> = {
  blue: '#6C9EFF',
  pink: '#FF8FAB',
  green: '#52D9A0',
  gold: '#FFC107',
  purple: '#9B59B6',
  orange: '#FF8C00',
}

export function WhoIsLearning({ kids }: { kids: PickerChild[] }) {
  const router = useRouter()
  const [chosen, setChosen] = useState<PickerChild | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Wrong guesses in a row, counted per child. After five, that child's pad
  // stops and points at the parent, so a sibling cannot sit and work through
  // every number. It is counted per child on purpose: one child guessing wrong
  // must not shut their brother or sister out. The real protection is the
  // sign-in service, which limits attempts on its own side; this is the polite
  // version a child sees.
  const [wrongFor, setWrongFor] = useState<{ profileId: string; count: number } | null>(null)
  const locked = !!chosen && wrongFor?.profileId === chosen.profileId && wrongFor.count >= 5

  async function signIn(child: PickerChild, code: string) {
    if (!child.signInEmail || locked) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: child.signInEmail,
        password: code,
      })
      if (signInError) {
        setWrongFor((w) =>
          w && w.profileId === child.profileId
            ? { profileId: child.profileId, count: w.count + 1 }
            : { profileId: child.profileId, count: 1 },
        )
        setError('That is not the right number. Try again.')
        setPin('')
        setBusy(false)
        return
      }
      router.refresh()
      router.push('/dashboard/child')
    } catch {
      setError('Something went wrong. Try again.')
      setPin('')
      setBusy(false)
    }
  }

  function press(digit: string) {
    if (busy || !chosen || locked) return
    // The setup form accepts four to six digits, so this cannot submit on its
    // own at four: a child with a five or six digit number would never get in.
    // They press Go instead.
    setPin((pin + digit).slice(0, 6))
    setError(null)
  }

  // ── Step 2: the number pad for the chosen child ──────────────────────────
  if (chosen) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">
            Hi {chosen.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">Tap your number</p>
        </div>

        <div className="flex justify-center gap-3" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${
                i < pin.length ? 'h-4 w-4 bg-brand' : i < 4 ? 'h-4 w-4 bg-black/15' : 'h-2 w-2 self-center bg-black/10'
              }`}
            />
          ))}
        </div>

        <p aria-live="polite" className="min-h-[20px] text-sm font-semibold text-incorrect">
          {locked ? 'Too many tries. Ask your parent for help.' : error}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              disabled={busy || locked}
              className="min-h-[72px] rounded-2xl border border-black/10 bg-surface font-heading text-2xl font-bold text-ink transition-colors hover:bg-black/[0.03] disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setChosen(null)
              setPin('')
              setError(null)
            }}
            className="min-h-[72px] rounded-2xl text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => press('0')}
            disabled={busy || locked}
            className="min-h-[72px] rounded-2xl border border-black/10 bg-surface font-heading text-2xl font-bold text-ink transition-colors hover:bg-black/[0.03] disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => {
              setPin(pin.slice(0, -1))
              setError(null)
            }}
            disabled={busy || locked || pin.length === 0}
            className="min-h-[72px] rounded-2xl text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            Delete
          </button>
        </div>

        <button
          type="button"
          onClick={() => void signIn(chosen, pin)}
          disabled={busy || locked || pin.length < 4}
          className="min-h-[56px] w-full rounded-2xl bg-brand-600 font-heading text-lg font-extrabold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? 'Just a moment…' : 'Go'}
        </button>
      </div>
    )
  }

  // ── Step 1: the faces ────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-ink">Who&apos;s learning?</h1>
        <p className="mt-1 text-sm text-muted">Tap your name to start</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {kids.map((c) => {
          const Icon = (c.avatarBase && AVATAR_ICONS[c.avatarBase]) || UserCircle
          const hex = COLOUR_HEX[c.avatarColour ?? ''] ?? '#6C9EFF'
          const year = MVP_YEAR_GROUPS.find((y) => y.label === c.yearLabel)
          const usable = !!c.signInEmail
          return (
            <button
              key={c.profileId}
              type="button"
              onClick={() => usable && setChosen(c)}
              disabled={!usable}
              className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border border-black/5 bg-surface p-4 text-center shadow-sm transition-transform hover:bg-black/[0.02] active:scale-[0.98] disabled:opacity-60"
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${hex}24` }}
                aria-hidden
              >
                <Icon size={40} style={{ color: hex }} />
              </span>
              <span className="font-heading text-lg font-bold text-ink">{c.displayName}</span>
              <span className="text-xs text-muted">
                {usable ? (year?.display ?? c.yearLabel ?? '') : 'Signs in with their own email'}
              </span>
            </button>
          )
        })}
      </div>

      {/* A child who made their own account before their parent linked them has
          no number, so their card cannot start a session. Send them to the
          normal sign-in rather than leaving a dead card on the screen. */}
      {kids.some((c) => !c.signInEmail) && (
        <p className="text-center text-sm text-muted">
          Greyed out?{' '}
          <Link href="/login" className="font-semibold text-brand-700 underline">
            Sign in with their email instead
          </Link>
        </p>
      )}
    </div>
  )
}
