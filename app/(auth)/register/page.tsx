import Link from 'next/link'
import { RegisterForm } from './RegisterForm'

export const metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
}

// The heading and any explanation live inside RegisterForm, because they change
// with the step: "Who's signing up?" first, then one short form for the answer.
export default function RegisterPage() {
  return (
    <div>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
