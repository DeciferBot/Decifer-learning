import { GuideCard } from '@/components/ui/GuideCard'

export const metadata = {
  title: 'Help — Decifer Learning',
}

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Help &amp; guides</h1>
        <p className="mt-2 text-muted">
          Everything you need to get started, understand how Decifer works, and make
          the most of your learning journey.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          For parents
        </h2>
        <GuideCard
          icon="👨‍👩‍👧"
          title="Parent guide"
          description="Set up your child's account, track progress, and support their learning at home."
          href="/help/parent-guide"
          audience="parent"
        />
        <GuideCard
          icon="✅"
          title="Content quality"
          description="How every question and lesson is checked before your child ever sees it."
          href="/help/content-quality"
          audience="parent"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          For students
        </h2>
        <GuideCard
          icon="🎒"
          title="Student guide"
          description="How to use Decifer: lessons, practice, quizzes, XP, cards, and streaks."
          href="/help/student-guide"
          audience="student"
        />
        <GuideCard
          icon="⭐"
          title="Gamification explained"
          description="XP, badges, streaks, shields, and Discovery Cards: what they mean and how to earn them."
          href="/help/gamification"
          audience="student"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-muted">
          About Decifer
        </h2>
        <GuideCard
          icon="< >"
          title="How Decifer works"
          description="The thinking behind our lessons, practice, quiz structure, and guided learning approach."
          href="/help/how-decifer-works"
          audience="general"
        />
        <GuideCard
          icon="💬"
          title="Frequently asked questions"
          description="Answers to common questions from parents and students."
          href="/help/faq"
          audience="general"
        />
      </section>
    </div>
  )
}
