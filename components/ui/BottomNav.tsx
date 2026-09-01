'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, UserCircle, Gamepad } from '@/components/ui/icons'
import type { SVGProps } from 'react'

type TabIcon = (props: SVGProps<SVGSVGElement> & { size?: number }) => JSX.Element

// Four tabs, not seven. Seven gave each one 53px of a 375px phone with a 10px
// label under it, which is smaller than the 48px tap target this project
// requires. It also put "Home" on the world map and "Progress" on the screen
// that actually says what to do next, which is backwards.
//
// Learn is now the child's home: the one-thing-to-do-next screen. The four
// that came off the bar (world map, Explore, Exams, and the duplicate
// Progress) all live in the tile grid on that screen, three across.
const TABS: { href: string; label: string; Icon: TabIcon }[] = [
  { href: '/dashboard/child', label: 'Learn',   Icon: Home },
  { href: '/downtime',        label: 'Games',   Icon: Gamepad },
  { href: '/collection',      label: 'Cards',   Icon: LayoutGrid },
  { href: '/profile',         label: 'Profile', Icon: UserCircle },
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
              className={`flex min-h-[56px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-center transition-[color,transform] duration-fast ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                active ? 'text-sea-deep' : 'text-muted hover:text-ink'
              }`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-fast ${active ? 'bg-sea-soft' : ''}`}>
                <tab.Icon size={22} aria-hidden />
              </span>
              <span className={`text-[10px] leading-tight ${active ? 'font-bold text-sea-deep' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
