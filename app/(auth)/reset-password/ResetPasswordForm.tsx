'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // createBrowserClient auto-detects access_token from the URL hash and
    // stores the session, so getSession() resolves it without a network call.
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      } else {
        setError('This link has expired or is invalid. Please request a new password reset.')
      }
    })
  }, [])

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
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
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
          className="mt-1 block h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base outline-none focus:border-maths focus:ring-2 focus:ring-maths/30"
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
