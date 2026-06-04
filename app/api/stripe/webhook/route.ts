import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Stripe sends the raw body — Next.js must NOT parse it.
export async function POST(req: Request) {
  const body = await req.text()
  const sig = headers().get('stripe-signature')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe-webhook] signature verification failed:', msg)
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          await handleSubscriptionActivated(
            session.metadata?.user_id ?? '',
            session.customer as string,
            session.subscription as string
          )
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionChanged(sub)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await markPastDue(invoice.subscription as string)
        }
        break
      }
      default:
        // Ignore unhandled events
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleSubscriptionActivated(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
) {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const periodEnd = new Date(sub.current_period_end * 1000)

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan: 'family',
        status: 'active',
        current_period_end: periodEnd,
      },
      update: {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan: 'family',
        status: 'active',
        current_period_end: periodEnd,
      },
    }),
    prisma.profile.update({
      where: { user_id: userId },
      data: { subscription_tier: 'family' },
    }),
  ])
}

async function handleSubscriptionChanged(sub: Stripe.Subscription) {
  const existing = await prisma.subscription.findUnique({
    where: { stripe_subscription_id: sub.id },
    select: { user_id: true },
  })
  if (!existing) return

  const isActive = sub.status === 'active' || sub.status === 'trialing'
  const plan = isActive ? 'family' : 'free'
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null

  await prisma.$transaction([
    prisma.subscription.update({
      where: { stripe_subscription_id: sub.id },
      data: {
        status: sub.status,
        plan,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
    }),
    prisma.profile.update({
      where: { user_id: existing.user_id },
      data: { subscription_tier: plan },
    }),
  ])
}

async function markPastDue(stripeSubscriptionId: string) {
  await prisma.subscription.update({
    where: { stripe_subscription_id: stripeSubscriptionId },
    data: { status: 'past_due' },
  })
}
