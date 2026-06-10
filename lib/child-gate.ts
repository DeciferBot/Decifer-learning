// Combined per-request gate data for the child-facing layouts.
//
// The (child) layout previously ran three sequential reads on every
// navigation — onboarding check, theme lookup, consent gate — each a separate
// database round-trip. They all derive from the same profiles row, so this
// helper fetches the row (plus the family link) once, in parallel, and the
// layout derives everything locally. Memoized per request tree so the layout
// and any page that also needs it share one fetch.

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { evaluateConsentGate, type ConsentGate } from '@/lib/parental-consent'

export type ChildGate = {
  /** profiles.role, or null when no profile row exists yet */
  role: string | null
  /** child has never completed the first-run onboarding prompt */
  needsOnboarding: boolean
  /** saved theme name, 'default' when unset */
  theme: string
  consent: ConsentGate
}

export const getChildGate = cache(async (userId: string): Promise<ChildGate> => {
  const [profile, link] = await Promise.all([
    prisma.profile.findUnique({
      where: { user_id: userId },
      select: {
        role: true,
        onboarded_at: true,
        theme_name: true,
        parent_email: true,
        parent_email_verified_at: true,
        created_at: true,
      },
    }),
    prisma.familyLink.findUnique({
      where: { child_user_id: userId },
      select: { id: true },
    }),
  ])

  return {
    role: profile?.role ?? null,
    needsOnboarding: !!profile && profile.role === 'child' && profile.onboarded_at === null,
    theme: profile?.theme_name ?? 'default',
    consent: evaluateConsentGate(profile, !!link),
  }
})
