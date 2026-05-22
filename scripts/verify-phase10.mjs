#!/usr/bin/env node
/**
 * Phase 10 — PWA & Offline verification
 * Run: node --env-file=.env.local scripts/verify-phase10.mjs
 * All checks are static (no DB required).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '..')
const pass = (msg) => console.log(`  ✅ ${msg}`)
const fail = (msg) => { console.error(`  ❌ ${msg}`); failures++ }
let failures = 0

function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8') }
function exists(rel) { return existsSync(resolve(ROOT, rel)) }

console.log('\n── Phase 10: PWA & Offline ─────────────────────────────────────\n')

// 1. manifest.json structure
console.log('1. manifest.json')
const manifest = JSON.parse(read('public/manifest.json'))
manifest.name === 'Decifer Learning' ? pass('name = "Decifer Learning"') : fail(`name = "${manifest.name}"`)
manifest.short_name === 'Decifer'    ? pass('short_name = "Decifer"')    : fail(`short_name = "${manifest.short_name}" (expected "Decifer")`)
manifest.display === 'standalone'    ? pass('display = "standalone"')    : fail(`display = "${manifest.display}"`)
manifest.background_color === '#FAFBFF' ? pass('background_color correct') : fail('background_color wrong')
manifest.theme_color === '#6C9EFF'   ? pass('theme_color correct')       : fail('theme_color wrong')
manifest.icons?.length >= 2          ? pass(`${manifest.icons.length} icons declared`) : fail('fewer than 2 icons')

// 2. Icons exist
console.log('\n2. PWA icons')
exists('public/icon-192.png') ? pass('icon-192.png present') : fail('icon-192.png missing')
exists('public/icon-512.png') ? pass('icon-512.png present') : fail('icon-512.png missing')

// 3. next-pwa configured
console.log('\n3. next-pwa config')
const nextConfig = read('next.config.js')
nextConfig.includes('next-pwa')        ? pass('next-pwa imported in next.config.js') : fail('next-pwa missing from next.config.js')
nextConfig.includes("dest: 'public'")  ? pass("dest: 'public'")                      : fail("dest: 'public' missing")
nextConfig.includes('skipWaiting')     ? pass('skipWaiting: true')                   : fail('skipWaiting missing')

// 4. lib/offline.ts exports
console.log('\n4. lib/offline.ts')
exists('lib/offline.ts') ? pass('offline.ts exists') : fail('offline.ts missing')
const offline = read('lib/offline.ts')
offline.includes("from 'idb'")              ? pass("imports from 'idb'")       : fail("missing idb import")
offline.includes('export async function queueSubmit')    ? pass('exports queueSubmit')    : fail('missing queueSubmit export')
offline.includes('export async function drainQueue')     ? pass('exports drainQueue')     : fail('missing drainQueue export')
offline.includes('export async function submitAnswer')   ? pass('exports submitAnswer')   : fail('missing submitAnswer export')
offline.includes('export function registerOnlineDrain')  ? pass('exports registerOnlineDrain') : fail('missing registerOnlineDrain export')
offline.includes("'online'")           ? pass("registers 'online' listener")  : fail("missing 'online' event registration")
offline.includes('navigator.onLine')   ? pass('checks navigator.onLine')       : fail('missing navigator.onLine check')
offline.includes("'decifer:sync-start'") ? pass("dispatches 'decifer:sync-start'") : fail("missing decifer:sync-start event")
offline.includes("'decifer:sync-end'")   ? pass("dispatches 'decifer:sync-end'")   : fail("missing decifer:sync-end event")

// 5. OfflineBanner component
console.log('\n5. OfflineBanner component')
exists('components/ui/OfflineBanner.tsx') ? pass('OfflineBanner.tsx exists') : fail('OfflineBanner.tsx missing')
const banner = read('components/ui/OfflineBanner.tsx')
banner.includes("'use client'")              ? pass("'use client' directive")          : fail("missing 'use client'")
banner.includes('registerOnlineDrain')       ? pass('calls registerOnlineDrain')       : fail('missing registerOnlineDrain call')
banner.includes('navigator.onLine')          ? pass('checks navigator.onLine')         : fail('missing navigator.onLine check')
banner.includes("'decifer:sync-start'")      ? pass("listens to 'decifer:sync-start'") : fail("missing decifer:sync-start listener")
banner.includes("'decifer:sync-end'")        ? pass("listens to 'decifer:sync-end'")   : fail("missing decifer:sync-end listener")
banner.includes('Syncing results')           ? pass("shows 'Syncing results…' text")   : fail("missing syncing text")
banner.includes('Offline')                   ? pass("shows offline text")               : fail("missing offline text")
banner.includes('aria-live')                 ? pass('aria-live present (accessible)')   : fail('aria-live missing')

// 6. Root layout includes OfflineBanner
console.log('\n6. app/layout.tsx')
const layout = read('app/layout.tsx')
layout.includes('OfflineBanner') ? pass('OfflineBanner imported + used in layout') : fail('OfflineBanner missing from layout')
layout.includes('apple-mobile-web-app-capable') || layout.includes('appleWebApp')
  ? pass('iOS PWA meta tags present') : fail('iOS PWA meta tags missing')
layout.includes("manifest: '/manifest.json'") || layout.includes('manifest.json')
  ? pass('manifest linked in metadata') : fail('manifest not linked in metadata')

// 7. QuizShell uses submitAnswer
console.log('\n7. QuizShell.tsx offline integration')
const shell = read('components/quiz/QuizShell.tsx')
shell.includes("from '@/lib/offline'")       ? pass("imports from '@/lib/offline'")     : fail("missing '@/lib/offline' import")
shell.includes('submitAnswer(')              ? pass('calls submitAnswer()')              : fail('submitAnswer not called')
shell.includes('submittedOffline')           ? pass('submittedOffline state exists')     : fail('submittedOffline state missing')
shell.includes('Saved offline')              ? pass("shows 'Saved offline' message")     : fail("missing 'Saved offline' message")
!shell.includes("fetch(submitUrl,")          ? pass('no bare fetch(submitUrl, …)')       : fail('bare fetch(submitUrl, …) still present — not replaced')

// 8. Dependencies
console.log('\n8. Dependencies')
const pkg = JSON.parse(read('package.json'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
deps['idb']      ? pass(`idb ${deps['idb']}`)           : fail('idb missing from package.json')
deps['next-pwa'] ? pass(`next-pwa ${deps['next-pwa']}`) : fail('next-pwa missing from package.json')

// ── Summary ───────────────────────────────────────────────────────────────
const total = 40
console.log(`\n── Result: ${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILED`} ───────────────────────────────────────\n`)
if (failures > 0) process.exit(1)
