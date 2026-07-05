import Link from 'next/link'
import { Lock } from '@/components/ui/icons'

type Props = {
  topicTitle?: string
  subjectName?: string
}

export function UpgradeWall({ topicTitle, subjectName }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-maths/10">
        <Lock className="w-8 h-8 text-maths" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-bold text-ink">
        {topicTitle ? `${topicTitle} is on the Family plan` : 'This topic is on the Family plan'}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        {subjectName
          ? `${subjectName} topics are included in the Family plan. Free accounts include 3 Maths topics.`
          : 'The Family plan unlocks all five subjects and every year group — Maths, English, Science, History and Geography from Year 1 to Year 11.'}
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        <Link
          href="/pricing"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-maths font-semibold text-white transition active:scale-[0.98]"
        >
          See plans — from AED 350/mo
        </Link>
        <Link
          href="/dashboard/child"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-black/10 bg-white text-sm font-semibold text-ink transition hover:bg-black/5"
        >
          Back to home
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted">
        Already subscribed?{' '}
        <Link href="/dashboard/parent" className="font-semibold text-maths underline">
          Check your account
        </Link>
      </p>
    </div>
  )
}
