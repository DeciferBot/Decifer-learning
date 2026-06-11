import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})

// Free tier: 3 topics per subject are unlocked for all users.
// Any additional topic requires a Family plan subscription.
export const FREE_TOPICS_PER_SUBJECT = 3

// All prices are in AED (fils for Stripe unit amounts). UAE market.
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    topicsPerSubject: FREE_TOPICS_PER_SUBJECT,
    subjects: ['Maths'],
    parentDashboard: false,
    quizAttemptsPerDay: 3,
  },
  per_child: {
    name: 'Per Child',
    priceFils: 35000,
    priceDisplay: 'AED 350',
    priceSuffix: '/child/month',
    interval: 'month',
    topicsPerSubject: Infinity,
    subjects: ['Maths', 'English', 'Science'],
    parentDashboard: true,
    quizAttemptsPerDay: Infinity,
  },
  family: {
    name: 'Family',
    priceFils: 50000,
    priceDisplay: 'AED 500',
    priceSuffix: '/month',
    interval: 'month',
    topicsPerSubject: Infinity,
    subjects: ['Maths', 'English', 'Science'],
    parentDashboard: true,
    quizAttemptsPerDay: Infinity,
  },
} as const

export type Plan = keyof typeof PLANS

// Paid checkout options — maps plan key to its Stripe price env var.
export const PAID_PLAN_PRICE_ENV = {
  family: 'STRIPE_FAMILY_PRICE_ID',
  per_child: 'STRIPE_PER_CHILD_PRICE_ID',
} as const

export type PaidPlan = keyof typeof PAID_PLAN_PRICE_ENV

// Both paid plans grant identical access; profiles.subscription_tier
// stays 'family' for any active paid subscription.
export function isPaidPlan(tier: string | null | undefined): boolean {
  return tier === 'family'
}

// Content gating is currently disabled — all topics are open to all users.
// Re-enable by replacing the body with the commented logic below.
export function isTopicAccessible(_opts: {
  tier: string
  subjectSlug: string | null
  topicOrderIndex: number
}): boolean {
  return true
  // if (isPaidPlan(_opts.tier)) return true
  // if (_opts.subjectSlug !== 'maths') return false
  // return _opts.topicOrderIndex < FREE_TOPICS_PER_SUBJECT
}
