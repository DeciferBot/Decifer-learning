import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Decifer Blitz | Live quiz battles',
  description:
    'Run a real-time quiz battle in 30 seconds. UK curriculum questions, no accounts needed, works on any device. Perfect for teachers and parents.',
  alternates: { canonical: '/blitz' },
  openGraph: {
    title: 'Decifer Blitz | Live quiz battles',
    description: 'Real-time quiz battles aligned to the UK National Curriculum. No accounts needed.',
    url: 'https://deciferlearning.com/blitz',
  },
  twitter: {
    title: 'Decifer Blitz | Live quiz battles',
    description: 'Real-time quiz battles aligned to the UK National Curriculum. No accounts needed.',
  },
}

const HOW = [
  {
    step: '1',
    heading: 'Pick a topic',
    body: 'Choose one topic or a full-subject blast. Decifer pulls curriculum-aligned questions automatically.',
  },
  {
    step: '2',
    heading: 'Share the link',
    body: 'One tap sends a join link via WhatsApp or iMessage. Players land with the code pre-filled, no typing.',
  },
  {
    step: '3',
    heading: 'Battle it out',
    body: 'Four colour tiles, a countdown clock, live scores. The fastest correct answer wins the most points.',
  },
]

const FEATURES = [
  { icon: '⚡', heading: 'No accounts for players', body: 'Anyone can join with a nickname. Only the host needs a Decifer account.' },
  { icon: '📚', heading: 'Curriculum-aligned', body: 'Every question is verified against the UK National Curriculum, not random trivia.' },
  { icon: '📱', heading: 'Works on any device', body: 'Phone, tablet, laptop. Safari, Chrome, anywhere. No app download.' },
  { icon: '🏆', heading: 'Live leaderboard', body: 'Scores update in real-time. A podium reveal at the end.' },
  { icon: '🎯', heading: 'Pick your level', body: 'Year 2 through to Year 11. Maths, English, Science, History, Geography.' },
  { icon: '🔗', heading: 'One-tap join link', body: 'Share a link from the lobby. Players tap it and land in your game instantly.' },
]

export default function BlitzPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg font-extrabold text-ink">Decifer</span>
          <span className="rounded-full bg-[#6C9EFF] px-2 py-0.5 font-heading text-xs font-extrabold text-white">
            BLITZ
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/join"
            className="rounded-xl px-4 py-2 text-sm font-bold text-muted transition hover:text-ink"
          >
            Join a game
          </Link>
          <Link
            href="/play"
            className="rounded-xl bg-[#6C9EFF] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            Host a game
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-14 text-center md:pt-24">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#6C9EFF]/10 px-4 py-1.5 text-sm font-bold text-[#6C9EFF]">
          ⚡ Decifer Blitz
        </div>
        <h1 className="font-heading text-4xl font-extrabold leading-tight text-ink md:text-5xl">
          Real-time quiz battles.<br />
          <span className="text-[#6C9EFF]">Curriculum-aligned.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
          Run a live quiz battle in 30 seconds. No logins, no IT setup, no random trivia.
          Every question comes straight from the UK National Curriculum.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/play"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6C9EFF] px-8 py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
          >
            ⚡ Host a game, it&apos;s free
          </Link>
          <Link
            href="/join"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-surface px-8 py-4 font-heading text-base font-extrabold text-ink shadow-sm transition hover:opacity-80 sm:w-auto"
          >
            Join with a code
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">
          Free with any Decifer account · Year 2 – Year 11 · No app download needed
        </p>
      </section>

      {/* Fake screen mockup */}
      <section className="mx-auto mb-16 max-w-sm px-5">
        <div className="overflow-hidden rounded-3xl bg-surface shadow-md ring-1 ring-black/8">
          <div className="bg-[#2D3748] px-5 py-3 text-center">
            <p className="font-mono text-2xl font-extrabold tracking-[0.3em] text-white">4 8 2 9 1 7</p>
            <p className="mt-0.5 text-xs text-white/60">Game code, share to join</p>
          </div>
          <div className="px-5 py-4">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-muted">Question 3 of 10</p>
            <p className="mb-4 text-center text-sm font-bold text-ink">What is 7 × 8?</p>
            <div className="grid grid-cols-2 gap-2">
              {[['🔺 56', '#FF6B6B'], ['◆ 54', '#6C9EFF'], ['● 64', '#FFC107'], ['■ 48', '#52D9A0']].map(([label, colour]) => (
                <div
                  key={label}
                  className="flex items-center justify-center rounded-2xl py-4 text-sm font-extrabold text-white"
                  style={{ backgroundColor: colour }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 px-5 py-3 text-xs text-muted">
            <span>⏱ 12s left</span>
            <span>🏅 3 players answered</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface py-16">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-10 text-center font-heading text-2xl font-extrabold text-ink">
            Up and running in under a minute
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW.map(({ step, heading, body }) => (
              <div key={step} className="rounded-2xl bg-background p-6 ring-1 ring-black/5">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#6C9EFF] font-heading text-sm font-extrabold text-white">
                  {step}
                </div>
                <h3 className="mb-1 font-heading text-base font-extrabold text-ink">{heading}</h3>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For parents / teachers split */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-[#6C9EFF]/8 p-7 ring-1 ring-[#6C9EFF]/20">
            <div className="mb-3 text-2xl">🏠</div>
            <h3 className="mb-2 font-heading text-lg font-extrabold text-ink">For parents</h3>
            <p className="text-sm leading-relaxed text-muted">
              Friday night quiz time. Pick a topic your kids are studying, share the link over WhatsApp,
              and let them battle each other from their own devices. The questions come from what they&apos;re
              actually learning at school.
            </p>
          </div>
          <div className="rounded-2xl bg-[#52D9A0]/8 p-7 ring-1 ring-[#52D9A0]/20">
            <div className="mb-3 text-2xl">🏫</div>
            <h3 className="mb-2 font-heading text-lg font-extrabold text-ink">For teachers</h3>
            <p className="text-sm leading-relaxed text-muted">
              End-of-lesson revision in 30 seconds. No IT request, no student logins, no setup.
              Show the code on your projector, and every student joins from their phone.
              Questions are curriculum-verified, not random trivia.
            </p>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="bg-surface py-16">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-10 text-center font-heading text-2xl font-extrabold text-ink">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map(({ icon, heading, body }) => (
              <div key={heading} className="rounded-2xl bg-background p-5 ring-1 ring-black/5">
                <div className="mb-2 text-xl">{icon}</div>
                <h3 className="mb-1 font-heading text-sm font-extrabold text-ink">{heading}</h3>
                <p className="text-xs leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <h2 className="mb-3 font-heading text-3xl font-extrabold text-ink">
          Start your first battle free
        </h2>
        <p className="mb-8 text-base text-muted">
          Included with every Decifer account. No extra setup.
        </p>
        <Link
          href="/play"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#6C9EFF] px-10 py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90"
        >
          ⚡ Host a game now
        </Link>
        <p className="mt-4 text-xs text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-ink underline underline-offset-2">
            Sign up free
          </Link>
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 px-5 py-8 text-center text-xs text-muted">
        <p>
          <Link href="/" className="font-semibold text-ink hover:underline">Decifer Learning</Link>
          {' · '}
          <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
          {' · '}
          <Link href="/legal/terms" className="hover:underline">Terms</Link>
          {' · '}
          <Link href="/join" className="hover:underline">Join a game</Link>
        </p>
      </footer>
    </main>
  )
}
