import Link from 'next/link'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Explore — Decifer Learning' }

interface Aid {
  id: string
  title: string
  tagline: string
  emoji: string
  gradient: string
  href: string
  available: boolean
  badge?: string
}

const AIDS: Aid[] = [
  {
    id: 'solar-system',
    title: 'Solar System',
    tagline: 'Spin planets, discover moons, explore the cosmos',
    emoji: '🪐',
    gradient: 'linear-gradient(135deg, #0d1b3e 0%, #1a237e 50%, #283593 100%)',
    href: '/explore/solar-system',
    available: true,
    badge: 'NEW',
  },
  {
    id: 'world-atlas',
    title: 'World Atlas',
    tagline: 'Tap countries, explore cultures, find hidden facts',
    emoji: '🌍',
    gradient: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 50%, #40916c 100%)',
    href: '/explore/world-atlas',
    available: true,
    badge: 'NEW',
  },
  {
    id: 'human-body',
    title: 'Human Body',
    tagline: 'Journey inside — organs, systems, and how you work',
    emoji: '🫀',
    gradient: 'linear-gradient(135deg, #641220 0%, #85182a 50%, #a11d33 100%)',
    href: '/explore/human-body',
    available: true,
    badge: 'NEW',
  },
  {
    id: 'timeline',
    title: 'History Timeline',
    tagline: 'Travel through time from dinosaurs to today',
    emoji: '⏳',
    gradient: 'linear-gradient(135deg, #4a1942 0%, #6d3b47 50%, #7b4b6b 100%)',
    href: '/explore/timeline',
    available: true,
    badge: 'NEW',
  },
  {
    id: 'periodic-table',
    title: 'Periodic Table',
    tagline: 'Tap elements, discover chemistry, see how matter is built',
    emoji: '⚗️',
    gradient: 'linear-gradient(135deg, #002147 0%, #003580 50%, #004a9f 100%)',
    href: '/explore/periodic-table',
    available: true,
    badge: 'NEW',
  },
  {
    id: 'animal-kingdom',
    title: 'Animal Kingdom',
    tagline: 'Meet species, explore habitats, discover wildlife',
    emoji: '🦁',
    gradient: 'linear-gradient(135deg, #3e2723 0%, #5d4037 50%, #795548 100%)',
    href: '/explore/animal-kingdom',
    available: true,
    badge: 'NEW',
  },
]

export default async function ExplorePage() {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) redirect('/login')

  return (
    <section className="space-y-5 pb-8">
      {/* Header */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔭</span>
          <h1 className="font-heading text-2xl font-extrabold text-ink">Explore</h1>
        </div>
        <p className="text-sm text-muted leading-snug">
          No tests. No pressure. Just curiosity. Tap anything, ask anything.
        </p>
      </div>

      {/* Ask Decifer callout */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #1a1a3e, #2d2d60)', border: '1px solid rgba(108,158,255,0.2)' }}
      >
        <span className="text-2xl flex-none">🔭</span>
        <div>
          <p className="text-sm font-bold text-white">Ask Decifer anything</p>
          <p className="text-xs text-white/50 mt-0.5">Your curious guide is available inside every explorer</p>
        </div>
      </div>

      {/* Aid cards grid */}
      <div className="grid grid-cols-1 gap-3">
        {AIDS.map((aid) => (
          <AidCard key={aid.id} aid={aid} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted px-4">
        New explorers are added all the time ✨
      </p>
    </section>
  )
}

function AidCard({ aid }: { aid: Aid }) {
  if (!aid.available) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-5 opacity-60"
        style={{ background: aid.gradient, border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{aid.emoji}</span>
            <div>
              <p className="font-heading text-lg font-bold text-white">{aid.title}</p>
              <p className="text-xs text-white/50 mt-0.5 leading-snug max-w-[200px]">{aid.tagline}</p>
            </div>
          </div>
          <span className="flex-none rounded-lg px-2.5 py-1 text-xs font-bold text-white/40" style={{ background: 'rgba(255,255,255,0.08)' }}>
            Coming soon
          </span>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={aid.href}
      className="relative overflow-hidden rounded-2xl px-5 py-5 transition-transform active:scale-[0.98]"
      style={{ background: aid.gradient, border: '1px solid rgba(255,255,255,0.15)' }}
    >
      {/* Glow */}
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full blur-2xl opacity-20" style={{ background: 'white' }} />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-4xl drop-shadow-lg">{aid.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-heading text-lg font-bold text-white">{aid.title}</p>
              {aid.badge && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: '#FFD43B', color: '#000' }}>
                  {aid.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-white/70 mt-0.5 leading-snug max-w-[200px]">{aid.tagline}</p>
          </div>
        </div>
        <div
          className="flex-none w-9 h-9 rounded-full flex items-center justify-center font-bold text-base"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <span className="text-white">→</span>
        </div>
      </div>
    </Link>
  )
}
