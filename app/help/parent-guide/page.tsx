import Link from 'next/link'

export const metadata = {
  title: 'Parent guide — Decifer Learning',
}

export default function ParentGuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Parent guide</h1>
        <p className="mt-2 text-muted">
          Everything you need to set up Decifer for your family and support your child&apos;s learning.
        </p>
        <p className="mt-3 rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 text-sm text-muted">
          Children feel progress. Parents see the learning behind it.
        </p>
      </div>

      <Section title="Getting started">
        <Steps items={[
          { n: 1, title: 'Create your parent account', body: 'Register on Decifer and choose "Parent" when asked for your role. Your account and your child\'s account are separate.' },
          { n: 2, title: 'Your child registers separately', body: 'Your child creates their own Decifer account. They choose "Student", select their year group (Year 3 or Year 7), and pick a display name.' },
          { n: 3, title: 'Link the accounts', body: 'In your parent dashboard, enter your child\'s registered email address to link the accounts. You\'ll then be able to see their progress.' },
          { n: 4, title: 'Your child logs in and starts learning', body: 'From their account, they can see their topics, begin lessons, and work through practice and quizzes.' },
        ]} />
      </Section>

      <Section title="What you can see">
        <ul className="space-y-3">
          {PARENT_CAN_SEE.map((item, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
              <span className="mt-0.5 text-lg" aria-hidden>{item.icon}</span>
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Understanding progress">
        <Prose>
          <p>The parent dashboard shows you an overview of each linked child&apos;s learning.</p>
          <p><strong>Topics started</strong> tells you how many topics your child has begun. <strong>Topics mastered</strong> means they scored 70% or above on the quiz. <strong>Average accuracy</strong> is their overall score across all quiz attempts.</p>
          <p>The <strong>Areas to strengthen</strong> section highlights topics where your child answered more questions incorrectly or needed the most help (Hint 3, the biggest hint). This is not a failure signal; it is exactly the information that helps you give the right encouragement.</p>
          <p><strong>Recommended next lesson</strong> suggests the most logical next step based on their current progress.</p>
        </Prose>
      </Section>

      <Section title="How content is structured">
        <Prose>
          <p>Decifer follows the UK National Curriculum. Year 3 content covers Key Stage 2 and Year 7 covers Key Stage 3. Subjects covered are Maths, English, and Science.</p>
          <p>Every topic has three stages: <strong>Learn</strong> (read the explanation), <strong>Practise</strong> (guided exercises), and <strong>Quiz</strong> (test understanding). Children must complete Learn before Practise, and Practise before Quiz, though they can revisit any stage at any time.</p>
        </Prose>
      </Section>

      <Section title="Content quality">
        <Prose>
          <p>Every question that your child sees has passed an automated quality pipeline. Questions are verified mathematically, checked by a second AI pass for accuracy and age-appropriateness, and reviewed for clarity and distractor quality. Only questions that pass all checks reach children.</p>
          <p>
            <Link href="/help/content-quality" className="font-semibold text-brand hover:underline">
              Read more about our content quality process →
            </Link>
          </p>
        </Prose>
      </Section>

      <Section title="Supporting your child">
        <ul className="space-y-2 text-muted">
          {SUPPORT_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex-none text-brand font-bold">·</span>
              <span className="text-sm">{tip}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-sm font-semibold text-ink">Questions?</p>
        <p className="mt-1 text-sm text-muted">
          Check the{' '}
          <Link href="/help/faq" className="font-semibold text-brand hover:underline">FAQ</Link>
          {' '}or browse the other guides in{' '}
          <Link href="/help" className="font-semibold text-brand hover:underline">Help</Link>.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Steps({ items }: { items: { n: number; title: string; body: string }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.n} className="flex items-start gap-4 rounded-xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-50 text-sm font-black text-brand font-heading">
            {item.n}
          </span>
          <div>
            <p className="font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 text-sm text-muted">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 text-sm text-muted [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
}

// ── Static content ──────────────────────────────────────────────────────────

const PARENT_CAN_SEE = [
  { icon: '📊', title: 'Topics started and mastered', body: 'A clear count of how many topics your child has begun and completed.' },
  { icon: '🎯', title: 'Average quiz accuracy', body: 'Their overall score across all quiz attempts, as a percentage.' },
  { icon: '📈', title: 'Activity this week', body: 'Quizzes taken in the last 7 days so you know if they\'re keeping up their habit.' },
  { icon: '⚠️', title: 'Areas to strengthen', body: 'Topics where your child struggled the most, shown as topics with high error rates.' },
  { icon: '➡️', title: 'Recommended next lesson', body: 'The most logical next topic to continue, based on their progress.' },
  { icon: '🏅', title: 'Badges and cards earned', body: 'A count of rewards earned, a quick signal of engagement and effort.' },
]

const SUPPORT_TIPS = [
  'Ask your child to show you their World Map and tell you about the zones they\'ve unlocked.',
  'Celebrate when they earn a badge or a new Discovery Card; the reward is the recognition, not the card.',
  'If they\'re struggling in a topic shown in "Areas to strengthen", try reviewing the Learn page together.',
  'A 10-minute session every day builds more confidence than a longer session once a week.',
  'Encourage streaks; even a 5-day streak is worth noticing and celebrating.',
  'If your child is frustrated after a quiz, remind them that hints exist and the quiz can always be retried.',
]
