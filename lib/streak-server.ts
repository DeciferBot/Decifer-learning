// Applying a completed round to a child's streak.
//
// One helper, used by both places a round can be finished: /api/quiz/submit and
// /api/daily-challenge/submit. They used to disagree — the quiz advanced the
// streak and the daily challenge did not touch it at all — which meant a child
// could do the Daily Mystery Challenge every day and watch their streak reset.
//
// The decision itself is pure and lives in lib/streak.ts. This only does the
// reads and writes.

import type { Prisma } from '@prisma/client'
import { resolveStreak, earnsFreeze, MAX_STREAK_FREEZES } from '@/lib/streak'

/** Works with either the Prisma client or a transaction handle. */
type Db = Prisma.TransactionClient | {
  streakShield: Prisma.TransactionClient['streakShield']
  profile: Prisma.TransactionClient['profile']
  $executeRaw: Prisma.TransactionClient['$executeRaw']
}

export type RoundStreakResult = {
  streakDays: number
  /** The streak advanced (i.e. this was the first round of the day). */
  changed: boolean
  /** A freeze was spent to survive a missed day. */
  streakSaved: boolean
  /** A freeze was earned by this round. */
  freezeEarned: boolean
}

/**
 * Record that this child has completed a round, and settle the streak.
 *
 * Idempotent per calendar day: the second round of the day resolves to
 * `changed: false` and writes nothing, so a child cannot farm freezes by
 * replaying topics.
 *
 * Writes `streak_days` and `last_round_on`. Does NOT touch `last_active`, which
 * means "opened the app" and belongs to the admin metrics.
 */
export async function applyRoundToStreak(
  db: Db,
  profile: { id: string; streak_days: number; last_round_on: Date | null },
  now: Date = new Date(),
): Promise<RoundStreakResult> {
  const held = (
    await db.streakShield.findUnique({
      where: { profile_id: profile.id },
      select: { quantity: true },
    })
  )?.quantity ?? 0

  const outcome = resolveStreak({
    lastRoundOn: profile.last_round_on,
    streakDays: profile.streak_days,
    freezesAvailable: held,
    now,
  })

  if (!outcome.changed) {
    return { streakDays: outcome.streakDays, changed: false, streakSaved: false, freezeEarned: false }
  }

  await db.profile.update({
    where: { id: profile.id },
    data: { streak_days: outcome.streakDays, last_round_on: now },
  })

  // Spend first: this round may be the one that survived a missed day. Clamped
  // at 0 because the balance was read before any transaction opened, so two
  // rounds landing together must not be able to drive it negative.
  if (outcome.freezesUsed > 0) {
    await db.$executeRaw`
      UPDATE streak_shields
      SET quantity = GREATEST(quantity - ${outcome.freezesUsed}::int, 0)
      WHERE profile_id = ${profile.id}::uuid
    `
  }

  // Then earn, on every third day of the streak, capped at what they may hold.
  const heldAfterSpend = held - outcome.freezesUsed
  let freezeEarned = false
  if (earnsFreeze(outcome.streakDays, heldAfterSpend)) {
    await db.$executeRaw`
      INSERT INTO streak_shields (profile_id, quantity)
      VALUES (${profile.id}::uuid, 1)
      ON CONFLICT (profile_id)
      DO UPDATE SET quantity = LEAST(streak_shields.quantity + 1, ${MAX_STREAK_FREEZES}::int)
    `
    freezeEarned = true
  }

  return {
    streakDays: outcome.streakDays,
    changed: true,
    streakSaved: outcome.streakSaved,
    freezeEarned,
  }
}
