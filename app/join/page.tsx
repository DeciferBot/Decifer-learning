export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/supabase/server'
import { JoinPanel } from '@/components/live/JoinPanel'

// Public join surface — anyone can enter a PIN + nickname and play, no account
// needed (Kahoot style). Logged-in players skip the nickname.
export default async function JoinPage({
  searchParams,
}: {
  searchParams: { pin?: string }
}) {
  const user = await getAuthUser()
  const pin = (searchParams.pin ?? '').replace(/\D/g, '').slice(0, 6)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <JoinPanel isLoggedIn={!!user} initialPin={pin} />
    </main>
  )
}
