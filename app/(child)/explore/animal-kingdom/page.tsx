import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { loadExplorer } from '@/lib/explore/load'
import type { AnimalExplorer } from '@/lib/explore/types'
import { AnimalKingdomExperience } from '@/components/explore/AnimalKingdomExperience'

export const metadata = { title: 'Animal Kingdom — Decifer Learning' }

export default async function AnimalKingdomPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const explorer = await loadExplorer<AnimalExplorer>('animal-kingdom')
  if (!explorer || explorer.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#0e0a08' }}>
        <p className="text-4xl">🦁</p>
        <p className="text-white/80 font-semibold">This explorer is being prepared.</p>
        <Link href="/explore" className="mt-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white/80">← Back to Explore</Link>
      </div>
    )
  }
  return <AnimalKingdomExperience explorer={explorer} />
}
