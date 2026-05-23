import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { getVaultStatus } from '@/lib/vault/status'
import { RequestSection } from './RequestSection'

export const metadata = { title: 'Reward Vault — Decifer Learning' }

const BAND_CONFIG = {
  none:     { label: 'No milestone yet', emoji: '🔒', colour: 'bg-black/5 text-muted' },
  bronze:   { label: 'Bronze Explorer',  emoji: '🥉', colour: 'bg-amber-50 text-amber-700' },
  silver:   { label: 'Silver Achiever',  emoji: '🥈', colour: 'bg-slate-100 text-slate-600' },
  gold:     { label: 'Gold Champion',    emoji: '🥇', colour: 'bg-yellow-50 text-yellow-700' },
  platinum: { label: 'Platinum Master',  emoji: '💎', colour: 'bg-purple-50 text-purple-700' },
} as const

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/5">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemax={total}
      />
    </div>
  )
}

export default async function VaultPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) notFound()

  const status = await getVaultStatus(profile.id)

  // Load family reward options from parent settings (Prisma reads with service role — bypasses RLS)
  const parentLinks = await prisma.familyLink.findMany({
    where: { child_user_id: user.id },
    include: { parent: { select: { id: true } } },
  })
  const parentSettings = parentLinks.length > 0
    ? await prisma.vaultParentSettings.findUnique({
        where: {
          parent_profile_id_child_profile_id: {
            parent_profile_id: parentLinks[0].parent.id,
            child_profile_id: profile.id,
          },
        },
        select: { family_reward_options: true },
      })
    : null

  const familyRewardOptions = (
    (parentSettings?.family_reward_options ?? []) as Array<{ label: string }>
  )

  const bandCfg = BAND_CONFIG[status.currentBand] ?? BAND_CONFIG.none
  const next = status.nextMilestone
  const progress = status.progressToNext

  const hasPendingRequest = status.pendingRequest !== null && (
    ['pending', 'deferred', 'counter_offered'].includes(status.pendingRequest.status)
  )

  // Serialise dates for the client component
  const serialisedPendingRequest = status.pendingRequest
    ? {
        ...status.pendingRequest,
        createdAt: status.pendingRequest.createdAt.toISOString(),
      }
    : null

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Reward Vault</h1>
        <p className="mt-1 text-sm text-muted">
          Reach milestones to earn reward credits — then claim a reward with your parent.
        </p>
      </div>

      {/* ── Current status card ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${bandCfg.colour}`}>
            <span>{bandCfg.emoji}</span>
            <span>{bandCfg.label}</span>
          </div>
          <div className="flex items-center gap-1 text-right">
            <span className="font-heading text-xl font-bold text-brand">
              {status.creditBalance}
            </span>
            <span className="text-xs text-muted">
              {status.creditBalance === 1 ? 'credit' : 'credits'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
          <div>
            <div className="font-heading text-base font-bold text-ink">{status.currentXP.toLocaleString()}</div>
            <div>XP</div>
          </div>
          <div>
            <div className="font-heading text-base font-bold text-ink">{status.currentTopicsCompleted}</div>
            <div>topics done</div>
          </div>
          <div>
            <div className="font-heading text-base font-bold text-ink">{status.currentBadgeCount}</div>
            <div>badges</div>
          </div>
        </div>
      </div>

      {/* ── Request section ──────────────────────────────────────────────── */}
      <RequestSection
        hasCredits={status.creditBalance > 0}
        hasPendingRequest={hasPendingRequest}
        pendingRequest={serialisedPendingRequest}
        familyRewardOptions={familyRewardOptions}
      />

      {/* ── Progress to next milestone ───────────────────────────────────── */}
      {next && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Next milestone</p>
            <p className="mt-1 font-heading text-base font-bold text-ink">{next.displayName}</p>
          </div>

          <div className="space-y-3">
            {/* XP */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted">
                <span>XP</span>
                <span>{status.currentXP.toLocaleString()} / {next.xpRequired.toLocaleString()}</span>
              </div>
              <ProgressBar current={status.currentXP} total={next.xpRequired} />
              {progress.xpNeeded > 0 && (
                <p className="text-xs text-muted">{progress.xpNeeded.toLocaleString()} XP to go</p>
              )}
            </div>

            {/* Topics */}
            {next.topicsRequired > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Topics completed</span>
                  <span>{status.currentTopicsCompleted} / {next.topicsRequired}</span>
                </div>
                <ProgressBar current={status.currentTopicsCompleted} total={next.topicsRequired} />
              </div>
            )}

            {/* Badges */}
            {next.badgesRequired > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Badges earned</span>
                  <span>{status.currentBadgeCount} / {next.badgesRequired}</span>
                </div>
                <ProgressBar current={status.currentBadgeCount} total={next.badgesRequired} />
              </div>
            )}

            {/* Guardian */}
            {next.guardianRequired && (
              <div className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2">
                <span className="text-sm">🐉</span>
                <span className="text-xs text-muted">Beat a Zone Guardian</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!next && status.currentBand !== 'none' && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 text-center">
          <p className="text-2xl mb-2">🏆</p>
          <p className="font-heading font-bold text-ink">All milestones reached!</p>
          <p className="mt-1 text-sm text-muted">You&apos;ve earned the highest milestone. Amazing work.</p>
        </div>
      )}
    </section>
  )
}
