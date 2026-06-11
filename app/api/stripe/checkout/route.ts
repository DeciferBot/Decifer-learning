import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { stripe, PAID_PLAN_PRICE_ENV, type PaidPlan } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let plan: PaidPlan = 'family'
  try {
    const body = await req.json()
    if (body?.plan === 'per_child') plan = 'per_child'
  } catch {
    // no body — default to family plan
  }

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true, subscription_tier: true },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.subscription_tier === 'family') {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
  }

  // Find or create Stripe customer
  let stripeCustomerId: string | undefined
  const existing = await prisma.subscription.findUnique({
    where: { user_id: user.id },
    select: { stripe_customer_id: true },
  })
  if (existing?.stripe_customer_id) {
    stripeCustomerId = existing.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id, profile_id: profile.id },
    })
    stripeCustomerId = customer.id
    await prisma.subscription.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, stripe_customer_id: stripeCustomerId, plan: 'free' },
      update: { stripe_customer_id: stripeCustomerId },
    })
  }

  const priceId = process.env[PAID_PLAN_PRICE_ENV[plan]]
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
  }

  // Per Child plan bills per linked child account (minimum 1).
  let quantity = 1
  if (plan === 'per_child') {
    const childCount = await prisma.familyLink.count({
      where: { parent_user_id: user.id },
    })
    quantity = Math.max(1, childCount)
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity }],
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: user.id, plan },
  })

  return NextResponse.json({ url: session.url })
}
