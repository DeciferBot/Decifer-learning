// Friendly "good place to stop" screen shown in place of a quiz once the
// parent's daily screen-time limit is reached. Mirrors ConsentGateScreen:
// Learn pages stay open, only quiz surfaces are replaced. Positive framing is
// the Children's-Code-endorsed nudge — we celebrate the session rather than
// throwing an error after the child has done the work.

import Link from 'next/link'

export function ScreenTimeRestScreen({ learnHref }: { learnHref?: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <span aria-hidden className="text-5xl">🌟</span>
      <h1
        className="mt-4 font-heading text-2xl font-extrabold"
        style={{ color: 'var(--text-heading)' }}
      >
        Great work today!
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        You&apos;ve hit your learning time for today, a brilliant place to stop. Your streak
        and points are safe. Come back tomorrow for more.
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        You can still read lessons any time.
      </p>
      <div className="mt-6 flex w-full flex-col gap-3">
        {learnHref ? (
          <Link
            href={learnHref}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl font-bold text-white"
            style={{ background: 'var(--brand)', borderRadius: 'var(--radius-button)' }}
          >
            Read a lesson instead
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
