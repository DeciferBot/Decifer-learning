import Link from 'next/link'

export const metadata = {
  title: 'Student guide — Decifer Learning',
}

export default function StudentGuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Student guide</h1>
        <p className="mt-2 text-muted">
          Here&apos;s how Decifer works and how to get the most out of every session.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">The three steps</h2>
        <p className="text-sm text-muted">Every topic on Decifer follows the same path.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {THREE_STEPS.map((step) => (
            <div key={step.label} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm text-center">
              <span className="text-3xl" aria-hidden>{step.icon}</span>
              <p className="mt-2 font-heading font-bold text-ink">{step.label}</p>
              <p className="mt-1 text-xs text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">Hints and hearts</h2>
        <div className="space-y-2 text-sm text-muted">
          <p>Every quiz question has <strong className="text-ink">three hints</strong>. Use them whenever you&apos;re stuck. Each hint costs a few points, but it&apos;s better to understand with help than to guess.</p>
          <p>You start every quiz with <strong className="text-ink">three hearts</strong>. If you get three answers wrong in a row, you lose a heart. You can always retry a quiz — there&apos;s no permanent penalty.</p>
          <p>You can earn <strong className="text-ink">Streak Shields</strong> by completing quizzes and keeping your streak going. A shield absorbs one heart loss, so keep them handy.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">XP and points</h2>
        <ul className="space-y-2">
          {XP_RULES.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 text-sm shadow-sm">
              <span className="text-lg" aria-hidden>{rule.icon}</span>
              <span className="text-muted">{rule.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">Streaks</h2>
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm text-sm text-muted space-y-2">
          <p>Your streak goes up by one every day you log in and learn something. Miss a day and your streak resets to zero — unless you have a Streak Shield, which saves it once.</p>
          <p>A streak is not about pressure. It&apos;s about building a habit. Even a 5-day streak shows real commitment.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">Discovery Cards</h2>
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm text-sm text-muted space-y-2">
          <p>After every quiz you pass, you earn a Discovery Card. Cards come in five rarities: <strong className="text-ink">Common, Uncommon, Rare, Epic,</strong> and <strong className="text-ink">Legendary</strong>.</p>
          <p>Legendary cards can only be won by defeating a Zone Guardian boss. There&apos;s one Guardian per zone. Good luck!</p>
          <p>You can see your full collection at any time from your dashboard.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">The World Map</h2>
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm text-sm text-muted space-y-2">
          <p>The World Map shows your zones and topic nodes. Each zone has a theme — like the <strong className="text-ink">Number Jungle</strong> for Year 3 Maths, or the <strong className="text-ink">Crystal Labyrinth</strong> for Year 7 Maths.</p>
          <p>Topics unlock one after another. Complete a topic to unlock the next one. Complete all the topics in a zone to face the Zone Guardian.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-ink">Tips for learning</h2>
        <ul className="space-y-2">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted">
              <span className="mt-0.5 flex-none font-bold text-brand">·</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-sm font-semibold text-ink">Want to know more about XP and badges?</p>
        <p className="mt-1 text-sm text-muted">
          <Link href="/help/gamification" className="font-semibold text-brand hover:underline">
            Read the gamification guide →
          </Link>
        </p>
      </div>
    </div>
  )
}

const THREE_STEPS = [
  { icon: '📖', label: 'Learn', body: 'Read the explanation and worked examples for the topic.' },
  { icon: '✏️', label: 'Practise', body: 'Work through guided exercises to build confidence.' },
  { icon: '⚡', label: 'Quiz', body: 'Answer 10 questions to test your real understanding.' },
]

const XP_RULES = [
  { icon: '✅', body: 'Correct answer in a quiz — earn XP for every question you get right.' },
  { icon: '🎯', body: 'Perfect quiz — bonus XP for completing a quiz without any wrong answers.' },
  { icon: '💡', body: 'Using hints — hints cost a small amount of XP each, but that\'s okay.' },
  { icon: '🔥', body: 'Daily login — keeping your streak going earns bonus XP every day.' },
]

const TIPS = [
  'Do the Learn step first — even if you think you already know the topic. It helps you spot the exact way Decifer frames questions.',
  'Use hints when you\'re stuck. That\'s what they\'re there for. Understanding the hint is better than guessing.',
  'Retry quizzes. Your highest score is what counts towards your progress, not your first attempt.',
  'Check the World Map after each quiz — your next topic might just have unlocked.',
  'A short session every day beats a long session once a week.',
]
