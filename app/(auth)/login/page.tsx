import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-ink">Welcome back.</h2>
      <p className="mt-1.5 text-sm text-muted">
        Continue building confidence, one topic at a time.
      </p>

      {/* Suspense required because LoginForm uses useSearchParams(). */}
      <Suspense fallback={<div className="mt-5 h-12 w-full animate-pulse rounded-lg bg-black/5" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-muted">
        New to Decifer?{' '}
        <Link href="/register" className="font-semibold text-brand underline">
          Create an account
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-muted">
        <Link href="/help" className="hover:text-ink hover:underline">
          Help &amp; guides
        </Link>
        {' · '}
        <Link href="/help/parent-guide" className="hover:text-ink hover:underline">
          Parent guide
        </Link>
      </p>
    </div>
  )
}
