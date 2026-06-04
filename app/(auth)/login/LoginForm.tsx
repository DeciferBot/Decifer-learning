'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Mode = 'password' | 'magic' | 'forgot' | 'pin'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_callback_failed'
      ? 'The confirmation link has expired or is invalid. Please sign in or request a new link.'
      : null
  )
  const [sent, setSent] = useState(false)
  const successMessage =
    searchParams.get('message') === 'password_updated'
      ? 'Password updated. Please sign in with your new password.'
      : null
  const [isPending, startTransition] = useTransition()

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSent(false)
  }

  // ── Password sign-in ────────────────────────────────────────────────────
  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) { setError(signInError.message); return }
        router.refresh()
        router.push(redirectTo)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  // ── Magic link ──────────────────────────────────────────────────────────
  function handleMagicSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (otpError) { setError(otpError.message); return }
        setSent(true)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  // ── Forgot password ─────────────────────────────────────────────────────
  function handleForgotSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            // After Supabase verifies the link the callback exchanges the PKCE
            // code and forwards the user to /reset-password to set a new password.
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          }
        )
        if (resetError) { setError(resetError.message); return }
        setSent(true)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  // ── Shared "check your email" confirmation ──────────────────────────────
  if (sent) {
    return (
      <div className="mt-5 rounded-md bg-correct/10 px-3 py-4 text-sm text-correct text-center">
        <p className="font-semibold">Check your email ✓</p>
        <p className="mt-1">
          {mode === 'forgot'
            ? `We sent a password reset link to `
            : `We sent a sign-in link to `}
          <strong>{email}</strong>.
        </p>
        <button
          onClick={() => switchMode('password')}
          className="mt-3 text-brand underline font-semibold"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="mt-5">
      {/* Mode tabs */}
      {mode !== 'forgot' && (
        <div className="mb-4 flex rounded-lg border border-black/10 bg-black/5 p-1">
          <button
            type="button"
            onClick={() => switchMode('password')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'password' ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => switchMode('magic')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'magic' ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            Magic link
          </button>
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'pin' ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            Child PIN
          </button>
        </div>
      )}

      {/* ── Password form ── */}
      {mode === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          {successMessage ? (
            <p role="status" className="rounded-md bg-correct/10 px-3 py-2 text-sm text-correct">
              {successMessage}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-muted">
            Forgot your password?{' '}
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="font-semibold text-brand underline"
            >
              Reset it
            </button>
          </p>
        </form>
      )}

      {/* ── Magic link form ── */}
      {mode === 'magic' && (
        <form onSubmit={handleMagicSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}

      {/* ── Forgot password form ── */}
      {mode === 'forgot' && (
        <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
          <div>
            <h3 className="font-heading text-lg font-semibold">Reset your password</h3>
            <p className="mt-1 text-sm text-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm text-muted">
            <button
              type="button"
              onClick={() => switchMode('password')}
              className="font-semibold text-brand underline"
            >
              Back to sign in
            </button>
          </p>
        </form>
      )}
      {/* ── Child PIN form ── */}
      {mode === 'pin' && (
        <PinLoginForm redirectTo={redirectTo} />
      )}
    </div>
  )
}

function PinLoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [childName, setChildName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        // Step 1: resolve the synthetic email from the display name
        const lookupRes = await fetch('/api/auth/child-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: childName.trim() }),
        })
        const lookupData = await lookupRes.json()
        if (!lookupRes.ok) {
          setError(lookupData.error ?? 'Could not find that account.')
          return
        }

        // Step 2: sign in with the synthetic email + PIN
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: lookupData.email,
          password: pin,
        })
        if (signInError) {
          setError('Incorrect PIN. Please try again.')
          return
        }
        router.refresh()
        router.push(redirectTo)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        For children whose account was set up by a parent — enter your name and PIN.
      </p>
      <label className="block">
        <span className="text-sm font-medium">Your name</span>
        <input
          type="text"
          required
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="e.g. Aaina"
          autoComplete="off"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">PIN</span>
        <input
          type="password"
          inputMode="numeric"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          autoComplete="current-password"
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Signing in…' : 'Sign in with PIN'}
      </button>
    </form>
  )
}
