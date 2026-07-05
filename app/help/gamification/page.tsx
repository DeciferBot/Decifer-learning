import Link from 'next/link'
import { Star, Medal, Flame, Shield, Layers, Target, CircleX, Check } from '@/components/ui/icons'

export const metadata = {
  title: 'Gamification explained — Decifer Learning',
  description:
    'How XP, badges, streaks, Streak Shields and Discovery Cards work in Decifer: rewards tied to real learning effort and progress, never spending or pressure.',
  alternates: { canonical: '/help/gamification' },
}

export default function GamificationPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Gamification explained</h1>
        <p className="mt-2 text-muted">
          How XP, badges, streaks, shields, and Discovery Cards work, and what they are designed to do.
        </p>
      </div>

      <div className="rounded-2xl bg-brand-50 p-5">
        <p className="font-heading font-bold text-ink">The principle behind it all</p>
        <p className="mt-1 text-sm text-muted">
          Every reward in Decifer is tied to <strong className="text-ink">learning effort and progress</strong>, not repetition or spending. The emotional loop we are building is simple:
        </p>
        <p className="mt-3 font-heading font-semibold text-ink">
          I tried → I improved → I can see progress → I want to continue.
        </p>
        <p className="mt-3 text-sm text-muted">
          Rewards recognise effort, accuracy, and progress. They are not bought, traded, or used to pressure children.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink flex items-center gap-2"><Star className="w-5 h-5 text-points-gold" aria-hidden /> XP Points</h2>
        <p className="text-sm text-muted">XP (experience points) are earned through learning activity. They represent effort, not perfection.</p>
        <ul className="space-y-2">
          {XP_EARN.map((item, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 text-sm shadow-sm">
              <span className="flex-none mt-0.5">{item.icon}</span>
              <span className="text-muted">{item.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink flex items-center gap-2"><Medal className="w-5 h-5 text-points-gold" aria-hidden /> Badges</h2>
        <p className="text-sm text-muted">Badges mark real achievements. They do not expire and cannot be taken away.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {BADGES.map((badge) => (
            <div key={badge.name} className="rounded-xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
              <p className="font-semibold text-ink">{badge.name}</p>
              <p className="mt-0.5 text-xs text-muted">{badge.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink flex items-center gap-2"><Flame className="w-5 h-5 text-incorrect" aria-hidden /> Streaks</h2>
        <div className="text-sm text-muted space-y-2">
          <p>A streak represents the number of consecutive days you have logged in and engaged with Decifer. It is a <strong className="text-ink">consistency signal</strong>, not a pressure mechanism.</p>
          <p>If you miss a day, your streak resets unless you have a Streak Shield. Losing a streak is not a punishment. Starting again is just as valid as continuing one.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink flex items-center gap-2"><Shield className="w-5 h-5 text-maths" aria-hidden /> Streak Shields</h2>
        <div className="text-sm text-muted space-y-2">
          <p>Streak Shields protect your streak from a single missed day. They are earned by completing quizzes and maintaining streaks, not bought or gifted.</p>
          <p>You can hold multiple shields at once. They are used automatically when you miss a day, so your streak survives. Think of them as earned insurance, not a free pass.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink flex items-center gap-2"><Layers className="w-5 h-5 text-english" aria-hidden /> Discovery Cards</h2>
        <p className="text-sm text-muted">A Discovery Card drops after every quiz you pass. Cards come in five rarities:</p>
        <div className="space-y-2">
          {RARITIES.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 text-sm shadow-sm">
              <span className="flex-none font-heading text-xs font-bold uppercase tracking-wide" style={{ color: r.color }}>{r.name}</span>
              <span className="text-muted">{r.desc}</span>
              <span className="ml-auto text-xs text-muted flex-none">{r.chance}% chance</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Legendary cards can only be won by defeating a Zone Guardian. There is one per zone.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">What gamification must not do</h2>
        <ul className="space-y-2">
          {MUST_NOT.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted">
              <CircleX className="mt-0.5 flex-none w-4 h-4 text-incorrect" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          If you ever feel that any feature in Decifer creates unhealthy pressure, please let us know.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/help/student-guide" className="font-semibold text-brand hover:underline">
          Student guide →
        </Link>
        <Link href="/help" className="text-muted hover:text-ink hover:underline">
          All guides
        </Link>
      </div>
    </div>
  )
}

const XP_EARN = [
  { icon: <Check className="w-4 h-4 text-correct" aria-hidden />, body: 'Correct answer in a quiz: XP awarded for every right answer.' },
  { icon: <Target className="w-4 h-4 text-maths" aria-hidden />, body: 'Perfect quiz with no hints: bonus XP for a clean run.' },
  { icon: <Flame className="w-4 h-4 text-incorrect" aria-hidden />, body: 'Daily login: maintaining a streak earns a small daily bonus.' },
  { icon: <Shield className="w-4 h-4 text-muted" aria-hidden />, body: 'Using a hint: a small cost is deducted, but XP is still earned for correct answers.' },
]

const BADGES = [
  { name: 'Topic Star', description: 'Awarded for completing a topic quiz for the first time.' },
  { name: 'Perfect Score', description: 'Awarded for a 10/10 quiz with no hints used.' },
  { name: 'Subject Champion', description: 'Awarded when all topics in a subject are completed.' },
  { name: 'Streak 7', description: 'Awarded for maintaining a 7-day learning streak.' },
  { name: 'Guardian Slayer', description: 'Awarded for defeating a Zone Guardian.' },
]

const RARITIES = [
  { name: 'Common',    color: '#718096', desc: 'The most frequent drop.',         chance: 40 },
  { name: 'Uncommon',  color: '#52D9A0', desc: 'A little harder to collect.',     chance: 25 },
  { name: 'Rare',      color: '#6C9EFF', desc: 'Worth showing off.',              chance: 15 },
  { name: 'Epic',      color: '#FF8FAB', desc: 'Impressive. Not often seen.',     chance: 10 },
  { name: 'Legendary', color: '#FFC107', desc: 'Zone Guardian reward only.',      chance: 10 },
]

const MUST_NOT = [
  'Create anxiety about missing a day or losing a streak.',
  'Make children feel behind, less capable, or embarrassed.',
  'Reward time-spent over learning-achieved.',
  'Use dark patterns, false urgency, or exploitative loops.',
  'Give parents information that labels or ranks children negatively.',
]
