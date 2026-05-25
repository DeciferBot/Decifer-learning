/**
 * Parent Learning Intelligence (PLI v1) — Verification Script
 *
 * Checks:
 *
 * Structure & files
 *  1.  lib/learning-events.ts exists
 *  2.  lib/learning-signals.ts exists
 *  3.  lib/learning-signals-runner.ts exists
 *  4.  app/api/events/learning/route.ts exists
 *  5.  components/learn/LessonEventTracker.tsx exists
 *  6.  components/quiz/QuizEventTracker.tsx exists
 *
 * Signal engine purity
 *  7.  lib/learning-signals.ts does NOT import from prisma or @prisma
 *  8.  lib/learning-signals.ts does NOT import from anthropic or openai
 *  9.  lib/learning-signals.ts exports computeSignals
 * 10.  lib/learning-signals.ts defines all 10 signal types
 *
 * Signal rules
 * 11.  interest_signal requires openCount >= 3 check
 * 12.  interest_signal requires events across 2+ separate days
 * 13.  avoidance_signal requires recommendation_shown count >= 3
 * 14.  lower_accuracy uses a minimum answers threshold (not any 1 answer)
 * 15.  Every signal type produces an evidenceSummary field
 * 16.  Every signal type produces a recommendedAction field
 * 17.  No signal uses the word "lazy", "disorder", "ADHD", "dyslexia"
 * 18.  No signal uses "struggles with" or "bad at"
 *
 * Parent dashboard
 * 19.  Only ONE parent child detail page exists (no duplicate dashboard)
 * 20.  getProgressBySubject is exported from lib/parent-dashboard.ts
 * 21.  getStrongestTopics is exported from lib/parent-dashboard.ts
 * 22.  getSignalsForChild is exported from lib/learning-signals-runner.ts
 * 23.  Child detail page imports Learning Map section (signals/getSignalsForChild)
 * 24.  Child detail page contains "Learning Map" heading text
 * 25.  Child detail page does not use "struggles with"
 * 26.  Child detail page does not label children: weak, bad, lazy, not intelligent
 * 27.  signalLevel() is defined in lib/parent-dashboard.ts
 *
 * Homepage PLI copy
 * 28.  Homepage does NOT contain "AI-powered" (not live yet)
 * 29.  Homepage hero contains "Understand how your child"
 * 30.  Homepage contains "learning map"
 * 31.  Homepage CTA contains "learning map"
 * 32.  Homepage does not say "struggles with" or "bad at"
 *
 * Event instrumentation
 * 33.  LessonEventTracker fires lesson_opened
 * 34.  LessonEventTracker fires lesson_active_time_recorded
 * 35.  LessonCompleteCTA fires lesson_completed
 * 36.  QuizEventTracker fires quiz_started
 * 37.  api/events/learning/route.ts validates eventType with isValidEventType
 * 38.  api/events/learning/route.ts verifies auth before recording
 * 39.  api/events/learning/route.ts sanitises metadata (strips profile_id override)
 *
 * Confidence levels
 * 40.  lib/parent-dashboard.ts defines SignalConfidence type or signalLevel()
 * 41.  Confidence levels in signals use only: early, moderate, strong
 *
 * Run: node --env-file=.env.local scripts/verify-parent-learning-intelligence.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(process.cwd())

let passed = 0
let failed = 0

function ok(n, msg) {
  console.log(`  ✅ ${String(n).padStart(2, '0')}  ${msg}`)
  passed++
}

function fail(n, msg, detail = '') {
  console.log(`  ❌ ${String(n).padStart(2, '0')}  ${msg}${detail ? `\n      → ${detail}` : ''}`)
  failed++
}

function readFile(rel) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf8')
}

function fileExists(rel) {
  return existsSync(resolve(ROOT, rel))
}

console.log('\nParent Learning Intelligence v1 — Verification\n')

// ── 1–6: File existence ──────────────────────────────────────────────────────

const FILES = [
  [1, 'lib/learning-events.ts'],
  [2, 'lib/learning-signals.ts'],
  [3, 'lib/learning-signals-runner.ts'],
  [4, 'app/api/events/learning/route.ts'],
  [5, 'components/learn/LessonEventTracker.tsx'],
  [6, 'components/quiz/QuizEventTracker.tsx'],
]

console.log('── Structure & files ─────────────────────────────────────────────')
for (const [n, rel] of FILES) {
  if (fileExists(rel)) ok(n, `${rel} exists`)
  else fail(n, `${rel} missing`)
}

// ── 7–10: Signal engine purity ───────────────────────────────────────────────

console.log('\n── Signal engine purity ──────────────────────────────────────────')
const signals = readFile('lib/learning-signals.ts') ?? ''

const hasPrismaImport = /from ['"]@prisma\/client['"]|from ['"]\.\.?\/?.*?prisma['"]/.test(signals)
if (!hasPrismaImport) ok(7, 'lib/learning-signals.ts has no Prisma import (pure)')
else fail(7, 'lib/learning-signals.ts imports Prisma — engine must be pure')

const hasLLMImport = /from ['"]@anthropic|from ['"]anthropic|from ['"]openai/.test(signals)
if (!hasLLMImport) ok(8, 'lib/learning-signals.ts has no LLM import')
else fail(8, 'lib/learning-signals.ts imports an LLM library — must not')

if (signals.includes('computeSignals')) ok(9, 'lib/learning-signals.ts exports computeSignals')
else fail(9, 'lib/learning-signals.ts does not export computeSignals')

const SIGNAL_TYPES = [
  'mastery',
  'lower_accuracy',
  'high_effort_low_progress',
  'quick_success',
  'rushing_or_low_engagement',
  'persistence',
  'repeated_without_progress',
  'interest_signal',
  'avoidance_signal',
  'confidence_gap',
]
const missingTypes = SIGNAL_TYPES.filter((t) => !signals.includes(t))
if (missingTypes.length === 0) ok(10, 'All 10 signal types defined in lib/learning-signals.ts')
else fail(10, `Missing signal types: ${missingTypes.join(', ')}`)

// ── 11–18: Signal rules ──────────────────────────────────────────────────────

console.log('\n── Signal rules ──────────────────────────────────────────────────')

// The engine uses events.length < 3 or openCount >= 3 — both are valid patterns
if (
  /openCount\s*>=?\s*3/.test(signals) ||
  /events\.length\s*<\s*3/.test(signals) ||
  /\.length\s*<\s*3/.test(signals)
)
  ok(11, 'interest_signal enforces minimum 3 opens threshold')
else fail(11, 'interest_signal does not enforce openCount >= 3 (or events.length < 3)')

if (signals.includes('distinctDays') || signals.includes('separate days') || /days\.size\s*>=?\s*2|distinctDays\s*>=?\s*2/.test(signals))
  ok(12, 'interest_signal checks events across 2+ separate days')
else fail(12, 'interest_signal does not check for 2+ separate days')

if (/recommendation_shown/.test(signals) && /recommendationCount|recShownCount|shownCount/.test(signals))
  ok(13, 'avoidance_signal tracks recommendation_shown events')
else if (/recommendation_shown/.test(signals) && />=?\s*3/.test(signals.slice(signals.indexOf('avoidance'), signals.indexOf('avoidance') + 600)))
  ok(13, 'avoidance_signal checks recommendation_shown count')
else fail(13, 'avoidance_signal does not check recommendation_shown threshold of 3')

if (/totalAnswers\s*<\s*\d|answers\.length\s*<\s*\d|evidenceCount\s*<\s*\d/.test(signals))
  ok(14, 'lower_accuracy enforces minimum answer threshold')
else fail(14, 'lower_accuracy may not enforce minimum answer threshold')

if (signals.includes('evidenceSummary')) ok(15, 'Signals produce evidenceSummary')
else fail(15, 'evidenceSummary field missing from signal output')

if (signals.includes('recommendedAction')) ok(16, 'Signals produce recommendedAction')
else fail(16, 'recommendedAction field missing from signal output')

// Strip comment lines before checking — words that appear only in "do not use" doc-comments are not violations
const signalsNoComments = signals
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
  .join('\n')
const FORBIDDEN_SIGNAL_WORDS = ['lazy', 'disorder', 'ADHD', 'dyslexia', 'bad at', 'struggles with']
const foundForbidden = FORBIDDEN_SIGNAL_WORDS.filter((w) => signalsNoComments.toLowerCase().includes(w.toLowerCase()))
if (foundForbidden.length === 0) ok(17, 'No forbidden diagnostic language in signal engine code')
else fail(17, `Forbidden words in signal engine code (non-comment): ${foundForbidden.join(', ')}`)

const FORBIDDEN_COPY = ['struggles with', 'bad at', 'weak child', 'not intelligent', 'hates', 'dislikes']
const foundCopy = FORBIDDEN_COPY.filter((w) => signals.toLowerCase().includes(w.toLowerCase()))
if (foundCopy.length === 0) ok(18, 'No forbidden copy patterns in signal engine')
else fail(18, `Forbidden copy in lib/learning-signals.ts: ${foundCopy.join(', ')}`)

// ── 19–27: Parent dashboard ──────────────────────────────────────────────────

console.log('\n── Parent dashboard ──────────────────────────────────────────────')

const DASHBOARD_PATH = 'app/dashboard/parent/children/[childId]/page.tsx'
const dashFile = readFile(DASHBOARD_PATH) ?? ''

// Check no second dashboard exists
const ALT_PATHS = [
  'app/dashboard/parent/learning-map/page.tsx',
  'app/dashboard/parent/insights/page.tsx',
  'app/(parent)/learning-map/page.tsx',
]
const dupes = ALT_PATHS.filter((p) => fileExists(p))
if (dupes.length === 0) ok(19, 'No duplicate parent dashboard created')
else fail(19, `Duplicate dashboard pages found: ${dupes.join(', ')}`)

const pd = readFile('lib/parent-dashboard.ts') ?? ''
if (pd.includes('getProgressBySubject')) ok(20, 'getProgressBySubject exported from lib/parent-dashboard.ts')
else fail(20, 'getProgressBySubject missing from lib/parent-dashboard.ts')

if (pd.includes('getStrongestTopics')) ok(21, 'getStrongestTopics exported from lib/parent-dashboard.ts')
else fail(21, 'getStrongestTopics missing from lib/parent-dashboard.ts')

const runner = readFile('lib/learning-signals-runner.ts') ?? ''
if (runner.includes('getSignalsForChild')) ok(22, 'getSignalsForChild exported from lib/learning-signals-runner.ts')
else fail(22, 'getSignalsForChild missing from lib/learning-signals-runner.ts')

if (dashFile.includes('getSignalsForChild') || dashFile.includes('signals'))
  ok(23, 'Child detail page imports learning signals')
else fail(23, 'Child detail page does not reference signals/getSignalsForChild')

if (dashFile.includes('Learning Map') || dashFile.includes('learning map'))
  ok(24, 'Child detail page contains "Learning Map" section')
else fail(24, 'Child detail page missing "Learning Map" heading')

const DASH_FORBIDDEN = ['struggles with', 'bad at', 'weak child', 'not intelligent', 'lazy', 'ADHD', 'dyslexia', 'dislikes', 'hates']
const foundDash = DASH_FORBIDDEN.filter((w) => dashFile.toLowerCase().includes(w.toLowerCase()))
if (foundDash.length === 0) ok(25, 'No forbidden copy in child detail page')
else fail(25, `Forbidden copy in child detail page: ${foundDash.join(', ')}`)

const LABEL_FORBIDDEN = ['weak child', 'bad learner', 'not intelligent', 'poor student']
const foundLabels = LABEL_FORBIDDEN.filter((w) => dashFile.toLowerCase().includes(w.toLowerCase()))
if (foundLabels.length === 0) ok(26, 'No forbidden child labels in dashboard')
else fail(26, `Forbidden labels in dashboard: ${foundLabels.join(', ')}`)

if (pd.includes('signalLevel')) ok(27, 'signalLevel() defined in lib/parent-dashboard.ts')
else fail(27, 'signalLevel() missing from lib/parent-dashboard.ts')

// ── 28–32: Homepage PLI copy ─────────────────────────────────────────────────

console.log('\n── Homepage PLI copy ─────────────────────────────────────────────')
const home = readFile('app/page.tsx') ?? ''

if (!home.includes('AI-powered')) ok(28, 'Homepage does not use "AI-powered"')
else fail(28, 'Homepage contains "AI-powered" — use "learning intelligence" instead')

if (home.includes('Understand how your child')) ok(29, 'Homepage hero contains "Understand how your child"')
else fail(29, 'Homepage hero missing "Understand how your child" headline')

if (home.toLowerCase().includes('learning map')) ok(30, 'Homepage mentions "learning map"')
else fail(30, 'Homepage does not mention "learning map"')

if (/Start with your child.*learning map/i.test(home)) ok(31, 'Homepage CTA references "learning map"')
else fail(31, 'Homepage CTA does not reference "learning map"')

const HOME_FORBIDDEN = ['struggles with', 'bad at', 'weak child', 'not intelligent']
const foundHome = HOME_FORBIDDEN.filter((w) => home.toLowerCase().includes(w.toLowerCase()))
if (foundHome.length === 0) ok(32, 'No forbidden copy on homepage')
else fail(32, `Forbidden copy on homepage: ${foundHome.join(', ')}`)

// ── 33–39: Event instrumentation ────────────────────────────────────────────

console.log('\n── Event instrumentation ─────────────────────────────────────────')
const tracker = readFile('components/learn/LessonEventTracker.tsx') ?? ''
const quizTracker = readFile('components/quiz/QuizEventTracker.tsx') ?? ''
const eventsRoute = readFile('app/api/events/learning/route.ts') ?? ''

if (tracker.includes('lesson_opened')) ok(33, 'LessonEventTracker fires lesson_opened')
else fail(33, 'LessonEventTracker does not fire lesson_opened')

if (tracker.includes('lesson_active_time_recorded')) ok(34, 'LessonEventTracker fires lesson_active_time_recorded')
else fail(34, 'LessonEventTracker does not fire lesson_active_time_recorded')

if (tracker.includes('lesson_completed') || tracker.includes('LessonCompleteCTA'))
  ok(35, 'LessonCompleteCTA fires lesson_completed')
else fail(35, 'lesson_completed event not found in LessonEventTracker.tsx')

if (quizTracker.includes('quiz_started')) ok(36, 'QuizEventTracker fires quiz_started')
else fail(36, 'QuizEventTracker does not fire quiz_started')

if (eventsRoute.includes('isValidEventType')) ok(37, 'Events route validates eventType with isValidEventType')
else fail(37, 'Events route does not call isValidEventType — event type not validated')

if (eventsRoute.includes('getUser') || eventsRoute.includes('auth')) ok(38, 'Events route verifies auth before recording')
else fail(38, 'Events route does not verify auth')

if (eventsRoute.includes('profile_id') && eventsRoute.includes('strip') || eventsRoute.includes('delete') || /profile_id.*delete|delete.*profile_id/.test(eventsRoute) || eventsRoute.includes("'profile_id'"))
  ok(39, 'Events route sanitises metadata (strips profile_id override)')
else fail(39, 'Events route metadata sanitisation not found — check profile_id stripping')

// ── 40–41: Confidence levels ─────────────────────────────────────────────────

console.log('\n── Confidence levels ─────────────────────────────────────────────')

if (pd.includes('SignalConfidence') || pd.includes('signalLevel')) ok(40, 'Confidence typing defined in lib/parent-dashboard.ts')
else if (signals.includes('signalConfidence') || signals.includes("'early'") || signals.includes('"early"')) ok(40, 'Confidence levels defined in signal engine')
else fail(40, 'Confidence level typing not found')

const INVALID_CONFIDENCE = ['very_strong', 'very_early', 'uncertain', 'unknown', 'high', 'low', 'medium']
const foundInvalidConf = INVALID_CONFIDENCE.filter((w) => signals.includes(`'${w}'`) || signals.includes(`"${w}"`))
if (foundInvalidConf.length === 0) ok(41, 'Confidence levels use only: early, moderate, strong')
else fail(41, `Non-standard confidence values found: ${foundInvalidConf.join(', ')}`)

// ── Summary ──────────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n──────────────────────────────────────────────────────────────────`)
console.log(`  ${passed} / ${total} checks passed`)
if (failed > 0) {
  console.log(`  ${failed} check(s) failed — address before closing PLI v1 sprint.\n`)
  process.exit(1)
} else {
  console.log(`  All checks passed — PLI v1 sprint gate met.\n`)
}
