'use client'

import Link from 'next/link'

interface ChildLink {
  profileId: string
  displayName: string
}

interface Props {
  currentChildId: string
  children: ChildLink[]
}

export function ChildSwitcher({ currentChildId, children }: Props) {
  if (children.length <= 1) return null

  return (
    <div className="flex items-center gap-2" aria-label="Switch child">
      {children.map((child) => {
        const isCurrent = child.profileId === currentChildId
        return (
          <Link
            key={child.profileId}
            href={`/dashboard/parent/children/${child.profileId}`}
            aria-current={isCurrent ? 'page' : undefined}
            className={[
              'min-h-[40px] rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
              isCurrent
                ? 'bg-maths/10 text-maths'
                : 'bg-black/[0.04] text-muted hover:bg-black/[0.08] hover:text-ink',
            ].join(' ')}
          >
            {child.displayName}
          </Link>
        )
      })}
    </div>
  )
}
