import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
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

  const priceId = process.env.STRIPE_FAMILY_PRICE_ID
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
