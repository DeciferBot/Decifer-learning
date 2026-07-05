// Full-page friendly stop shown in place of a quiz when the parental-consent
// grace window has lapsed (Children's Code soft gate). Learn pages stay open —
// this only ever replaces quiz surfaces. Server-renderable (no client JS).

import Link from 'next/link'

export function ConsentGateScreen({ learnHref }: { learnHref?: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <span aria-hidden className="text-5xl">🔒</span>
      <h1
        className="mt-4 font-heading text-2xl font-extrabold"
        style={{ color: 'var(--text-heading)' }}
      >
        Quizzes are paused for now
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        We emailed your parent or guardian to confirm your account, and we haven&apos;t heard
        back yet. Ask them to check their email (and the spam folder!). Quizzes unlock the
        moment they confirm.
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        You can keep reading lessons while you wait.
      </p>
      <div className="mt-6 flex w-full flex-col gap-3">
        {learnHref ? (
          <Link
            href={learnHref}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl font-bold text-white"
            style={{ background: 'var(--brand)', borderRadius: 'var(--radius-button)' }}
          >
            Read the lesson instead
          </Link>
        ) : null}
        <Link
          href="/dashboard"
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-black/10 font-semibold"
          style={{ color: 'var(--text-primary, #2D3748)' }}
        >
          Back to my dashboard
        </Link>
      </div>
    </section>
  )
}
