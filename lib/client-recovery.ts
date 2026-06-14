'use client'

// Self-healing for stale-client crashes.
//
// After a deploy, a browser (or installed PWA) that still holds an old app
// shell can request a JS route chunk whose hash no longer exists on the CDN.
// Next.js surfaces that as a ChunkLoadError / "Failed to fetch dynamically
// imported module", which — with no error boundary — renders the bare
// "Application error: a client-side exception has occurred" screen. The page is
// not actually broken; the client is simply stale. A full reload pulls a fresh
// build manifest with the correct chunk hashes and fixes it.
//
// Used by the route error boundaries (app/global-error.tsx,
// app/(child)/explore/error.tsx) to recover automatically instead of dead-ending.

const RELOAD_GUARD_KEY = 'decifer-chunk-recovery-ts'
// Only auto-reload once per short window, so a genuinely persistent error never
// becomes a reload loop.
const RELOAD_WINDOW_MS = 30_000

/** True when an error looks like a stale-bundle / dynamic-import failure. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const name = (error as { name?: string }).name ?? ''
  const message = (error as { message?: string }).message ?? ''
  const haystack = `${name} ${message}`.toLowerCase()
  return (
    name === 'ChunkLoadError' ||
    haystack.includes('loading chunk') ||
    haystack.includes('loading css chunk') ||
    haystack.includes('failed to fetch dynamically imported module') ||
    haystack.includes('error loading dynamically imported module') ||
    haystack.includes('importing a module script failed')
  )
}

/** Drop service workers + Cache Storage so the next load comes fresh from origin. */
export async function clearClientCaches(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* best effort */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* best effort */
  }
}

/**
 * If `error` is a stale-bundle failure, clear caches and hard-reload once.
 * Returns true if a recovery reload was triggered (caller should render a
 * minimal "reloading" state); false if it should show a manual retry instead.
 */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (!isChunkLoadError(error)) return false

  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
  } catch {
    /* sessionStorage may be unavailable (private mode) */
  }
  // Already tried very recently — don't loop; let the boundary show manual retry.
  if (last && Date.now() - last < RELOAD_WINDOW_MS) return false

  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }

  void clearClientCaches().finally(() => {
    window.location.reload()
  })
  return true
}
