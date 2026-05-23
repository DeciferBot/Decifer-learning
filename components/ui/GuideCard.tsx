import Link from 'next/link'

interface GuideCardProps {
  icon: string
  title: string
  description: string
  href: string
  audience?: 'parent' | 'student' | 'general'
}

const AUDIENCE_ACCENT: Record<string, string> = {
  parent:  'border-maths/20 hover:border-maths/40 hover:bg-maths/5',
  student: 'border-brand/20 hover:border-brand/40 hover:bg-brand-50',
  general: 'border-black/8 hover:border-black/15 hover:bg-black/[0.02]',
}

export function GuideCard({ icon, title, description, href, audience = 'general' }: GuideCardProps) {
  const accent = AUDIENCE_ACCENT[audience] ?? AUDIENCE_ACCENT.general

  return (
    <Link
      href={href}
      className={`flex items-start gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition-colors ${accent}`}
    >
      <span className="mt-0.5 flex-none text-2xl" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="font-heading font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <span className="ml-auto flex-none text-muted" aria-hidden>→</span>
    </Link>
  )
}
