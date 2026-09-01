// Combined per-request gate data for the child-facing layouts.
//
// The (child) layout previously ran two sequential reads on every
// navigation — onboarding check, theme lookup — each a separate database
// round-trip. They both derive from the same profiles row, so this helper
// fetches the row (plus the family link) once, in parallel, and the layout
// derives everything locally. Memoized per request tree so the layout and
// any page that also needs it share one fetch.

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export type ChildGate = {
  /** profiles.role, or null when no profile row exists yet */
  role: string | null
  /** child has never completed the first-run onboarding prompt */
  needsOnboarding: boolean
  /** saved theme name, 'default' when unset */
  theme: string
}

// Year-group label ('year-3', 'year-7', …) for the signed-in child.
// The Lessons section uses this to scope every query to the child's own year.
export const getChildYearGroupLabel = cache(async (userId: string): Promise<string | null> => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: { year_group: { select: { label: true } } },
  })
  return profile?.year_group?.label ?? null
})

export const getChildGate = cache(async (userId: string): Promise<ChildGate> => {
  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: {
      role: true,
      onboarded_at: true,
      theme_name: true,
    },
  })

  return {
    role: profile?.role ?? null,
    needsOnboarding: !!profile && profile.role === 'child' && profile.onboarded_at === null,
    theme: profile?.theme_name ?? 'default',
  }
})
