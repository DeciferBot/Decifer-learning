import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
import { TopBar } from '@/components/ui/TopBar'

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = getUserRole(user)
  // Non-child roles get bounced to their own dashboard
  if (role && role !== 'child') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={getUserDisplayName(user)} />
      <div className="mx-auto max-w-screen-md px-4 py-6">{children}</div>
    </div>
  )
}
