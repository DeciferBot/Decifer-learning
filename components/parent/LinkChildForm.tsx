'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function LinkChildForm() {
  const router = useRouter()
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
        router.refresh()
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
