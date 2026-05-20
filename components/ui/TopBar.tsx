// Mobile-first top nav (CLAUDE.md §13). Phase 1: just brand + sign-out.
// Streak / points / avatar land in Phase 5/7 (CLAUDE.md §10 / §14).

import Link from 'next/link'
import { SignOutButton } from './SignOutButton'

export function TopBar({ displayName }: { displayName: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between gap-3 px-4">
        <Link
          href="/dashboard"
          className="font-heading text-base font-bold text-maths"
        >
          Decifer Learning
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline" aria-label="Signed-in user">
            {displayName}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
