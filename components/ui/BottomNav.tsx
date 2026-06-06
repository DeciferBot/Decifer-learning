'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MapFold, LayoutGrid, UserCircle, Telescope } from '@/components/ui/icons'
import type { SVGProps } from 'react'

type TabIcon = (props: SVGProps<SVGSVGElement> & { size?: number }) => JSX.Element

const TABS: { href: string; label: string; Icon: TabIcon }[] = [
  { href: '/world-map',       label: 'Home',       Icon: Home },
  { href: '/dashboard/child', label: 'Progress',   Icon: MapFold },
  { href: '/explore',         label: 'Explore',    Icon: Telescope },
  { href: '/collection',      label: 'Cards',      Icon: LayoutGrid },
  { href: '/profile',          label: 'Profile',    Icon: UserCircle },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      {/* paddingBottom: safe-area-inset-bottom keeps tabs above iPhone home indicator */}
      <div
        className="mx-auto flex max-w-screen-md items-center justify-around px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[56px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center transition-colors ${
                active ? 'text-brand' : 'text-muted hover:text-ink'
              }`}
            >
              <tab.Icon size={22} aria-hidden />
              <span className={`text-[10px] font-semibold leading-tight ${active ? 'text-brand' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
