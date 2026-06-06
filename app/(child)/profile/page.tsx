import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import {
  Star, Flame, Layers, Trophy, Shield, PencilLine,
  Compass, Gem, Crown, Leaf, Target, Fox, Medal,
} from '@/components/ui/icons'

export const metadata = { title: 'My Profile — Decifer Learning' }
export const dynamic = 'force-dynamic'

const RARITY_TOKEN: Record<string, { bg: string; text: string; border: string; label: string }> = {
  common:    { bg: 'var(--common-bg)',    text: 'var(--common)',    border: 'var(--common-bdr)',    label: 'Common'    },
  uncommon:  { bg: 'var(--uncommon-bg)',  text: 'var(--uncommon)',  border: 'var(--uncommon-bdr)',  label: 'Uncommon'  },
  rare:      { bg: 'var(--rare-bg)',      text: 'var(--rare)',      border: 'var(--rare-bdr)',      label: 'Rare'      },
  epic:      { bg: 'var(--epic-bg)',      text: 'var(--epic)',      border: 'var(--epic-bdr)',      label: 'Epic'      },
  legendary: { bg: 'var(--legendary-bg)', text: 'var(--legendary)', border: 'var(--legendary-bdr)', label: 'Legendary' },
}

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) redirect('/dashboard')

  const displayName = profile.display_name ?? getUserDisplayName(user)
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile.year_group_label)

  // Fetch badges, recent quizzes, collection count, and avatar config in parallel
  const [profileBadges, recentAttempts, collectionCount, completedTopics, rawProfile] = await Promise.all([
    prisma.profileBadge.findMany({
      where: { profile_id: profile.id },
      include: { badge: { select: { name: true, description: true, icon_url: true } } },
      orderBy: { awarded_at: 'desc' },
    }),
    prisma.quizAttempt.findMany({
      where: { profile_id: profile.id },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { topic: { select: { id: true, title: true, subject: { select: { name: true, colour_token: true } } } } },
    }),
    prisma.childCollection.count({ where: { profile_id: profile.id } }),
    prisma.topicProgress.count({ where: { profile_id: profile.id, status: 'completed' } }),
    prisma.profile.findUnique({
      where: { id: profile.id },
      select: { avatar_config: true, study_buddy: true },
    }),
  ])

  const points = profile.total_points ?? 0
  const streak = profile.streak_days ?? 0

  // XP level: every 500 points = 1 level
  const level = Math.floor(points / 500) + 1
  const xpInLevel = points % 500
  const xpPct = Math.round((xpInLevel / 500) * 100)

  const avatarCfg = rawProfile?.avatar_config as { base?: string; colour?: string } | null
  const avatarColour = avatarCfg?.colour ?? 'var(--brand)'

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="font-heading text-2xl font-extrabold"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
        >
          My Profile
        </h1>
        <Link
          href="/customise"
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors hover:opacity-80"
          style={{
            background: 'var(--brand-light)',
            color: 'var(--brand)',
            fontFamily: 'var(--font-display)',
            borderRadius: 'var(--radius-button)',
          }}
        >
          <PencilLine size={14} aria-hidden />
          Edit
        </Link>
      </div>

      {/* Avatar + name card */}
      <div
        className="flex items-center gap-4 rounded-2xl p-5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {/* Avatar circle */}
        <div
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ background: avatarColour, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          aria-hidden
        >
          {avatarCfg?.base ? <span>{avatarCfg.base}</span> : <Fox className="w-8 h-8" aria-hidden />}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate font-extrabold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-h3)',
              color: 'var(--text-heading)',
            }}
          >
            {displayName}
          </p>
          {yearGroup && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {yearGroup.display} · {yearGroup.keyStage}
            </p>
          )}
          <p
            className="mt-1 text-xs font-bold"
            style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
          >
            Level {level}
          </p>
        </div>
      </div>

      {/* XP bar */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--xp-bg)',
          border: '1px solid var(--legendary-bdr)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 text-sm font-bold"
            style={{ color: 'var(--xp)', fontFamily: 'var(--font-display)' }}
          >
            <Star size={14} aria-hidden />
            {points.toLocaleString()} XP total
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {xpInLevel} / 500 to Level {level + 1}
          </span>
        </div>
        <div
          className="h-3 overflow-hidden"
          style={{ background: 'var(--border-default)', borderRadius: 'var(--radius-pill)' }}
          role="progressbar"
          aria-valuenow={xpPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Level ${level} XP progress`}
        >
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${xpPct}%`,
              background: 'var(--legendary-gradient)',
              borderRadius: 'var(--radius-pill)',
            }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, value: streak, label: 'Day streak', color: 'var(--streak)', bg: 'var(--streak-bg)' },
          { icon: Target, value: completedTopics, label: 'Topics done', color: 'var(--correct)', bg: 'var(--success-bg)' },
          { icon: Layers, value: collectionCount, label: 'Cards', color: 'var(--rare)', bg: 'var(--rare-bg)' },
        ].map(({ icon: Icon, value, label, color, bg }) => (
          <div
            key={label}
            className="flex flex-col items-center rounded-2xl py-4"
            style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 'var(--radius-card)' }}
          >
            <Icon size={20} style={{ color }} aria-hidden />
            <p
              className="mt-1 font-extrabold"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', color: 'var(--text-heading)' }}
            >
              {value}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {profileBadges.length > 0 && (
        <div>
          <h2
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            Badges earned
          </h2>
          <div className="flex flex-wrap gap-2">
            {profileBadges.map(({ badge, awarded_at }) => (
              <div
                key={badge.name}
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-chip)',
                  boxShadow: 'var(--shadow-card)',
                }}
                title={`${badge.description} — earned ${new Date(awarded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              >
                {badge.icon_url ? <img src={badge.icon_url} className="w-5 h-5" alt="" /> : <Medal className="w-5 h-5" aria-hidden />}
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profileBadges.length === 0 && (
        <div
          className="flex flex-col items-center rounded-2xl px-5 py-8 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-card)' }}
        >
          <Trophy size={32} style={{ color: 'var(--text-muted)' }} aria-hidden />
          <p
            className="mt-2 font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            No badges yet
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Complete topics and quizzes to earn your first badge.
          </p>
        </div>
      )}

      {/* Recent quiz attempts */}
      {recentAttempts.length > 0 && (
        <div>
          <h2
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            Recent activity
          </h2>
          <div className="space-y-2">
            {recentAttempts.map((attempt) => {
              const pct = Math.round(attempt.score * 100)
              const passed = pct >= 70
              return (
                <Link
                  key={attempt.id}
                  href={`/topics/${attempt.topic.id}/learn`}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:opacity-80 active:opacity-70"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-card)',
                  }}
                >
                  <div
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: attempt.topic.subject.colour_token }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                    >
                      {attempt.topic.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {attempt.topic.subject.name} ·{' '}
                      {new Date(attempt.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span
                    className="flex-none text-sm font-bold"
                    style={{ color: passed ? 'var(--correct)' : 'var(--incorrect)', fontFamily: 'var(--font-display)' }}
                  >
                    {pct}%
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link
          href="/collection"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{
            background: 'var(--rare-bg)',
            color: 'var(--rare)',
            border: '1px solid var(--rare-bdr)',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <Layers size={16} aria-hidden /> My Cards
        </Link>
        <Link
          href="/customise"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{
            background: 'var(--brand-light)',
            color: 'var(--brand)',
            border: '1px solid var(--brand-border)',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <PencilLine size={16} aria-hidden /> Customise
        </Link>
      </div>
    </section>
  )
}
