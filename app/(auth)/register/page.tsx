import Link from 'next/link'
import { RegisterForm } from './RegisterForm'

export const metadata = {
  title: 'Create account — Decipher Learning',
}

export default function RegisterPage() {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">Create your account</h2>
      <p className="mt-1 text-sm text-muted">
        Children and parents both start here.
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have one?{' '}
        <Link href="/login" className="font-semibold text-maths underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
