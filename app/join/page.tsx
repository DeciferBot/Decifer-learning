export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getAuthUser } from '@/lib/supabase/server'
import { JoinPanel } from '@/components/live/JoinPanel'

// This is the link the host shares (/join?pin=…), so it needs its own Blitz OG
// card (app/join/opengraph-image.tsx) instead of inheriting the home page one.
export const metadata: Metadata = {
  title: 'Join a Decifer Blitz — Live quiz battle',
  description:
    'Tap to join a live quiz battle. Enter the code, pick a nickname, and play — no account needed, works on any device.',
  openGraph: {
    title: 'Join my Decifer Blitz!',
    description:
      'Tap to join a live quiz battle. Pick a nickname and play — no account needed, works on any device.',
    url: 'https://www.deciferlearning.com/join',
  },
  twitter: {
    title: 'Join my Decifer Blitz!',
    description:
      'Tap to join a live quiz battle. Pick a nickname and play — no account needed, works on any device.',
  },
}

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
