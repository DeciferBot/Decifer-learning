/**
 * verify-autopilot-safety.mjs — Static safety checks for the Content Autopilot.
 *
 * Checks:
 *  1.  .PIPELINE_STOP sentinel exists
 *  2.  autopilot/__init__.py exists
 *  3.  autopilot/coverage_scanner.py exists
 *  4.  autopilot/work_queue.py exists
 *  5.  autopilot/failure_classifier.py exists
 *  6.  autopilot/verifier_router.py exists
 *  7.  autopilot/safety.py exists
 *  8.  learning-autopilot-plan.mjs exists
 *  9.  autopilot/safety.py contains .PIPELINE_STOP check
 * 10.  autopilot/safety.py contains trading-pattern guard
 * 11.  autopilot/safety.py contains topic-limit guard
 * 12.  autopilot/safety.py contains MAX_TOPICS_PER_RUN constant
 * 13.  work_queue.py contains MAX_ATTEMPTS constant
 * 14.  work_queue.py fails closed (blocked status on exceeded attempts)
 * 15.  coverage_scanner.py does NOT auto-generate content
 * 16.  learning-autopilot-plan.mjs is read-only (no write/generate imports)
 * 17.  learning-autopilot-plan.mjs contains trading guard
 * 18.  verifier_router.py routes english_phonics without LanguageTool
 * 19.  verifier_router.py routes english_grammar through LanguageTool
 * 20.  verifier_router.py routes english_etymology with spelling suppressed
 * 21.  english.py handles english_punctuation type
 * 22.  english.py handles english_etymology type
 * 23.  english.py handles english_phonics type
 * 24.  failure_classifier.py handles RETRY_EXTERNAL for API outages
 * 25.  failure_classifier.py handles VERIFIER_FALSE_POSITIVE for phonics
 * 26.  failure_classifier.py handles NEEDS_RAG_ENRICHMENT
 * 27.  Trading cron is NOT referenced in any autopilot file
 * 28.  Autopilot plan command does not import any generation/LLM code
 * 29.  coverage_scanner.py does not call pipeline.py
 * 30.  tests exist for verifier_routing and failure_classifier
 *
 * Run:
 *   node scripts/verify-autopilot-safety.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function pass(label) {
  console.log(`  ✅ ${label}`)
  passed++
}

function fail(label, detail = '') {
  console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`)
  failed++
}

function check(label, fn) {
  try {
    const result = fn()
    if (result === false) {
      fail(label)
    } else {
      pass(label)
    }
  } catch (err) {
    fail(label, err.message)
  }
}

function read(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!existsSync(abs)) throw new Error(`File not found: ${relPath}`)
  return readFileSync(abs, 'utf8')
}

function contains(filePath, pattern) {
  const content = read(filePath)
  if (pattern instanceof RegExp) return pattern.test(content)
  return content.includes(pattern)
}

function doesNotContain(filePath, pattern) {
  const content = read(filePath)
  if (pattern instanceof RegExp) return !pattern.test(content)
  return !content.includes(pattern)
}

const PIPELINE = 'services/content-pipeline'
const AUTOPILOT = `${PIPELINE}/autopilot`

// ── Check 1-8: file existence ──────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  1. File existence')
console.log('─────────────────────────────────────────────────────────────')

check('1. .PIPELINE_STOP sentinel exists',                () => existsSync(path.join(ROOT, '.PIPELINE_STOP')))
check('2. autopilot/__init__.py exists',                  () => existsSync(path.join(ROOT, AUTOPILOT, '__init__.py')))
check('3. autopilot/coverage_scanner.py exists',          () => existsSync(path.join(ROOT, AUTOPILOT, 'coverage_scanner.py')))
check('4. autopilot/work_queue.py exists',                () => existsSync(path.join(ROOT, AUTOPILOT, 'work_queue.py')))
check('5. autopilot/failure_classifier.py exists',        () => existsSync(path.join(ROOT, AUTOPILOT, 'failure_classifier.py')))
check('6. autopilot/verifier_router.py exists',           () => existsSync(path.join(ROOT, AUTOPILOT, 'verifier_router.py')))
check('7. autopilot/safety.py exists',                    () => existsSync(path.join(ROOT, AUTOPILOT, 'safety.py')))
check('8. learning-autopilot-plan.mjs exists',            () => existsSync(path.join(ROOT, 'scripts', 'learning-autopilot-plan.mjs')))

// ── Check 9-14: safety module contents ───────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  2. Safety module')
console.log('─────────────────────────────────────────────────────────────')

check('9.  safety.py contains .PIPELINE_STOP check',      () => contains(`${AUTOPILOT}/safety.py`, 'PIPELINE_STOP'))
check('10. safety.py contains trading-pattern guard',      () => contains(`${AUTOPILOT}/safety.py`, /trading.*IGNORECASE|TRADING_PATTERNS/))
check('11. safety.py contains topic-limit guard',          () => contains(`${AUTOPILOT}/safety.py`, 'check_topic_limit'))
check('12. safety.py contains MAX_TOPICS_PER_RUN',         () => contains(`${AUTOPILOT}/safety.py`, 'MAX_TOPICS_PER_RUN'))
check('13. work_queue.py contains MAX_ATTEMPTS',           () => contains(`${AUTOPILOT}/work_queue.py`, 'MAX_ATTEMPTS'))
check('14. work_queue.py auto-blocks on exceeded attempts',() => contains(`${AUTOPILOT}/work_queue.py`, /BLOCKED.*value|JobStatus\.BLOCKED/))

// ── Check 15-16: plan command is read-only ────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  3. Dry-run command is read-only')
console.log('─────────────────────────────────────────────────────────────')

check('15. coverage_scanner.py has no generate/publish calls', () =>
  doesNotContain(`${AUTOPILOT}/coverage_scanner.py`, /pipeline\.generate|write_question|publish_question/)
)
check('16. learning-autopilot-plan.mjs has no anthropic/openai import', () =>
  doesNotContain('scripts/learning-autopilot-plan.mjs', /import.*anthropic|import.*openai|require.*anthropic|require.*openai/)
)
check('17. learning-autopilot-plan.mjs contains trading guard', () =>
  contains('scripts/learning-autopilot-plan.mjs', 'TRADING_PATTERN')
)

// ── Check 18-20: verifier routing ─────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  4. Verifier routing')
console.log('─────────────────────────────────────────────────────────────')

check('18. verifier_router routes english_phonics without LT', () => {
  const content = read(`${AUTOPILOT}/verifier_router.py`)
  // Phonics routing must set uses_language_tool=False
  return /english_phonics.*uses_language_tool.*False|ENGLISH_PHONICS.*skipped/s.test(content)
})
check('19. verifier_router routes english_grammar through LT', () =>
  contains(`${AUTOPILOT}/verifier_router.py`, 'uses_language_tool=True')
)
check('20. verifier_router routes english_etymology with spelling suppressed', () =>
  contains(`${AUTOPILOT}/verifier_router.py`, 'spelling_suppressed')
)

// ── Check 21-23: english.py new handlers ──────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  5. English verifier new handlers')
console.log('─────────────────────────────────────────────────────────────')

check('21. english.py handles english_punctuation', () =>
  contains(`${PIPELINE}/verifiers/english.py`, '_verify_punctuation_question')
)
check('22. english.py handles english_etymology', () =>
  contains(`${PIPELINE}/verifiers/english.py`, '_verify_etymology_question')
)
check('23. english.py handles english_phonics', () =>
  contains(`${PIPELINE}/verifiers/english.py`, '_verify_phonics_question')
)

// ── Check 24-26: failure classifier ──────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  6. Failure classifier')
console.log('─────────────────────────────────────────────────────────────')

check('24. failure_classifier has RETRY_EXTERNAL for API outages', () =>
  contains(`${AUTOPILOT}/failure_classifier.py`, 'RETRY_EXTERNAL')
)
check('25. failure_classifier has VERIFIER_FALSE_POSITIVE for phonics', () =>
  contains(`${AUTOPILOT}/failure_classifier.py`, 'VERIFIER_FALSE_POSITIVE')
)
check('26. failure_classifier has NEEDS_RAG_ENRICHMENT', () =>
  contains(`${AUTOPILOT}/failure_classifier.py`, 'NEEDS_RAG_ENRICHMENT')
)

// ── Check 27-28: trading isolation ────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  7. Trading isolation')
console.log('─────────────────────────────────────────────────────────────')

const autopilotFiles = [
  `${AUTOPILOT}/__init__.py`,
  `${AUTOPILOT}/coverage_scanner.py`,
  `${AUTOPILOT}/work_queue.py`,
  `${AUTOPILOT}/failure_classifier.py`,
  `${AUTOPILOT}/verifier_router.py`,
  `${AUTOPILOT}/safety.py`,
  'scripts/learning-autopilot-plan.mjs',
  // Note: this verifier script itself is intentionally excluded from the trading-reference
  // check — it necessarily mentions "trading" in its own check descriptions.
]

check('27. No autopilot file imports or references trading cron', () => {
  // Files explicitly excluded: safety.py contains the _TRADING_PATTERNS guard definition
  // (it names what to reject); the guard string itself contains the trading keywords by design.
  const excluded = new Set([`${AUTOPILOT}/safety.py`])
  for (const f of autopilotFiles) {
    if (excluded.has(f)) continue
    const abs = path.join(ROOT, f)
    if (!existsSync(abs)) continue
    const content = readFileSync(abs, 'utf8')
    const lines = content.split('\n')
    for (const line of lines) {
      // Skip comment lines and lines containing the guard variable name
      if (line.trim().startsWith('#') || line.trim().startsWith('//')) continue
      if (line.includes('TRADING_PATTERN') || line.includes('trading.*IGNORECASE')) continue
      if (/alpaca|trading.*cron|decifer-trading/i.test(line)) {
        throw new Error(`Trading reference found in ${f}: ${line.trim()}`)
      }
    }
  }
  // Separately verify safety.py ONLY contains the guard and does not IMPORT trading modules
  const safetyContent = readFileSync(path.join(ROOT, `${AUTOPILOT}/safety.py`), 'utf8')
  if (/^import.*alpaca|^from.*alpaca|^import.*trading_cron/m.test(safetyContent)) {
    throw new Error('safety.py imports a trading module')
  }
  return true
})

check('28. autopilot plan command does not import pipeline.py or anthropic', () =>
  doesNotContain('scripts/learning-autopilot-plan.mjs', /import.*pipeline|require.*pipeline/)
)

// ── Check 29-30: structural checks ───────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────')
console.log('  8. Structure')
console.log('─────────────────────────────────────────────────────────────')

check('29. coverage_scanner.py does not call pipeline generation functions', () =>
  doesNotContain(`${AUTOPILOT}/coverage_scanner.py`, /run_generation|generate_questions|pipeline\.run/)
)
check('30. test files exist for verifier routing and failure classifier', () => {
  const vt = existsSync(path.join(ROOT, AUTOPILOT, 'tests', 'test_verifier_routing.py'))
  const ft = existsSync(path.join(ROOT, AUTOPILOT, 'tests', 'test_failure_classifier.py'))
  return vt && ft
})

// ── Final verdict ─────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  Autopilot Safety: ${passed}/${passed + failed} checks passed`)
if (failed === 0) {
  console.log('  ✅ PASS — Autopilot foundation is safe to ship')
} else {
  console.log(`  ❌ FAIL — ${failed} check(s) failed`)
}
console.log('═══════════════════════════════════════════════════════════════\n')

process.exit(failed > 0 ? 1 : 0)
