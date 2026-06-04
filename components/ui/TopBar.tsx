import Link from 'next/link'
import { DeciferLogo } from './DeciferLogo'
import { SignOutButton } from './SignOutButton'

export function TopBar({
  displayName,
  showAdminLink = false,
}: {
  displayName: string
  showAdminLink?: boolean
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between gap-3 px-4">
        <Link href="/dashboard" aria-label="DECIFER Learning dashboard">
          <DeciferLogo size="sm" product="Learning" />
        </Link>
        <div className="flex items-center gap-3">
          {showAdminLink && (
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-1 rounded-lg bg-lightning/20 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-lightning/40 transition-colors"
            >
              ⚙ Admin
            </Link>
          )}
          <span className="hidden text-sm text-muted sm:inline" aria-label="Signed-in user">
            {displayName}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
