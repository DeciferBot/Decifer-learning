export const dynamic = 'force-dynamic'
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Flame, UserCircle } from '@/components/ui/icons'

interface Entry {
  id:           string
  displayName:  string
  totalPoints:  number
  streakDays:   number
  avatarEmoji:  string
  isMe:         boolean
}

const RANK_STYLE = [
  'bg-points-gold/20 text-points-gold',  // 1st
  'bg-black/10 text-muted',              // 2nd
  'bg-points-gold/10 text-points-gold',  // 3rd (bronze)
]

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading leaderboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center px-4">
        <p className="text-sm text-muted">Couldn&apos;t load the leaderboard right now.</p>
        <button onClick={() => window.location.reload()} className="text-xs text-brand underline">
          Try again
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center px-4">
        <Trophy size={40} className="text-points-gold" />
        <p className="font-heading text-lg font-bold text-ink">Leaderboard</p>
        <p className="text-sm text-muted max-w-xs">
          The leaderboard shows up once there are other family members on the app.
        </p>
        <Link href="/dashboard/child" className="mt-2 text-sm text-brand underline">
          Back to home
        </Link>
      </div>
    )
  }

  const me = entries.find((e) => e.isMe)

  return (
    <div className="max-w-lg mx-auto px-4 space-y-5 pb-8">
      <div className="flex items-center justify-between pt-2">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-ink"><Trophy size={22} className="text-points-gold" /> Leaderboard</h1>
        <Link href="/dashboard/child" className="text-sm text-muted hover:text-ink">
          ← Home
        </Link>
      </div>

      {/* Top 3 podium */}
      {entries.length >= 2 && (
        <div className="flex items-end justify-center gap-3 pt-2">
          {[entries[1], entries[0], entries[2]].filter(Boolean).map((e, idx) => {
            const positions = entries.length >= 3 ? [2, 1, 3] : [2, 1]
            const rank = positions[idx]
            const heights = entries.length >= 3 ? ['h-20', 'h-28', 'h-16'] : ['h-20', 'h-28']
            return (
              <div key={e.id} className="flex flex-col items-center gap-1">
                <UserCircle size={24} className="text-muted" />
                <p className={`text-xs font-bold ${e.isMe ? 'text-brand' : 'text-ink'} max-w-[64px] truncate`}>
                  {e.isMe ? 'You' : e.displayName.split(' ')[0]}
                </p>
                <div className={`${heights[idx]} w-16 flex items-end justify-center rounded-t-2xl ${RANK_STYLE[rank - 1] ?? 'bg-black/5 text-muted'}`}>
                  <p className="text-lg font-bold pb-2">#{rank}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full list */}
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
              e.isMe
                ? 'border-brand/30 bg-brand/5 shadow-sm'
                : 'border-black/5 bg-surface'
            }`}
          >
            <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${
              i === 0 ? 'bg-points-gold/20 text-points-gold' :
              i === 1 ? 'bg-black/10 text-muted' :
              i === 2 ? 'bg-points-gold/10 text-points-gold' :
              'bg-black/5 text-muted'
            }`}>
              {i + 1}
            </span>
            <UserCircle size={20} className="flex-none text-muted" />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${e.isMe ? 'text-brand' : 'text-ink'}`}>
                {e.isMe ? 'You' : e.displayName}
              </p>
              {e.streakDays > 0 && (
                <p className="flex items-center gap-1 text-xs text-muted"><Flame size={12} className="text-incorrect" />{e.streakDays} day streak</p>
              )}
            </div>
            <p className="flex-none font-heading font-bold text-ink">
              {e.totalPoints.toLocaleString()} <span className="text-xs text-muted font-normal">pts</span>
            </p>
          </div>
        ))}
      </div>

      {me && (
        <p className="text-center text-xs text-muted">
          You have <span className="font-bold text-ink">{me.totalPoints.toLocaleString()}</span> points total
        </p>
      )}
    </div>
  )
}
