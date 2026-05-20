'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  MVP_YEAR_GROUPS,
  SELF_REGISTERABLE_ROLES,
  isSelfRegisterableRole,
  isYearGroupLabel,
  type SelfRegisterableRole,
  type YearGroupLabel,
} from '@/lib/auth/roles'

export function RegisterForm() {
  const router = useRouter()
  const [role, setRole] = useState<SelfRegisterableRole>('child')
  const [yearGroup, setYearGroup] = useState<YearGroupLabel>('year-3')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('Display name is required.')
      return
    }
    if (!isSelfRegisterableRole(role)) {
      setError('Choose a role.')
      return
    }
    if (role === 'child' && !isYearGroupLabel(yearGroup)) {
      setError('Choose a year group.')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Use the actual origin so the link works in both dev and production.
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role,
              display_name: trimmedName,
              ...(role === 'child' ? { year_group: yearGroup } : {}),
            },
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        // Supabase returns a user but no session when email confirmation is required.
        // It also returns a user with no identities when the email is already registered
        // (it avoids revealing which emails exist). Treat both as "check your email".
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in.')
          return
        }
        router.push('/dashboard')
        router.refresh()
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
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

      {role === 'child' ? (
        <fieldset>
          <legend className="text-sm font-medium">Year group</legend>
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
                  <span className="ml-1 text-xs font-normal text-muted">
                    ({y.keyStage})
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium">Display name</span>
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
    </form>
  )
}
