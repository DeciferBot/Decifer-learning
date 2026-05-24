import Link from 'next/link'
import { RegisterForm } from './RegisterForm'

export const metadata = {
  title: 'Create account — Decifer Learning',
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-ink">Create your account.</h2>
      <p className="mt-1.5 text-sm text-muted">
        Create a parent or student account in two minutes. Parents can link a child account after registration.
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand underline">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted">
        <Link href="/help/parent-guide" className="hover:text-ink hover:underline">
          Parent guide
        </Link>
        {' · '}
        <Link href="/help" className="hover:text-ink hover:underline">
          Help
        </Link>
      </p>
    </div>
  )
}
