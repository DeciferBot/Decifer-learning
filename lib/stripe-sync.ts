// Server-only Stripe billing sync helpers.
//
// The Per Child plan (STRIPE_PER_CHILD_PRICE_ID) bills quantity = number of
// linked children. Checkout sets the initial quantity, but links change over
// time — every route that creates or removes a family_links row must call
// syncPerChildQuantity(parentUserId) afterwards so billing follows reality.
//
// Both helpers swallow errors after logging: billing sync must never break
// the user-facing flow that triggered it (linking a child, deleting a user).

import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

const SYNCABLE_STATUSES = new Set(['active', 'trialing', 'past_due'])

// Align the Stripe subscription quantity with the parent's current child
// count (minimum 1, matching checkout). No-op for the flat Family plan,
// missing/canceled subscriptions, or when the quantity already matches.
export async function syncPerChildQuantity(parentUserId: string): Promise<void> {
  try {
    const perChildPriceId = process.env.STRIPE_PER_CHILD_PRICE_ID
    if (!perChildPriceId) return

    const sub = await prisma.subscription.findUnique({
      where: { user_id: parentUserId },
      select: { stripe_subscription_id: true, status: true },
    })
    if (!sub?.stripe_subscription_id || !SYNCABLE_STATUSES.has(sub.status)) return

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    if (stripeSub.status === 'canceled') return

    const item = stripeSub.items.data[0]
    if (!item || item.price.id !== perChildPriceId) return

    const childCount = await prisma.familyLink.count({
      where: { parent_user_id: parentUserId },
    })
    const quantity = Math.max(1, childCount)
    if (item.quantity === quantity) return

    await stripe.subscriptionItems.update(item.id, {
      quantity,
      proration_behavior: 'create_prorations',
    })
    console.log(
      `[stripe-sync] per-child quantity ${item.quantity} → ${quantity} for user ${parentUserId}`
    )
  } catch (err) {
    console.error('[stripe-sync] per-child quantity sync failed:', err)
  }
}

// GDPR/account deletion: cancel any live Stripe subscription and remove the
// local subscriptions row so a deleted parent is never charged again.
export async function cancelStripeSubscriptionForUser(userId: string): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { user_id: userId },
      select: { stripe_subscription_id: true },
    })
    if (sub?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      } catch (err) {
        // Already-canceled subscriptions throw resource_missing-style errors —
        // safe to continue; anything else is logged for manual follow-up.
        console.error(
          `[stripe-sync] cancel failed for ${sub.stripe_subscription_id} (user ${userId}):`,
          err
        )
      }
    }
    await prisma.subscription.deleteMany({ where: { user_id: userId } })
  } catch (err) {
    console.error('[stripe-sync] subscription cleanup failed for user', userId, err)
  }
}
