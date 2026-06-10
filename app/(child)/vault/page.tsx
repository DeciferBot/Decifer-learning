export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { getVaultStatus } from '@/lib/vault/status'
import { RequestSection } from './RequestSection'
import { BookOpen, Trophy, Gift, Lightbulb, Dragon, Lock, Medal, Star, Gem } from '@/components/ui/icons'

export const metadata = { title: 'Reward Vault — Decifer Learning' }

const BAND_CONFIG = {
  none:     { label: 'No milestone yet', Icon: Lock,   colour: 'bg-black/5 text-muted' },
  bronze:   { label: 'Bronze Explorer',  Icon: Medal,  colour: 'bg-amber-50 text-amber-700' },
  silver:   { label: 'Silver Achiever',  Icon: Trophy, colour: 'bg-slate-100 text-slate-600' },
  gold:     { label: 'Gold Champion',    Icon: Star,   colour: 'bg-yellow-50 text-yellow-700' },
  platinum: { label: 'Platinum Master',  Icon: Gem,    colour: 'bg-purple-50 text-purple-700' },
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
  const user = await getAuthUser()
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
    ['pending', 'deferred', 'counter_offered', 'approved'].includes(status.pendingRequest.status)
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
          Keep learning to reach milestones — then ask your parent for a reward.
        </p>
      </div>

      {/* ── How it works (shown until first milestone is reached) ────────── */}
      {status.currentBand === 'none' && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">How it works</p>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <BookOpen className="flex-none w-5 h-5 text-muted mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Learn and complete topics</p>
                <p className="text-xs text-muted">Every quiz you pass earns you XP and gets you closer to a milestone.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Trophy className="flex-none w-5 h-5 text-muted mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Reach a milestone</p>
                <p className="text-xs text-muted">Hit Bronze, Silver, Gold, or Platinum to unlock a reward.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Gift className="flex-none w-5 h-5 text-muted mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Ask your parent</p>
                <p className="text-xs text-muted">Send a request and your parent will decide on the reward — together.</p>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* ── Current status card ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${bandCfg.colour}`}>
            <bandCfg.Icon className="w-4 h-4" aria-hidden />
            <span>{bandCfg.label}</span>
          </div>
          {status.creditBalance > 0 && !hasPendingRequest && (
            <div className="inline-flex items-center gap-1 rounded-full bg-correct/15 px-3 py-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-correct"><Gift className="w-3.5 h-3.5" aria-hidden /> Reward earned</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
          <div>
            <div className="font-heading text-base font-bold text-ink">{status.effectiveXP.toLocaleString()}</div>
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

        {/* Hint penalty callout — only shown when there is a meaningful penalty */}
        {status.hintPenaltyXP > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-incorrect/10 px-3 py-2">
            <Lightbulb className="flex-none w-4 h-4 text-incorrect" aria-hidden />
            <p className="text-xs text-incorrect leading-snug">
              <span className="font-semibold">−{status.hintPenaltyXP} XP hint penalty.</span>{' '}
              You used {status.totalHintsUsed} hint{status.totalHintsUsed !== 1 ? 's' : ''} across your quizzes.
              Try answering without hints to reach rewards faster!
            </p>
          </div>
        )}
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
            {/* XP — uses effective (hint-penalised) XP so the bar matches milestone gates */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted">
                <span>XP</span>
                <span>{status.effectiveXP.toLocaleString()} / {next.xpRequired.toLocaleString()}</span>
              </div>
              <ProgressBar current={status.effectiveXP} total={next.xpRequired} />
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
                <Dragon className="w-4 h-4 text-muted" aria-hidden />
                <span className="text-xs text-muted">Beat a Zone Guardian</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Only shown when the child has genuinely reached the top band (Platinum).
          If next=null at a lower band it means the year group has fewer published topics
          than the next milestone requires — that is a content-availability gap, not
          completion. Showing "All milestones reached" in that case is misleading. */}
      {status.currentBand === 'platinum' && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 text-center">
          <Trophy className="w-8 h-8 text-points-gold mx-auto mb-2" aria-hidden />
          <p className="font-heading font-bold text-ink">All milestones reached!</p>
          <p className="mt-1 text-sm text-muted">You&apos;ve earned the highest milestone. Amazing work.</p>
        </div>
      )}
    </section>
  )
}
