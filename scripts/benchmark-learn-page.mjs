/**
 * Benchmark: serial vs parallel Supabase round-trips
 * Simulates the exact query pattern in learn/page.tsx and adaptive.ts
 * Run: node scripts/benchmark-learn-page.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env vars from .env.local
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Known published topic IDs (from direct DB query)
const topicId = 'f331f4b7-463d-47be-8730-ea549527849a' // Algebra: Solving Linear Equations
console.log(`\nUsing topic: ${topicId} (Algebra: Solving Linear Equations)\n`)

const RUNS = 5

// ─── BEFORE: Learn page serial pattern ────────────────────────────────────
console.log('━━━ BEFORE: Learn page (serial round-trips) ━━━')
const serialTimes = []
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now()

  // Round-trip 1: fetch topic
  await supabase.from('topics').select('id, title, subject_id, pedagogy_mode, quiz_optional').eq('id', topicId).eq('is_published', true).maybeSingle()

  // Round-trip 2: auth.getUser (simulate ~same cost as a Supabase REST call)
  await supabase.auth.getSession()

  // Round-trip 3: fetch content (after topic check)
  await supabase.from('learn_content').select('id, body_html, learn_widgets').eq('topic_id', topicId).eq('status', 'published').maybeSingle()

  // Round-trip 4: fetch practice_games (after content check)
  await supabase.from('practice_games').select('id').eq('topic_id', topicId).eq('status', 'published').maybeSingle()

  const elapsed = performance.now() - t0
  serialTimes.push(elapsed)
  process.stdout.write(`  run ${i+1}: ${elapsed.toFixed(0)}ms\n`)
}
const serialAvg = serialTimes.reduce((a,b)=>a+b,0)/RUNS
console.log(`  AVERAGE: ${serialAvg.toFixed(0)}ms  (${RUNS} runs, 4 sequential round-trips)\n`)

// ─── AFTER: Learn page parallel pattern ───────────────────────────────────
console.log('━━━ AFTER: Learn page (parallel round-trips) ━━━')
const parallelTimes = []
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now()

  // All 4 calls fire at the same time
  await Promise.all([
    supabase.from('topics').select('id, title, subject_id, pedagogy_mode, quiz_optional').eq('id', topicId).eq('is_published', true).maybeSingle(),
    supabase.auth.getSession(),
    supabase.from('learn_content').select('id, body_html, learn_widgets').eq('topic_id', topicId).eq('status', 'published').maybeSingle(),
    supabase.from('practice_games').select('id').eq('topic_id', topicId).eq('status', 'published').maybeSingle(),
  ])

  const elapsed = performance.now() - t0
  parallelTimes.push(elapsed)
  process.stdout.write(`  run ${i+1}: ${elapsed.toFixed(0)}ms\n`)
}
const parallelAvg = parallelTimes.reduce((a,b)=>a+b,0)/RUNS
console.log(`  AVERAGE: ${parallelAvg.toFixed(0)}ms  (${RUNS} runs, 4 parallel round-trips)\n`)

// ─── BEFORE: adaptive.ts — 4 serial queries (attempts×2 + answers×2) ──────
console.log('━━━ BEFORE: adaptive.ts (4 serial queries for history) ━━━')
const adaptiveSerialTimes = []
for (let i = 0; i < RUNS; i++) {
  const fakeProfileId = '00000000-0000-0000-0000-000000000000'
  const t0 = performance.now()

  // getRecentlySeenIds: query 1
  const { data: attempts1 } = await supabase.from('quiz_attempts').select('id').eq('profile_id', fakeProfileId).eq('topic_id', topicId).order('created_at', { ascending: false }).limit(2)
  const ids1 = attempts1?.map(a => a.id) ?? []

  // getRecentlySeenIds: query 2
  if (ids1.length) await supabase.from('quiz_answers').select('question_id').in('attempt_id', ids1)

  // getMistakeIds: query 3 (same attempt query repeated!)
  const { data: attempts2 } = await supabase.from('quiz_attempts').select('id').eq('profile_id', fakeProfileId).eq('topic_id', topicId).order('created_at', { ascending: false }).limit(3)
  const ids2 = attempts2?.map(a => a.id) ?? []

  // getMistakeIds: query 4
  if (ids2.length) await supabase.from('quiz_answers').select('question_id').in('attempt_id', ids2).eq('was_correct', false)

  const elapsed = performance.now() - t0
  adaptiveSerialTimes.push(elapsed)
  process.stdout.write(`  run ${i+1}: ${elapsed.toFixed(0)}ms\n`)
}
const adaptiveSerialAvg = adaptiveSerialTimes.reduce((a,b)=>a+b,0)/RUNS
console.log(`  AVERAGE: ${adaptiveSerialAvg.toFixed(0)}ms  (${RUNS} runs, 4 sequential queries)\n`)

// ─── AFTER: adaptive.ts — 2 parallel queries ──────────────────────────────
console.log('━━━ AFTER: adaptive.ts (2 parallel queries for history) ━━━')
const adaptiveParallelTimes = []
for (let i = 0; i < RUNS; i++) {
  const fakeProfileId = '00000000-0000-0000-0000-000000000000'
  const t0 = performance.now()

  // Single attempts query (shared between seen + mistakes)
  const { data: attempts } = await supabase.from('quiz_attempts').select('id').eq('profile_id', fakeProfileId).eq('topic_id', topicId).order('created_at', { ascending: false }).limit(3)
  const ids = attempts?.map(a => a.id) ?? []

  // Single answers query — filter in JS
  if (ids.length) {
    await supabase.from('quiz_answers').select('question_id, was_correct').in('attempt_id', ids)
  }

  const elapsed = performance.now() - t0
  adaptiveParallelTimes.push(elapsed)
  process.stdout.write(`  run ${i+1}: ${elapsed.toFixed(0)}ms\n`)
}
const adaptiveParallelAvg = adaptiveParallelTimes.reduce((a,b)=>a+b,0)/RUNS
console.log(`  AVERAGE: ${adaptiveParallelAvg.toFixed(0)}ms  (${RUNS} runs, 2 sequential queries)\n`)

// ─── Summary ──────────────────────────────────────────────────────────────
console.log('━━━ SUMMARY ━━━')
console.log(`Learn page:   ${serialAvg.toFixed(0)}ms → ${parallelAvg.toFixed(0)}ms  (saving: ${(serialAvg - parallelAvg).toFixed(0)}ms, ${Math.round((1 - parallelAvg/serialAvg)*100)}% faster)`)
console.log(`Adaptive:     ${adaptiveSerialAvg.toFixed(0)}ms → ${adaptiveParallelAvg.toFixed(0)}ms  (saving: ${(adaptiveSerialAvg - adaptiveParallelAvg).toFixed(0)}ms, ${Math.round((1 - adaptiveParallelAvg/adaptiveSerialAvg)*100)}% faster)`)
console.log(`Total saving: ~${((serialAvg - parallelAvg) + (adaptiveSerialAvg - adaptiveParallelAvg)).toFixed(0)}ms per quiz session start`)
