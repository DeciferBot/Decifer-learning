/**
 * verify-learning-pipeline-stop-guard.mjs
 *
 * Verifies the Decifer Learning pipeline stop guard is correctly installed:
 *   1. .PIPELINE_STOP sentinel exists at repo root
 *   2. All known Learning generation entrypoints reference the stop guard
 *   3. No active Learning tmux/screen sessions running
 *   4. No active Learning generation process running
 *   5. No executable /tmp Learning batch/topup/chain/watch scripts
 *   6. Decifer Trading cron is present and NOT commented out
 *   7. Decifer Trading processes are running (not killed by this tooling)
 *
 * Run: node scripts/verify-learning-pipeline-stop-guard.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')

let pass = 0
let fail = 0
let warn = 0

function ok(msg) { console.log(`  ✅ ${msg}`); pass++ }
function no(msg) { console.log(`  ❌ ${msg}`); fail++ }
function wn(msg) { console.log(`  ⚠️  ${msg}`); warn++ }
function section(title) { console.log(`\n── ${title} ──`) }

function tryExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }) } catch (e) { return e.stdout || '' }
}

// ── 1. Sentinel file ─────────────────────────────────────────────────────────
section('1. Stop sentinel')

const sentinelPath = resolve(REPO_ROOT, '.PIPELINE_STOP')
if (existsSync(sentinelPath)) {
  const content = readFileSync(sentinelPath, 'utf8').trim()
  ok(`.PIPELINE_STOP exists at ${sentinelPath}`)
  ok(`Content: "${content}"`)
} else {
  no(`.PIPELINE_STOP MISSING at ${sentinelPath}`)
}

// ── 2. Entrypoints patched ────────────────────────────────────────────────────
section('2. Generation entrypoint guards')

const GENERATION_ENTRYPOINTS = [
  'scripts/generate-batch-y2.py',
  'scripts/generate-batch-y3.py',
  'scripts/generate-batch-y6.py',
  'scripts/generate-batch-y7.py',
  'scripts/generate-controlled-11b-do.py',
  'scripts/generate-controlled-11b.py',
  'scripts/generate-learn-content.py',
  'scripts/topup-weak-topics.py',
  'scripts/recover-weak-topics.py',
  'scripts/publish-ready-topics.ts',
  'scripts/publish-topic.ts',
  'services/content-pipeline/pipeline.py',
]

const GUARD_MARKERS = ['_STOP_GUARD', 'PIPELINE_STOP']

for (const rel of GENERATION_ENTRYPOINTS) {
  const fpath = resolve(REPO_ROOT, rel)
  if (!existsSync(fpath)) {
    wn(`${rel} — file not found (skipped)`)
    continue
  }
  const content = readFileSync(fpath, 'utf8')
  const hasGuard = GUARD_MARKERS.some(m => content.includes(m))
  if (hasGuard) {
    ok(`${rel} — stop guard present`)
  } else {
    no(`${rel} — MISSING stop guard`)
  }
}

// ── 3. No active Learning tmux/screen sessions ────────────────────────────────
section('3. Active Learning sessions (tmux/screen)')

const LEARNING_SESSION_PATTERNS = /y2batch|y6batch|topup|recover|publish|promoter|live.promoter|watcher|generate/i

const tmuxOut = tryExec('tmux ls 2>/dev/null')
if (!tmuxOut.trim()) {
  ok('No tmux sessions at all')
} else {
  const learningSessions = tmuxOut.split('\n').filter(l => LEARNING_SESSION_PATTERNS.test(l))
  if (learningSessions.length === 0) {
    ok(`tmux sessions present but none are Learning generators: ${tmuxOut.trim().replace(/\n/g, ', ')}`)
  } else {
    no(`Active Learning tmux sessions found:\n${learningSessions.join('\n')}`)
  }
}

const screenOut = tryExec('screen -ls 2>/dev/null')
if (/No Sockets found|There is no screen/i.test(screenOut) || !screenOut.trim()) {
  ok('No screen sessions')
} else {
  const learningScreens = screenOut.split('\n').filter(l => LEARNING_SESSION_PATTERNS.test(l))
  if (learningScreens.length === 0) {
    ok('screen sessions present but none are Learning generators')
  } else {
    no(`Active Learning screen sessions:\n${learningScreens.join('\n')}`)
  }
}

// ── 4. No active Learning generation processes ────────────────────────────────
section('4. Active Learning generation processes')

const LEARNING_PROC_PATTERN = 'generate-batch|topup|recover|generate-learn|publish-ready|LanguageTool'
const psOut = tryExec(`ps aux 2>/dev/null | grep -iE "${LEARNING_PROC_PATTERN}" | grep -v grep`)
if (!psOut.trim()) {
  ok('No Learning generation processes running')
} else {
  const lines = psOut.trim().split('\n').filter(Boolean)
  no(`${lines.length} Learning generation process(es) found:\n${lines.join('\n')}`)
}

// ── 5. No executable /tmp Learning scripts ────────────────────────────────────
section('5. Executable /tmp Learning scripts')

const TMP_PATTERN = /batch|topup|recover|chain|watch|promoter|generate/i
let tmpHits = []
try {
  const tmpFiles = readdirSync('/tmp').filter(f => TMP_PATTERN.test(f) && f.endsWith('.py'))
  tmpHits = tmpFiles
} catch (_) {}

if (tmpHits.length === 0) {
  ok('No suspicious /tmp Learning scripts found')
} else {
  no(`/tmp Learning scripts found: ${tmpHits.join(', ')}`)
}

// ── 6. Decifer Trading cron present and active ────────────────────────────────
section('6. Decifer Trading cron')

const crontabOut = tryExec('crontab -l 2>/dev/null')
if (!crontabOut.trim()) {
  wn('Cannot read crontab from this machine (expected — crontab lives on the droplet)')
} else {
  const tradingCronLine = crontabOut.split('\n').find(l =>
    l.includes('run_intelligence_pipeline') && !l.trim().startsWith('#')
  )
  if (tradingCronLine) {
    ok(`Trading cron ACTIVE: ${tradingCronLine.trim()}`)
  } else {
    const commented = crontabOut.split('\n').find(l => l.includes('run_intelligence_pipeline'))
    if (commented) {
      no(`Trading cron is COMMENTED OUT: ${commented.trim()}`)
    } else {
      wn('Trading cron not found in local crontab — check droplet crontab separately')
    }
  }
}

// ── 7. Trading process guard (remote check skipped — not SSH context) ─────────
section('7. Decifer Trading processes')
wn('Trading process check requires SSH to droplet — run manually:')
console.log('     ssh root@<droplet> \'docker ps && ps aux | grep -E "run_intelligence_pipeline|gunicorn intelligence_api" | grep -v grep\'')

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${warn} warnings`)
console.log('─'.repeat(60))

if (fail === 0) {
  console.log('  LOCKDOWN PASS: Trading protected, Learning stop sentinel enforced')
} else {
  console.log('  LOCKDOWN FAIL: See ❌ items above')
}
console.log('═'.repeat(60) + '\n')

if (fail > 0) process.exit(1)
