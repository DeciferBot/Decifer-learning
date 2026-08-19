'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'
import { Zap, Gamepad } from '@/components/ui/icons'

// Public marketing nav.
//
// The previous inline nav put five actions next to the logo with no wrapping
// guard. At 375px they shrank until "Sign in" and "Get started" broke onto two
// lines and spilled out of the 56px bar. There is only ~250px of room beside
// the logo on an iPhone SE, which is not enough for five controls at a 48px
// tap target, so below sm the secondary actions move into a menu and only the
// two a visitor actually reaches for stay on the bar: Games and Get started.
//
// Every control here is a 48px tap target (CLAUDE.md section 4), which is why
// the bar is 64px rather than the 56px it used to be.
//
// It also gave the marketing site no section navigation at all — Pricing,
// Subjects and How it works existed only in the footer. They are here now.

const SECTION_LINKS: { href: string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/subjects', label: 'Subjects' },
  { href: '/curriculum', label: 'Curriculum' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/games', label: 'Free games' },
  { href: '/blitz', label: 'Blitz' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Close on navigation, so tapping a menu link does not leave the panel open
  // behind the next page.
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus() }
    }
    function onPointer(e: PointerEvent) {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !toggleRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <nav className="sticky top-0 z-30 border-b border-black/5 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-1 px-1.5 sm:gap-2 sm:px-4">
        <Link href="/" aria-label="Decifer Learning home" className="flex min-h-[48px] shrink-0 items-center">
          <DeciferLogo size="sm" product="Learning" />
        </Link>

        {/* Section links — only once there is room for them to read as a row */}
        <div className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.slice(0, 4).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex h-12 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <DarkModeToggle size="lg" className="hidden sm:flex" />

          {/* Games — the surface a child asks for by name, so it keeps its
              label at every width rather than collapsing to a bare icon. */}
          <Link
            href="/games"
            className="flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-black/10 bg-surface px-2 text-[13px] font-semibold text-ink transition-colors hover:bg-black/5 sm:px-3 sm:text-sm"
          >
            <Gamepad size={16} aria-hidden />
            Games
          </Link>

          <Link
            href="/play"
            aria-label="Decifer Blitz live quiz"
            className="hidden h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#7C3AED] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] sm:flex"
          >
            <Zap size={15} aria-hidden />
            Blitz
          </Link>

          <Link
            href="/login"
            className="hidden h-12 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5 sm:flex"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="flex h-12 shrink-0 items-center whitespace-nowrap rounded-lg bg-brand-600 px-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 sm:px-4 sm:text-sm"
          >
            Get started
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="marketing-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-black/5 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Menu panel — everything that does not fit on the bar */}
      {open && (
        <div
          ref={panelRef}
          id="marketing-menu"
          className="border-t border-black/5 bg-background lg:hidden"
        >
          <div className="mx-auto max-w-5xl px-2 py-2 sm:px-4">
            {SECTION_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex min-h-[48px] items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-black/5 pt-2">
              <Link
                href="/login"
                className="flex min-h-[48px] flex-1 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5 sm:hidden"
              >
                Sign in
              </Link>
              <DarkModeToggle size="lg" className="sm:hidden" />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
