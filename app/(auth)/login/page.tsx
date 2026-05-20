import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Sign in — Decipher Learning',
}

export default function LoginPage() {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">Sign in</h2>
      <p className="mt-1 text-sm text-muted">Welcome back, explorer.</p>
      {/* Suspense boundary required because LoginForm uses useSearchParams(). */}
      <Suspense fallback={<div className="mt-5 h-12 w-full animate-pulse rounded-lg bg-black/5" />}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link href="/register" className="font-semibold text-maths underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
