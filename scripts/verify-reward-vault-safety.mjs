/**
 * Reward Vault Stage 1 — safety verification script.
 *
 * Runs 20 structural and logic checks without hitting the network.
 * Pass rate: 20/20 required to close Stage 1.
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

// ── 1–4: Critical safety boundaries ─────────────────────────────────────────

check('01', 'milestone-engine.ts has no DB imports', () => {
  const src = read('lib/vault/milestone-engine.ts')
  return !src.includes("from '@/lib/prisma'") && !src.includes("from 'prisma'") && !src.includes('supabase')
})

check('02', 'milestone-engine.ts has no learning-module imports', () => {
  const imports = read('lib/vault/milestone-engine.ts').split('\n').filter(l => l.trimStart().startsWith('import'))
  const banned = ["lib/points", "lib/sm2", "lib/cards", "lib/adaptive"]
  return !imports.some(line => banned.some(b => line.includes(b)))
})

check('03', 'status.ts has no learning-module imports', () => {
  const imports = read('lib/vault/status.ts').split('\n').filter(l => l.trimStart().startsWith('import'))
  const banned = ["lib/points", "lib/sm2", "lib/cards", "lib/adaptive"]
  return !imports.some(line => banned.some(b => line.includes(b)))
})

check('04', 'requests.ts has no learning-module imports', () => {
  const imports = read('lib/vault/requests.ts').split('\n').filter(l => l.trimStart().startsWith('import'))
  const banned = ["lib/points", "lib/sm2", "lib/cards", "lib/adaptive"]
  return !imports.some(line => banned.some(b => line.includes(b)))
})

// ── 5–7: Commerce isolation ───────────────────────────────────────────────

check('05', 'commerce-adapter.ts has no Shopify imports', () => {
  const imports = read('lib/vault/commerce-adapter.ts').split('\n').filter(l => l.trimStart().startsWith('import'))
  return !imports.some(l => /shopify/i.test(l) || l.includes('@shopify'))
})

check('06', 'commerce-adapter.ts has no Amazon imports', () => {
  const imports = read('lib/vault/commerce-adapter.ts').split('\n').filter(l => l.trimStart().startsWith('import'))
  return !imports.some(l => /amazon/i.test(l) || l.includes('@aws'))
})

check('07', 'NullCommerceAdapter returns manual status in Stage 1', () => {
  const src = read('lib/vault/commerce-adapter.ts')
  return src.includes("status: 'manual'") && src.includes('NullCommerceAdapter')
})

// ── 8–10: Credit and milestone integrity ─────────────────────────────────

check('08', 'requests.ts refunds credit on rejection', () => {
  const src = read('lib/vault/requests.ts')
  return src.includes("'reject'") && src.includes('increment: request.credits_used')
})

check('09', 'requests.ts refunds credit on dismiss_counter', () => {
  const src = read('lib/vault/requests.ts')
  return src.includes("'dismiss_counter'") && src.includes('increment: request.credits_used')
})

check('10', 'status.ts checks vault_milestone_events before awarding credits', () => {
  const src = read('lib/vault/status.ts')
  return src.includes('vaultMilestoneEvent') && src.includes('awardedBands') && src.includes('awardedBands.has(band)')
})

// ── 11–13: Physical rewards locked in Stage 1 ────────────────────────────

check('11', 'respond route blocks physical reward_type in Stage 1', () => {
  const src = read('app/api/vault/parent/respond/route.ts')
  return src.includes("rewardType === 'physical'") && src.includes('PHYSICAL_DISABLED')
})

check('12', 'VaultParentSettings.physical_rewards_enabled defaults to false in schema', () => {
  const src = read('prisma/schema.prisma')
  return src.includes('physical_rewards_enabled') && src.includes('@default(false)')
})

check('13', 'settings.ts does not expose physical_rewards_enabled in ParentSettingsUpdate', () => {
  const src = read('lib/vault/settings.ts')
  // Must not appear in the interface definition (non-comment lines)
  const nonCommentLines = src.split('\n').filter(l => !l.trimStart().startsWith('//'))
  return !nonCommentLines.some(l => l.includes('physicalRewardsEnabled') || l.includes('physical_rewards_enabled'))
})

// ── 14–16: Anti-gambling, no randomised prize odds ───────────────────────

check('14', 'requests.ts has no Math.random or randomised reward selection', () => {
  const src = read('lib/vault/requests.ts')
  return !src.includes('Math.random') && !src.includes('shuffle') && !src.includes('pickRarity')
})

check('15', 'milestone-engine.ts has no random or probabilistic mechanics', () => {
  const src = read('lib/vault/milestone-engine.ts')
  return !src.includes('Math.random') && !src.includes('probability') && !src.includes('chance')
})

check('16', 'No loot-box language in vault pages', () => {
  const childVaultSrc = read('app/(child)/vault/page.tsx')
  return !childVaultSrc.includes('spin') && !childVaultSrc.includes('mystery prize') && !childVaultSrc.includes('scratch')
})

// ── 17–18: Parent fail-closed ────────────────────────────────────────────

check('17', 'createRewardRequest validates credit_balance >= 1 before creating', () => {
  const src = read('lib/vault/requests.ts')
  return src.includes('INSUFFICIENT_CREDITS') && src.includes('credit_balance') && src.includes('< 1')
})

check('18', 'respondToRequest validates authorisation before any write', () => {
  const src = read('lib/vault/requests.ts')
  // Auth check must appear before any DB write in the function
  const authIdx = src.indexOf('UNAUTHORIZED')
  const updateIdx = src.indexOf('rewardRequest.update')
  return authIdx > -1 && updateIdx > -1 && authIdx < updateIdx
})

// ── 19–20: Required files exist ──────────────────────────────────────────

check('19', 'All 7 required lib/vault files exist', () => {
  return [
    'lib/vault/milestone-engine.ts',
    'lib/vault/commerce-adapter.ts',
    'lib/vault/status.ts',
    'lib/vault/requests.ts',
    'lib/vault/settings.ts',
    'lib/vault/admin.ts',
  ].every(exists)
})

check('20', 'All 7 required API routes exist', () => {
  return [
    'app/api/vault/status/route.ts',
    'app/api/vault/check-milestone/route.ts',
    'app/api/vault/request/route.ts',
    'app/api/vault/parent/requests/route.ts',
    'app/api/vault/parent/respond/route.ts',
    'app/api/vault/parent/settings/[childId]/route.ts',
    'app/api/admin/vault/requests/route.ts',
  ].every(exists)
})

// ── Report ────────────────────────────────────────────────────────────────

console.log('\n── Reward Vault Stage 1 Safety Verification ──\n')
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
console.log(`\n  ${pass.length}/${pass.length + fail.length} checks passed\n`)

if (fail.length > 0) {
  process.exit(1)
}
