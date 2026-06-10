// First-run onboarding. Child-only. Already-onboarded children are bounced to
// their dashboard (they can revisit choices in Customise). Pre-fills any values
// already on the profile so a partial revisit isn't blank.

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { getUserRole, getUserDisplayName } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import type { LearningProfile } from '@/lib/onboarding-config'
import { OnboardingWizard } from './OnboardingWizard'

export const metadata = { title: 'Welcome — Decifer Learning' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (getUserRole(user) !== 'child') redirect('/dashboard')

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: {
      display_name: true,
      onboarded_at: true,
      avatar_config: true,
      study_buddy: true,
      theme_name: true,
      learning_profile: true,
    },
  })

  // Already seen the prompt — don't nag. Changes live in Customise from now on.
  if (profile?.onboarded_at) redirect('/dashboard/child')

  const avatarCfg = profile?.avatar_config as { base?: string; colour?: string } | null

  return (
    <OnboardingWizard
      displayName={profile?.display_name ?? getUserDisplayName(user)}
      initial={{
        avatarBase:   avatarCfg?.base ?? null,
        avatarColour: avatarCfg?.colour ?? 'blue',
        studyBuddy:   profile?.study_buddy ?? null,
        learning:     (profile?.learning_profile as LearningProfile | null) ?? {},
      }}
    />
  )
}
