import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { loadExplorer } from '@/lib/explore/load'
import { SolarSystemExperience } from '@/components/explore/SolarSystemExperience'

export const metadata = { title: 'Solar System — Decifer Learning' }

export default async function SolarSystemPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const explorer = await loadExplorer('solar-system')

  if (!explorer || explorer.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#000008' }}>
        <p className="text-4xl">🪐</p>
        <p className="text-white/80 font-semibold">This explorer is being prepared.</p>
        <p className="text-white/40 text-sm">Check back soon — the cosmos is loading.</p>
        <Link href="/explore" className="mt-2 rounded-full bg-surface/10 px-5 py-2 text-sm font-semibold text-white/80">← Back to Explore</Link>
      </div>
    )
  }

  return <SolarSystemExperience explorer={explorer} />
}
