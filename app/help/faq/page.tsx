import Link from 'next/link'

export const metadata = {
  title: 'FAQ — Decifer Learning',
}

export default function FAQPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Frequently asked questions</h1>
        <p className="mt-2 text-muted">
          Common questions from parents and students.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          For parents
        </h2>
        <FAQList items={PARENT_FAQS} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          For students
        </h2>
        <FAQList items={STUDENT_FAQS} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          About the content
        </h2>
        <FAQList items={CONTENT_FAQS} />
      </section>

      <div className="rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-sm font-semibold text-ink">Still have a question?</p>
        <p className="mt-1 text-sm text-muted">
          Browse the rest of the guides in{' '}
          <Link href="/help" className="font-semibold text-brand hover:underline">Help</Link>.
        </p>
      </div>
    </div>
  )
}

function FAQList({ items }: { items: { q: string; a: string | React.ReactNode }[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-2xl border border-black/5 bg-surface shadow-sm"
        >
          <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-4 px-5 py-3 font-semibold text-ink marker:hidden list-none">
            <span>{item.q}</span>
            <span className="flex-none text-muted transition-transform group-open:rotate-45 text-lg leading-none" aria-hidden>+</span>
          </summary>
          <div className="border-t border-black/5 px-5 py-4 text-sm text-muted">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  )
}

const PARENT_FAQS = [
  {
    q: 'How do I link my child\'s account to mine?',
    a: 'After your child registers with their own email address, go to your parent dashboard and enter their email in the "Link a child account" section. You\'ll immediately be able to see their progress.',
  },
  {
    q: 'Can I see what questions my child answered?',
    a: 'The parent dashboard shows topic-level progress, accuracy, areas to strengthen, and recommended next lessons. Individual question answers are not exposed to preserve your child\'s confidence and privacy.',
  },
  {
    q: 'Is the content safe and age-appropriate?',
    a: 'Yes. Every question passes a multi-stage automated pipeline including a constitutional critique that explicitly checks for age-appropriateness and cultural sensitivity. Only published content is ever shown to children. See our content quality guide for full details.',
  },
  {
    q: 'What year groups does Decifer cover?',
    a: 'Currently Year 3 (KS2) and Year 7 (KS3). More year groups are planned for future releases.',
  },
  {
    q: 'What subjects are available?',
    a: 'Maths, English, and Science. Maths is the most complete subject — English and Science content is expanding.',
  },
  {
    q: 'How do screen-time controls work?',
    a: 'Screen-time controls (daily time limits and allowed hours) are coming in a future update. The parent dashboard will let you set limits per child.',
  },
]

const STUDENT_FAQS = [
  {
    q: 'What happens if I fail a quiz?',
    a: 'Nothing bad. You can retry any quiz as many times as you like. There\'s no permanent penalty for failing. Your highest score is what counts towards your progress.',
  },
  {
    q: 'What do hints cost?',
    a: 'Each hint costs a small number of XP points. Hint 1 costs the least and Hint 3 costs a bit more. But it\'s always worth using a hint if you\'re stuck — understanding the hint is better than guessing.',
  },
  {
    q: 'Can I lose my Discovery Cards?',
    a: 'No. Once you collect a card, it stays in your collection forever. Cards can\'t be lost, traded, or removed.',
  },
  {
    q: 'Why does my streak show as zero?',
    a: 'Your streak resets if you miss a full day without logging in. If you had a Streak Shield, it would have been used automatically to protect it. You can earn more shields by completing quizzes.',
  },
  {
    q: 'What\'s a Zone Guardian?',
    a: 'Each zone on the World Map has a Zone Guardian boss. To challenge them, you need to complete all the topic quizzes in that zone. The Guardian quiz has 15 questions from across the zone. Defeat the Guardian to earn a Legendary Discovery Card.',
  },
  {
    q: 'What do the three quiz tiers mean?',
    a: 'Each topic has questions at three levels: Sprout (foundational), Explorer (standard), and Lightning (stretching). The quiz mixes these to match your current level and slowly challenge you more as you improve.',
  },
]

const CONTENT_FAQS = [
  {
    q: 'Who writes the questions?',
    a: 'Questions are generated by AI using only approved curriculum source material. Every question then passes six automated quality checks, including mathematical verification by code and a constitutional review for age-appropriateness. No question reaches a child unless it has passed all checks.',
  },
  {
    q: 'What if a question is wrong?',
    a: 'Use the "Report a problem" button shown on quiz questions. Reported questions are reviewed and, if confirmed incorrect, immediately removed from the pool and sent for regeneration. Automated monitoring also catches questions with high error rates each night.',
  },
  {
    q: 'Does Decifer follow the UK National Curriculum?',
    a: 'Yes. All topics, questions, and lessons are structured around UK National Curriculum outcomes for the covered year groups.',
  },
]
