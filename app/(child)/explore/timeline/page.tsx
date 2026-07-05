import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { loadExplorer } from '@/lib/explore/load'
import type { TimelineExplorer } from '@/lib/explore/types'
import { HistoryTimelineExperience } from '@/components/explore/HistoryTimelineExperience'

export const metadata = { title: 'History Timeline' }

export default async function TimelinePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const explorer = await loadExplorer<TimelineExplorer>('timeline')
  if (!explorer || explorer.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#0d0810' }}>
        <p className="text-4xl">⏳</p>
        <p className="text-white/80 font-semibold">This explorer is being prepared.</p>
        <Link href="/explore" className="mt-2 rounded-full bg-surface/10 px-5 py-2 text-sm font-semibold text-white/80">← Back to Explore</Link>
      </div>
    )
  }
  return <HistoryTimelineExperience explorer={explorer} />
}
