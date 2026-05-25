import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getVaultStatus } from '@/lib/vault/status'
import { getOrCreateParentSettings } from '@/lib/vault/settings'
import { RespondButtons } from './RespondButtons'
import { FulfillButton } from './FulfillButton'
import { RewardSettingsForm } from './RewardSettingsForm'
import { PhysicalRewardsToggle } from './PhysicalRewardsToggle'
import { DeliveryAddressForm } from './DeliveryAddressForm'
import type { DeliveryAddress } from '@/lib/vault/settings'

export const metadata = { title: 'Reward Vault — Decifer Learning' }

const BAND_CONFIG: Record<string, { label: string; emoji: string }> = {
  none:     { label: 'No milestone yet', emoji: '🔒' },
  bronze:   { label: 'Bronze Explorer',  emoji: '🥉' },
  silver:   { label: 'Silver Achiever',  emoji: '🥈' },
  gold:     { label: 'Gold Champion',    emoji: '🥇' },
  platinum: { label: 'Platinum Master',  emoji: '💎' },
}

const ACTIVE_STATUS_LABELS: Record<string, { label: string; colour: string; bg: string }> = {
  pending:         { label: 'Waiting for parent', colour: 'text-points-gold', bg: 'bg-points-gold/20' },
  deferred:        { label: 'Deferred',           colour: 'text-muted',       bg: 'bg-black/5'        },
  counter_offered: { label: 'Waiting for child',  colour: 'text-maths',       bg: 'bg-maths/15'       },
}

const HISTORY_STATUS: Record<string, { label: string; colour: string }> = {
  approved:   { label: 'Approved, ready to give', colour: 'text-correct font-semibold' },
  rejected:   { label: 'Declined',                colour: 'text-muted' },
  cancelled:  { label: 'Closed',                  colour: 'text-muted' },
  withdrawn:  { label: 'Closed',                  colour: 'text-muted' },
  dismissed:  { label: 'Closed',                  colour: 'text-muted' },
  completed:  { label: 'Done',                    colour: 'text-science font-semibold' },
}

