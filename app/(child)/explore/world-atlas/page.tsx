import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { loadExplorer } from '@/lib/explore/load'
import type { AtlasExplorer } from '@/lib/explore/types'
import { WorldAtlasExperience } from '@/components/explore/WorldAtlasExperience'

export const metadata = { title: 'World Atlas — Decifer Learning' }

export default async function WorldAtlasPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const explorer = await loadExplorer<AtlasExplorer>('world-atlas')

  if (!explorer || explorer.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#020408' }}>
        <p className="text-4xl">🌍</p>
        <p className="text-white/80 font-semibold">This explorer is being prepared.</p>
        <p className="text-white/40 text-sm">Check back soon — the world is loading.</p>
        <Link href="/explore" className="mt-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white/80">← Back to Explore</Link>
      </div>
    )
  }

  return <WorldAtlasExperience explorer={explorer} />
}
