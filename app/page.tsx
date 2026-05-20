import Link from 'next/link'
import { RecoveryRedirect } from './RecoveryRedirect'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <RecoveryRedirect />
      <div className="w-full max-w-sm text-center">
        <h1 className="font-heading text-3xl font-bold text-maths">
          Decifer Learning
        </h1>
        <p className="mt-3 text-sm text-muted">
          A UK National Curriculum learning adventure.
        </p>
        <div className="mt-6 grid gap-2">
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-black/10 bg-white font-semibold text-ink"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