const FULFILMENT_LABEL: Record<string, string> = {
  approved:   '📦 Awaiting dispatch',
  dispatched: '🚚 On its way',
  delivered:  '✓ Delivered',
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
        reward_type: true,
        credits_used: true,
        created_at: true,
        responded_at: true,
        fulfilment: { select: { status: true } },
      },
    }),
  ])

  const physicalEnabled = parentSettings.physical_rewards_enabled
  const deliveryAddress = (parentSettings.delivery_address as DeliveryAddress | null) ?? null

  // Load catalogue items (name + category only — price not surfaced in parent UI) when physical is enabled
  const catalogueItems = physicalEnabled
    ? await prisma.rewardCatalog.findMany({
        where: { is_active: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, category: true },
      })
    : []

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

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">How rewards work</p>
        <ol className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-muted">
            <span className="flex-none font-bold text-ink">1.</span>
            <span><span className="text-ink">{childName}</span> earns milestones by completing topics and quizzes.</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted">
            <span className="flex-none font-bold text-ink">2.</span>
            <span>When a milestone is reached, they can send you a reward request.</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted">
            <span className="flex-none font-bold text-ink">3.</span>
            <span>You decide — approve, suggest something different, save for later, or decline.</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted">
            <span className="flex-none font-bold text-ink">4.</span>
            <span>Once you&apos;ve given the reward, come back and tap <strong className="text-ink">Mark as done</strong>.</span>
          </li>
        </ol>
      </div>

      {/* ── Vault summary ────────────────────────────────────────────────── */}
      {vaultStatus && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{bandCfg.emoji}</span>
              <span className="font-heading text-sm font-semibold text-ink">{bandCfg.label}</span>
            </div>
            {vaultStatus.creditBalance > 0 ? (
              <span className="rounded-full bg-correct/15 px-3 py-1 text-xs font-bold text-correct">
                🎁 {vaultStatus.creditBalance === 1 ? 'Reward available' : `${vaultStatus.creditBalance} rewards available`}
              </span>
            ) : (
              <span className="text-xs text-muted">No reward ready yet</span>
            )}
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
            {(() => {
              const s = ACTIVE_STATUS_LABELS[activeRequest.status]
              return s ? (
                <span className={`rounded-full ${s.bg} px-2 py-0.5 text-xs font-bold ${s.colour}`}>
                  {s.label}
                </span>
              ) : null
            })()}
          </div>
          <div className="space-y-1 text-sm text-muted">
            <p>Milestone: <span className="font-semibold text-ink capitalize">{activeRequest.milestone_band}</span></p>
            {activeRequest.child_message && (
              <p className="mt-2 text-sm italic text-ink">&ldquo;{activeRequest.child_message}&rdquo;</p>
            )}
          </div>
          <RespondButtons
            requestId={activeRequest.id}
            childName={childName}
            status={activeRequest.status}
            physicalRewardsEnabled={physicalEnabled}
            catalogueItems={catalogueItems}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 text-center space-y-1">
          <p className="text-sm text-muted">
            {childName} hasn&apos;t sent a reward request yet.
          </p>
          <p className="text-xs text-muted">
            When they do, it will appear here for you to respond to.
          </p>
        </div>
      )}

      {/* ── Reward settings ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-4">
        {/* Family reward ideas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold text-ink">Family reward ideas</h2>
            <RewardSettingsForm childId={params.childId} initialOptions={familyOptions} />
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
            <p className="text-sm text-muted">No reward ideas set yet — add some using &ldquo;Edit ideas&rdquo; above.</p>
          )}
        </div>

        {/* Physical prizes — delivery address + toggle */}
        <div className="border-t border-black/5 pt-4 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Physical prizes</p>
            <DeliveryAddressForm childId={params.childId} initialAddress={deliveryAddress} />
          </div>
          <PhysicalRewardsToggle childId={params.childId} initialEnabled={physicalEnabled} />
        </div>
      </div>

      {/* ── Request history ───────────────────────────────────────────────── */}
      {requestHistory.filter(r => !['pending', 'deferred', 'counter_offered'].includes(r.status)).length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
          <h2 className="font-heading text-sm font-semibold text-ink">History</h2>
          <ul className="space-y-3">
            {requestHistory
              .filter(r => !['pending', 'deferred', 'counter_offered'].includes(r.status))
              .map((r) => (
                <li key={r.id} className="text-sm space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={HISTORY_STATUS[r.status]?.colour ?? 'text-muted'}>
                        {HISTORY_STATUS[r.status]?.label ?? 'Closed'}
                      </span>
                      {r.reward_label && (
                        <span className="ml-1 text-muted">· {r.reward_label}</span>
                      )}
                      {r.child_message && (
                        <p className="text-xs text-muted italic mt-0.5">&ldquo;{r.child_message}&rdquo;</p>
                      )}
                      {r.parent_response_note && r.status !== 'approved' && (
                        <p className="text-xs text-muted mt-0.5">Your note: {r.parent_response_note}</p>
                      )}
                    </div>
                    <span className="flex-none text-xs text-muted">
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  {r.status === 'approved' && r.reward_type !== 'physical' && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted">
                        Once you&apos;ve given this reward, tap the button below.
                      </p>
                      <FulfillButton requestId={r.id} />
                    </div>
                  )}
                  {r.status === 'approved' && r.reward_type === 'physical' && (
                    <div className="space-y-1.5">
                      {r.fulfilment?.status ? (
                        <p className="text-xs font-semibold text-brand">
                          {FULFILMENT_LABEL[r.fulfilment.status] ?? `📦 ${r.fulfilment.status}`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted">Physical prize — awaiting dispatch from your family catalogue.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  )
}
