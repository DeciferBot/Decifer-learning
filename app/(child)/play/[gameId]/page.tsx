import { redirect } from 'next/navigation'

// The live game view is the public, unified /live/[gameId] surface (works for
// both logged-in players and guests). Keep this path as a redirect so any old
// links still land in the right place.
export default function LegacyPlayGameRedirect({ params }: { params: { gameId: string } }) {
  redirect(`/live/${params.gameId}`)
}
