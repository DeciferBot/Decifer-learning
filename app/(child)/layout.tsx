export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
import { childNeedsOnboarding } from '@/lib/onboarding'
import { TopBar } from '@/components/ui/TopBar'
import { BottomNav } from '@/components/ui/BottomNav'

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = getUserRole(user)
  // Non-child roles get bounced to their own dashboard
  if (role && role !== 'child') redirect('/dashboard')

  // First-run gate: a child who hasn't seen the avatar + about-me prompt goes
  // to /onboarding (which lives outside this route group, so no redirect loop).
  if (await childNeedsOnboarding(user.id)) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={getUserDisplayName(user)} />
      {/* pb-20 keeps content clear of the 56px bottom nav + safe-area inset */}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-10 py-6 pb-24">{children}</div>
      <BottomNav />
    </div>
  )
}
