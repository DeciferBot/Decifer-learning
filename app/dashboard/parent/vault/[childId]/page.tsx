import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getVaultStatus } from '@/lib/vault/status'
import { getOrCreateParentSettings } from '@/lib/vault/settings'
import { RespondButtons } from './RespondButtons'

export const metadata = { title: 'Reward Vault — Decifer Learning' }

const BAND_CONFIG: Record<string, { label: string; emoji: string }> = {
  none:     { label: 'No milestone yet', emoji: '🔒' },
  bronze:   { label: 'Bronze Explorer',  emoji: '🥉' },
  silver:   { label: 'Silver Achiever',  emoji: '🥈' },
  gold:     { label: 'Gold Champion',    emoji: '🥇' },
  platinum: { label: 'Platinum Master',  emoji: '💎' },
}

type Params = { params: { childId: string } }

export default async function ParentVaultPage({ params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  if (getUserRole(user) !== 'parent') notFound()

  const parentProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!parentProfile) notFound()

  // Verify parent-child link
  const link = await prisma.familyLink.findFirst({
    where: { parent_user_id: user.id, child: { id: params.childId } },
    include: { child: { select: { id: true, display_name: true } } },
  })
  if (!link) notFound()

  const childName = link.child.display_name

  const [vaultStatus, parentSettings, requestHistory] = await Promise.all([
    getVaultStatus(params.childId).catch(() => null),
    getOrCreateParentSettings(parentProfile.id, params.childId),
    prisma.rewardRequest.findMany({
      where: { child_profile_id: params.childId },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        milestone_band: true,
        child_message: true,
        parent_response_note: true,
        reward_label: true,
        credits_used: true,
        created_at: true,
        responded_at: true,
      },
    }),
  ])

  const activeRequest = requestHistory.find(
    (r) => ['pending', 'deferred', 'counter_offered'].includes(r.status),
  ) ?? null

  const bandCfg = vaultStatus
    ? (BAND_CONFIG[vaultStatus.currentBand] ?? BAND_CONFIG.none)
    : BAND_CONFIG.none

  const familyOptions = (parentSettings.family_reward_options ?? []) as Array<{ label: string }>

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/parent"
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          ← Back
        </Link>
        <h1 className="font-heading text-xl font-bold text-ink">{childName}&apos;s Reward Vault</h1>
      </div>

      {/* ── Vault summary ────────────────────────────────────────────────── */}
      {vaultStatus && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{bandCfg.emoji}</span>
              <span className="font-heading text-sm font-semibold text-ink">{bandCfg.label}</span>
            </div>
            <div className="text-right">
              <span className="font-heading text-xl font-bold text-brand">
                {vaultStatus.creditBalance}
              </span>
              <span className="ml-1 text-xs text-muted">
                {vaultStatus.creditBalance === 1 ? 'credit' : 'credits'}
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted">
            <div>
              <div className="font-heading text-base font-bold text-ink">{vaultStatus.currentXP.toLocaleString()}</div>
              <div>XP</div>
            </div>
            <div>
              <div className="font-heading text-base font-bold text-ink">{vaultStatus.currentTopicsCompleted}</div>
              <div>topics</div>
            </div>
            <div>
              <div className="font-heading text-base font-bold text-ink">{vaultStatus.currentBadgeCount}</div>
              <div>badges</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active request ───────────────────────────────────────────────── */}
      {activeRequest ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-heading text-base font-bold text-ink">Reward Request</h2>
            <span className="rounded-full bg-points-gold/20 px-2 py-0.5 text-xs font-bold text-points-gold capitalize">
              {activeRequest.status.replace('_', ' ')}
            </span>
          </div>
          <div className="space-y-1 text-sm text-muted">
            <p>Milestone: <span className="font-semibold text-ink capitalize">{activeRequest.milestone_band}</span></p>
            {activeRequest.child_message && (
              <p className="mt-2 text-sm italic text-ink">&ldquo;{activeRequest.child_message}&rdquo;</p>
            )}
          </div>
          <RespondButtons requestId={activeRequest.id} childName={childName} />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 text-center text-sm text-muted">
          No pending reward request from {childName}.
        </div>
      )}

      {/* ── Family reward options ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-ink">Family reward ideas</h2>
          <Link
            href={`/api/vault/parent/settings/${params.childId}`}
            className="text-xs text-muted hover:text-ink"
          >
            Edit via API
          </Link>
        </div>
        {familyOptions.length > 0 ? (
          <ul className="space-y-1.5">
            {familyOptions.map((opt) => (
              <li key={opt.label} className="flex items-center gap-2 text-sm text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-brand flex-none" aria-hidden />
                {opt.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No reward ideas set yet.</p>
        )}
      </div>

      {/* ── Request history ───────────────────────────────────────────────── */}
      {requestHistory.filter(r => !['pending', 'deferred', 'counter_offered'].includes(r.status)).length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
          <h2 className="font-heading text-sm font-semibold text-ink">History</h2>
          <ul className="space-y-2">
            {requestHistory
              .filter(r => !['pending', 'deferred', 'counter_offered'].includes(r.status))
              .map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <span className="font-semibold text-ink capitalize">{r.status.replace('_', ' ')}</span>
                    {r.reward_label && <span className="ml-1 text-muted">· {r.reward_label}</span>}
                    {r.child_message && (
                      <p className="text-xs text-muted italic mt-0.5">&ldquo;{r.child_message}&rdquo;</p>
                    )}
                  </div>
                  <span className="flex-none text-xs text-muted">
                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  )
}
