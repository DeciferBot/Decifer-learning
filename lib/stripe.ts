import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia',
  typescript: true,
})

// Free tier: 3 topics per subject are unlocked for all users.
// Any additional topic requires a Family plan subscription.
export const FREE_TOPICS_PER_SUBJECT = 3

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    topicsPerSubject: FREE_TOPICS_PER_SUBJECT,
    subjects: ['Maths'],
    parentDashboard: false,
    quizAttemptsPerDay: 3,
  },
  family: {
    name: 'Family',
    pricePence: 799,
    priceDisplay: '£7.99',
    interval: 'month',
    topicsPerSubject: Infinity,
    subjects: ['Maths', 'English', 'Science'],
    parentDashboard: true,
    quizAttemptsPerDay: Infinity,
  },
} as const

export type Plan = keyof typeof PLANS

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
