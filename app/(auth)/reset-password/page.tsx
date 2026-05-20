import Link from 'next/link'
import { Suspense } from 'react'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata = {
  title: 'Set new password — Decifer Learning',
}

export default function ResetPasswordPage() {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">Set new password</h2>
      <p className="mt-1 text-sm text-muted">Choose a strong password of at least 8 characters.</p>
      <Suspense fallback={<div className="mt-5 h-12 w-full animate-pulse rounded-lg bg-black/5" />}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-maths underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
