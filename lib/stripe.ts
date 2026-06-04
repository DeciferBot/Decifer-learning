import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
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

// Check if a topic is accessible given a user's plan and the topic's order
// index within its subject. Free users get the first FREE_TOPICS_PER_SUBJECT
// topics of Maths; everything else requires Family plan.
export function isTopicAccessible(opts: {
  tier: string
  subjectSlug: string | null
  topicOrderIndex: number
}): boolean {
  if (isPaidPlan(opts.tier)) return true
  if (opts.subjectSlug !== 'maths') return false
  return opts.topicOrderIndex < FREE_TOPICS_PER_SUBJECT
}
