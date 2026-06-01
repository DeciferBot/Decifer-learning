// First-run onboarding gate helper.
//
// A child who has never seen the avatar + about-me prompt (onboarded_at IS NULL)
// is redirected to /onboarding. Parents/admins are never gated. /onboarding lives
// OUTSIDE the (child) route group, so redirecting to it from the (child) layout
// cannot loop. Memoized per request tree to avoid duplicate reads.

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const childNeedsOnboarding = cache(async (userId: string): Promise<boolean> => {
  const profile = await prisma.profile.findUnique({
    where:  { user_id: userId },
    select: { role: true, onboarded_at: true },
  })
  return !!profile && profile.role === 'child' && profile.onboarded_at === null
})
