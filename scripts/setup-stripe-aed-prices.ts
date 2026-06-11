/**
 * Creates the two AED subscription prices in Stripe (sandbox or live,
 * depending on STRIPE_SECRET_KEY). Idempotent — uses lookup_keys, so
 * re-running finds existing prices instead of duplicating them.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/setup-stripe-aed-prices.ts
 * Then copy the printed env lines into .env.local (and Vercel for prod).
 */
import Stripe from 'stripe'

const PRICES = [
  {
    lookupKey: 'family_aed_500_monthly',
    productName: 'Decifer Learning — Family Plan',
    unitAmount: 50000, // AED 500.00 in fils
    envVar: 'STRIPE_FAMILY_PRICE_ID',
  },
  {
    lookupKey: 'per_child_aed_350_monthly',
    productName: 'Decifer Learning — Per Child Plan',
    unitAmount: 35000, // AED 350.00 in fils
    envVar: 'STRIPE_PER_CHILD_PRICE_ID',
  },
]

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('placeholder')) {
    console.error('STRIPE_SECRET_KEY is missing or a placeholder. Add the real key to .env.local first.')
    process.exit(1)
  }
  if (!key.startsWith('sk_test_')) {
    console.warn('⚠ Key is NOT a test key — this will create prices in LIVE mode.')
  }

  const stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
  const envLines: string[] = []

  for (const p of PRICES) {
    const existing = await stripe.prices.list({ lookup_keys: [p.lookupKey], limit: 1 })
    let price = existing.data[0]
    if (price) {
      console.log(`✓ ${p.lookupKey} already exists: ${price.id}`)
    } else {
      const product = await stripe.products.create({ name: p.productName })
      price = await stripe.prices.create({
        product: product.id,
        currency: 'aed',
        unit_amount: p.unitAmount,
        recurring: { interval: 'month' },
        lookup_key: p.lookupKey,
      })
      console.log(`✓ created ${p.productName}: ${price.id} (AED ${p.unitAmount / 100}/month)`)
    }
    envLines.push(`${p.envVar}=${price.id}`)
  }

  console.log('\nAdd to .env.local (and Vercel env for prod):\n')
  for (const line of envLines) console.log(line)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
