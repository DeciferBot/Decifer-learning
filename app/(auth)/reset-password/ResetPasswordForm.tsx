'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const EXPIRED_MESSAGE =
  'This link has expired or is invalid. Please request a new password reset.'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // /auth/confirm bounced us here after a failed/expired link — no session is
    // coming, so show the message immediately instead of waiting.
    if (searchParams.get('error')) {
      setError(EXPIRED_MESSAGE)
      return
    }

    // The /auth/confirm route already ran verifyOtp and set the recovery session
    // cookie server-side before redirecting here, so getSession() resolves it
    // locally. We ALSO subscribe to onAuthStateChange to close any hydration
    // timing gap, and fall back to the expired message if nothing arrives.
    const supabase = createSupabaseBrowserClient()
    let resolved = false

    const markReady = () => {
      if (resolved) return
      resolved = true
      setSessionReady(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReady()
    })

    const timer = setTimeout(() => {
      if (!resolved) setError(EXPIRED_MESSAGE)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [searchParams])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) {
          setError(updateError.message)
          return
        }
        await supabase.auth.signOut()
        router.push('/login?message=password_updated')
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  if (!sessionReady && !error) {
    return <div className="mt-5 h-12 w-full animate-pulse rounded-lg bg-black/5" />
  }

  if (error && !sessionReady) {
    return (
      <>
        <p role="alert" className="mt-5 rounded-md bg-incorrect/10 px-3 py-2 text-sm text-incorrect">
          {error}
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98]"
        >
          Back to sign in
        </button>
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-surface px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-surface px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
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
        className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  )
}
