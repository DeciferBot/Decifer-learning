/**
 * Reward Vault — live-cycle structural proof script.
 *
 * Verifies that all steps of a complete family reward cycle are correctly
 * wired in the codebase. Checks are static (file reads only — no network,
 * no database). Each check maps to a specific behaviour required for the
 * pilot family test.
 *
 * Run: node scripts/verify-reward-cycle.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const pass = []
const fail = []

function check(id, description, assertion) {
  try {
    if (assertion()) {
      pass.push({ id, description })
    } else {
      fail.push({ id, description, reason: 'Assertion returned false' })
    }
  } catch (err) {
    fail.push({ id, description, reason: err.message })
  }
}

function read(relPath) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) throw new Error(`File not found: ${relPath}`)
  return readFileSync(abs, 'utf-8')
}

function exists(relPath) {
  return existsSync(join(ROOT, relPath))
}

// ── Step 1: Child can become eligible ─────────────────────────────────────────
// milestone-engine.ts computes eligibility from learning signals.

check('C01', 'milestone-engine.ts has computeMilestone and returns highestQualifyingBand', () => {
  const src = read('lib/vault/milestone-engine.ts')
  return (
    src.includes('computeMilestone') &&
    src.includes('highestQualifyingBand') &&
    src.includes('topicsCompleted') &&
    src.includes('totalPoints')
  )
})

check('C02', 'checkAndUpdateMilestone in status.ts awards credits and writes to child_vault_status', () => {
  const src = read('lib/vault/status.ts')
  return (
    src.includes('checkAndUpdateMilestone') &&
    src.includes('credit_balance') &&
    src.includes('credits_earned_total') &&
    src.includes('vaultMilestoneEvent')
  )
})

check('C03', 'check-milestone API route exists and is authenticated', () => {
  const src = read('app/api/vault/check-milestone/route.ts')
  return src.includes('checkAndUpdateMilestone') && src.includes('Unauthorized')
})

// ── Step 2: Child can submit a reward request ──────────────────────────────────

check('C04', 'createRewardRequest exists with INSUFFICIENT_CREDITS guard', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes('createRewardRequest') &&
    src.includes('INSUFFICIENT_CREDITS') &&
    src.includes('credit_balance')
  )
})

check('C05', 'Request API route POST /api/vault/request calls createRewardRequest', () => {
  const src = read('app/api/vault/request/route.ts')
  return src.includes('createRewardRequest') && src.includes('Unauthorized')
})

check('C06', 'Child message is length-validated (max 120 chars) before storing', () => {
  const src = read('lib/vault/requests.ts')
  return src.includes('120') && src.includes('MESSAGE_TOO_LONG')
})

// ── Step 3: Duplicate pending request is blocked ──────────────────────────────

check('C07', 'createRewardRequest checks for existing active request and throws DUPLICATE_PENDING', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes('DUPLICATE_PENDING') &&
    src.includes("'pending', 'deferred', 'counter_offered'")
  )
})

// ── Step 4: Parent can approve, reject, defer, and counter-offer ──────────────

check('C08', 'respondToRequest handles approve action and sets status approved', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes("action === 'approve'") &&
    src.includes("status: 'approved'")
  )
})

check('C09', 'respondToRequest handles reject action and sets status rejected', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes("action === 'reject'") &&
    src.includes("status: 'rejected'")
  )
})

check('C10', 'respondToRequest handles defer action and sets status deferred', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes("action === 'defer'") &&
    src.includes("status: 'deferred'")
  )
})

check('C11', 'respondToRequest handles counter_offer action and sets status counter_offered', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes("action === 'counter_offer'") &&
    src.includes("status: 'counter_offered'")
  )
})

check('C12', 'Parent-only actions (approve/reject/defer/counter_offer) are gated by isParent check', () => {
  const src = read('lib/vault/requests.ts')
  return (
    src.includes('isParent') &&
    src.includes("'approve', 'reject', 'defer', 'counter_offer'") &&
    src.includes('INVALID_TRANSITION')
  )
})

// ── Step 5: Counter-offer note is stored and visible ─────────────────────────

check('C13', 'counter_offer action stores note in parent_response_note field', () => {
  const src = read('lib/vault/requests.ts')
  // Find the counter_offer block and check it sets parent_response_note
  const idx = src.indexOf("action === 'counter_offer'")
  const block = src.slice(idx, idx + 400)
  return block.includes('parent_response_note')
})

check('C14', 'Child vault status query returns parent_response_note in pendingRequest', () => {
  const src = read('lib/vault/status.ts')
  return src.includes('parentResponseNote') && src.includes('parent_response_note')
})

check('C15', 'Child RequestSection renders parentResponseNote when status is counter_offered', () => {
  const src = read('app/(child)/vault/RequestSection.tsx')
  return (
    src.includes('counter_offered') &&
    src.includes('parentResponseNote') &&
    src.includes("Parent") // renders parent suggestion label
  )
})

// ── Step 6: Rejected / counter-offer-dismissed credits are refunded ───────────

check('C16', 'reject action increments credit_balance back to child vault status', () => {
  const src = read('lib/vault/requests.ts')
  const idx = src.indexOf("action === 'reject'")
  const block = src.slice(idx, idx + 800)
  return block.includes('credit_balance') && block.includes('increment')
})

check('C17', 'dismiss_counter action increments credit_balance back to child vault status', () => {
  const src = read('lib/vault/requests.ts')
  const idx = src.indexOf("action === 'dismiss_counter'")
  const block = src.slice(idx, idx + 500)
  return block.includes('credit_balance') && block.includes('increment')
})

check('C18', 'Credit refunds use Prisma $transaction (atomic — no partial state)', () => {
  const src = read('lib/vault/requests.ts')
  // Both reject and dismiss_counter must be inside $transaction
  const rejectIdx = src.indexOf("action === 'reject'")
  const rejectBlock = src.slice(rejectIdx, rejectIdx + 500)
  const dismissIdx = src.indexOf("action === 'dismiss_counter'")
  const dismissBlock = src.slice(dismissIdx, dismissIdx + 500)
  return rejectBlock.includes('$transaction') && dismissBlock.includes('$transaction')
})

// ── Step 7: Fulfilled status can be recorded ──────────────────────────────────

check('C19', 'markFulfilled function exists and only updates status to completed', () => {
  const src = read('lib/vault/requests.ts')
  const idx = src.indexOf('async function markFulfilled')
  const block = src.slice(idx, idx + 900)
  return (
    idx !== -1 &&
    block.includes("status: 'completed'") &&
    !block.includes('total_points') &&
    !block.includes('point_events') &&
    !block.includes('topic_progress')
  )
})

check('C20', 'Fulfill API route exists and is parent-only', () => {
  return (
    exists('app/api/vault/parent/fulfill/route.ts') &&
    (() => {
      const src = read('app/api/vault/parent/fulfill/route.ts')
      return (
        src.includes('markFulfilled') &&
        src.includes("getUserRole(user) !== 'parent'") &&
        src.includes('Unauthorized')
      )
    })()
  )
})

check('C21', 'FulfillButton component exists on parent vault page', () => {
  return (
    exists('app/dashboard/parent/vault/[childId]/FulfillButton.tsx') &&
    (() => {
      const src = read('app/dashboard/parent/vault/[childId]/FulfillButton.tsx')
      return src.includes('/api/vault/parent/fulfill') && src.includes('router.refresh')
    })()
  )
})

check('C22', 'Parent vault page renders FulfillButton for approved requests', () => {
  const src = read('app/dashboard/parent/vault/[childId]/page.tsx')
  return (
    src.includes('FulfillButton') &&
    src.includes("r.status === 'approved'")
  )
})

// ── Step 8: Note validation ───────────────────────────────────────────────────

check('C23', 'Respond route validates note max 280 chars before processing', () => {
  const src = read('app/api/vault/parent/respond/route.ts')
  return src.includes('280') && src.includes('NOTE_TOO_LONG')
})

// ── Step 9: Child-facing UI contains no forbidden language ────────────────────

check('C24', 'Child vault pages contain no credit/wallet/spend/price/cost/payment/address/delivery language', () => {
  const childVaultPage = read('app/(child)/vault/page.tsx')
  const requestSection = read('app/(child)/vault/RequestSection.tsx')

  const bannedPatterns = [
    /credit balance/i,
    /spend credit/i,
    /\bprice\b/i,
    /\bwallet\b/i,
    /redeem value/i,
    /\bcost\b/i,
    /\bpayment\b/i,
    /\bdelivery\b/i,
    /\baddress\b/i,
    /\d+\s+credit/i,
    /Claim Your/i,
  ]

  for (const src of [childVaultPage, requestSection]) {
    for (const pattern of bannedPatterns) {
      if (pattern.test(src)) return false
    }
  }
  return true
})

// ── Report ────────────────────────────────────────────────────────────────────

const totalChecks = pass.length + fail.length
console.log('\n── Reward Vault — Live Cycle Proof ──\n')
for (const p of pass) {
  console.log(`  ✓ [${p.id}] ${p.description}`)
}
if (fail.length > 0) {
  console.log('')
  for (const f of fail) {
    console.log(`  ✗ [${f.id}] ${f.description}`)
    console.log(`       → ${f.reason}`)
  }
}
console.log(`\n  ${pass.length}/${totalChecks} cycle checks passed\n`)

if (fail.length > 0) {
  process.exit(1)
}
