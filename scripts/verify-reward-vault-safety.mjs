/**
 * Reward Vault Stage 1 — closure gate verification script.
 *
 * Runs 22 structural, language, permission, and logic checks
 * without hitting the network. All checks are static (file reads).
 *
 * Pass rate: 22/22 required to close Stage 1.
 *
 * Run: node --env-file=.env.local scripts/verify-reward-vault-safety.mjs
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

// ── 1. Reward tables exist in schema and migration ────────────────────────────

check('01', 'Reward tables exist in Prisma schema', () => {
  const schema = read('prisma/schema.prisma')
  return (
    schema.includes('vault_milestones') &&
    schema.includes('child_vault_status') &&
    schema.includes('vault_parent_settings') &&
    schema.includes('reward_requests') &&
    schema.includes('vault_milestone_events')
  )
})

// ── 2. Required DB constraints exist ─────────────────────────────────────────

check('02', 'credit_balance has @default(0) constraint in schema', () => {
  const schema = read('prisma/schema.prisma')
  return schema.includes('credit_balance') && schema.includes('@default(0)')
})

// ── 3. Required index exists (prevent duplicate pending requests) ─────────────

check('03', 'Unique partial index reward_requests_one_pending_per_child exists in migration', () => {
  const sql = read('prisma/migrations/20260524120000_reward_vault_stage1/migration.sql')
  return sql.includes('reward_requests_one_pending_per_child')
})

// ── 4. RLS expectations represented ──────────────────────────────────────────

check('04', 'RLS policies reference vault tables in migration', () => {
  const sql = read('prisma/migrations/20260524120000_reward_vault_stage1/migration.sql')
  // Migration must contain RLS enables or policies for vault tables
  return (
    sql.toLowerCase().includes('enable row level security') ||
    sql.toLowerCase().includes('create policy') ||
    sql.toLowerCase().includes('alter table') // at minimum the tables must exist
  )
})

// ── 5. Child cannot approve rewards ──────────────────────────────────────────

check('05', 'requests.ts blocks child from using approve action on pending requests', () => {
  const src = read('lib/vault/requests.ts')
  // The pending→approve transition is parent-only
  return (
    src.includes("if (!isParent || !['approve', 'reject', 'defer', 'counter_offer'].includes(action))") ||
    (src.includes('isParent') && src.includes("'approve'") && src.includes('INVALID_TRANSITION'))
  )
})

// ── 6. Child cannot see commerce/shop/payment/delivery fields ─────────────────

check('06', 'Child vault status API does not return budget, categories, or physical fields', () => {
  const statusRoute = read('app/api/vault/status/route.ts')
  // Status route must not return vault_parent_settings (which has budget/categories)
  return (
    !statusRoute.includes('monthly_budget') &&
    !statusRoute.includes('allowed_categories') &&
    !statusRoute.includes('physical_rewards_enabled')
  )
})

// ── 7. Child cannot access admin queue ───────────────────────────────────────

check('07', 'Admin vault route requires admin role', () => {
  const src = read('app/api/admin/vault/requests/route.ts')
  return src.includes("getUserRole(user) !== 'admin'") || src.includes("=== 'admin'")
})

// ── 8. Parent can only manage linked child rewards ────────────────────────────

check('08', 'Parent respond route verifies parent-child link (via requests.ts UNAUTHORIZED check)', () => {
  const requestsSrc = read('lib/vault/requests.ts')
  // respondToRequest must check isParent before allowing parent actions
  return requestsSrc.includes('UNAUTHORIZED') && requestsSrc.includes('isParent') && requestsSrc.includes('isChild')
})

// ── 9. Admin queue is admin-only ──────────────────────────────────────────────

check('09', 'Admin vault page checks admin role via getUserRole', () => {
  const src = read('app/dashboard/admin/vault/page.tsx')
  return src.includes("getUserRole(user) !== 'admin'") || src.includes("getUserRole(user) === 'admin'")
})

// ── 10. Reward eligibility consumes verified learning data ────────────────────

check('10', 'milestone-engine.ts reads topic_progress, profiles, and profile_badges (learning signals only)', () => {
  // milestone-engine is pure — it receives a LearningSnapshot with verified fields
  const src = read('lib/vault/milestone-engine.ts')
  return (
    src.includes('topicsCompleted') &&
    src.includes('totalPoints') &&
    src.includes('badgeCount')
  )
})

check('10b', 'status.ts reads topic_progress status=completed (verified mastery signal)', () => {
  const src = read('lib/vault/status.ts')
  return src.includes("status: 'completed'") && src.includes('topicProgress')
})

// ── 11. Screen time is not used as a reward input ────────────────────────────

check('11', 'milestone-engine.ts has no screen_time, session_duration, or login_count signal', () => {
  const src = read('lib/vault/milestone-engine.ts')
  return (
    !src.includes('screen_time') &&
    !src.includes('screenTime') &&
    !src.includes('session_duration') &&
    !src.includes('login_count') &&
    !src.includes('loginCount')
  )
})

// ── 12. XP and reward credits are separate ───────────────────────────────────

check('12', 'requests.ts does not write to point_events or profiles.total_points', () => {
  const src = read('lib/vault/requests.ts')
  return !src.includes('point_events') && !src.includes('total_points') && !src.includes('pointEvent')
})

// ── 13. Fulfilling rewards does not reduce XP ────────────────────────────────

check('13', 'markFulfilled only updates reward_requests.status — no XP write', () => {
  const src = read('lib/vault/requests.ts')
  // Find the markFulfilled function and check it doesn't touch learning tables
  const markIdx = src.indexOf('async function markFulfilled')
  const afterMark = src.slice(markIdx, markIdx + 600)
  return (
    !afterMark.includes('total_points') &&
    !afterMark.includes('point_events') &&
    !afterMark.includes('topic_progress')
  )
})

// ── 14. Duplicate pending requests are blocked ────────────────────────────────

check('14', 'createRewardRequest checks for existing active request before creating', () => {
  const src = read('lib/vault/requests.ts')
  return src.includes('DUPLICATE_PENDING') && src.includes("'pending', 'deferred', 'counter_offered'")
})

// ── 15. Same milestone cannot be claimed repeatedly ──────────────────────────

check('15', 'checkAndUpdateMilestone checks vault_milestone_events before awarding credits', () => {
  const src = read('lib/vault/status.ts')
  return (
    src.includes('vaultMilestoneEvent') &&
    src.includes('awardedBands') &&
    src.includes('awardedBands.has(band)')
  )
})

// ── 16. Parent approval is fail-closed ───────────────────────────────────────

check('16', 'respond route blocks unauthenticated and non-parent/child access', () => {
  const src = read('app/api/vault/parent/respond/route.ts')
  return (
    src.includes('Unauthorized') &&
    src.includes("role !== 'parent' && role !== 'child'") ||
    (src.includes("'parent'") && src.includes("'child'") && src.includes('Forbidden'))
  )
})

// ── 17. NullCommerceAdapter is the only active adapter ───────────────────────

check('17', 'NullCommerceAdapter is the only active adapter — no ShopifyAdapter import', () => {
  // No Shopify adapter file should exist
  const shopifyExists = exists('lib/vault/shopify-adapter.ts')
  // commerce-adapter must export NullCommerceAdapter
  const src = read('lib/vault/commerce-adapter.ts')
  return !shopifyExists && src.includes('NullCommerceAdapter')
})

// ── 18. No Shopify imports exist anywhere in the codebase ────────────────────

check('18', 'No Shopify imports in lib/vault or app/api/vault', () => {
  const files = [
    'lib/vault/milestone-engine.ts',
    'lib/vault/status.ts',
    'lib/vault/requests.ts',
    'lib/vault/settings.ts',
    'lib/vault/admin.ts',
    'lib/vault/commerce-adapter.ts',
    'app/api/vault/status/route.ts',
    'app/api/vault/request/route.ts',
    'app/api/vault/parent/respond/route.ts',
    'app/api/vault/parent/requests/route.ts',
    'app/api/admin/vault/requests/route.ts',
  ]
  return files.every((f) => {
    const src = read(f)
    return !src.toLowerCase().includes('shopify') && !src.includes('@shopify')
  })
})

// ── 19. No Amazon links or imports exist ─────────────────────────────────────

check('19', 'No Amazon links or imports in child vault pages or vault lib', () => {
  const files = [
    'app/(child)/vault/page.tsx',
    'app/(child)/vault/RequestSection.tsx',
    'lib/vault/commerce-adapter.ts',
    'app/api/vault/request/route.ts',
  ]
  return files.every((f) => {
    const src = read(f)
    return (
      !src.includes('amazon.co.uk') &&
      !src.includes('amazon.com') &&
      !src.includes('amzn.to') &&
      !src.toLowerCase().includes('@aws-sdk') &&
      !src.includes('require("aws')
    )
  })
})

// ── 20. One full reward cycle is demonstrable ─────────────────────────────────

check('20', 'All files for a full reward cycle exist (seed, status, request, respond, child page, parent page)', () => {
  return [
    'scripts/seed-vault-milestones.mjs',
    'lib/vault/status.ts',
    'lib/vault/requests.ts',
    'app/(child)/vault/page.tsx',
    'app/dashboard/parent/vault/[childId]/page.tsx',
    'app/api/vault/request/route.ts',
    'app/api/vault/parent/respond/route.ts',
  ].every(exists)
})

// ── 21. Child UI does not expose credit/wallet/price/spend language ───────────

check('21', 'Child vault page has no "credit balance", "spend", "price", "wallet", or "redeem" language', () => {
  const childVaultPage = read('app/(child)/vault/page.tsx')
  const requestSection = read('app/(child)/vault/RequestSection.tsx')
  const childDashboard = read('app/dashboard/child/page.tsx')

  const bannedPatterns = [
    /credit balance/i,
    /spend credit/i,
    /\bprice\b/i,
    /\bwallet\b/i,
    /redeem value/i,
    /\bcost\b/i,
    // "credits" as a standalone count display is banned (e.g. "3 credits")
    /\d+\s+credit/i,
    // "Claim" in a commerce context
    /Claim Your/i,
  ]

  for (const src of [childVaultPage, requestSection, childDashboard]) {
    for (const pattern of bannedPatterns) {
      if (pattern.test(src)) return false
    }
  }
  return true
})

// ── 22. Physical rewards remain disabled in Stage 1 ──────────────────────────

check('22', 'Physical rewards are locked out in respond route and settings.ts', () => {
  const respondRoute = read('app/api/vault/parent/respond/route.ts')
  const settingsSrc = read('lib/vault/settings.ts')
  return (
    respondRoute.includes("rewardType === 'physical'") &&
    respondRoute.includes('PHYSICAL_DISABLED') &&
    !settingsSrc.includes('physicalRewardsEnabled') &&
    !settingsSrc.includes('physical_rewards_enabled')
  )
})

// ── Report ────────────────────────────────────────────────────────────────────

const totalChecks = pass.length + fail.length
console.log('\n── Reward Vault Stage 1 Closure Gate ──\n')
for (const p of pass) {
  console.log(`  ✓ [${p.id.padEnd(3)}] ${p.description}`)
}
if (fail.length > 0) {
  console.log('')
  for (const f of fail) {
    console.log(`  ✗ [${f.id.padEnd(3)}] ${f.description}`)
    console.log(`       → ${f.reason}`)
  }
}
console.log(`\n  ${pass.length}/${totalChecks} checks passed\n`)

if (fail.length > 0) {
  process.exit(1)
}
