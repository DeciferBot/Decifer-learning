/**
 * Offline answer-queue tests — guards lib/offline.ts, the IndexedDB safety net
 * that stops a child losing quiz work when an iPad drops connectivity
 * (CLAUDE.md §13 / Phase 10).
 *
 * Contract:
 *   - Online + 2xx  → submit directly, nothing queued.
 *   - Offline       → queue, return null, no fetch attempted.
 *   - Online + non-2xx / network error → queue for retry, return null.
 *   - drainQueue    → replays queued items in order, deletes on success,
 *                     keeps them on failure, and brackets work with sync events.
 *
 * `idb` is mocked with an in-memory store; browser globals are stubbed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── In-memory idb mock ──────────────────────────────────────────────────────

interface MemStore {
  data: Map<number, unknown>
  seq: number
}
const stores = new Map<string, MemStore>()

vi.mock('idb', () => ({
  openDB: async (_name: string, _v: number, _opts?: unknown) => {
    const key = 'pending-answers'
    if (!stores.has(key)) stores.set(key, { data: new Map(), seq: 0 })
    const s = stores.get(key)!
    return {
      add: async (_store: string, value: unknown) => {
        const id = ++s.seq
        s.data.set(id, value)
        return id
      },
      getAllKeys: async () => Array.from(s.data.keys()),
      get: async (_store: string, k: number) => s.data.get(k),
      delete: async (_store: string, k: number) => {
        s.data.delete(k)
      },
    }
  },
}))

// Import AFTER the mock is registered.
import { submitAnswer, drainQueue, queueSubmit } from '../lib/offline'

// ── Browser-global stubs ────────────────────────────────────────────────────

const dispatched: string[] = []

function setOnline(online: boolean) {
  vi.stubGlobal('navigator', { onLine: online })
}

beforeEach(() => {
  stores.clear()
  dispatched.length = 0
  setOnline(true)
  vi.stubGlobal('window', {
    dispatchEvent: (e: Event) => {
      dispatched.push(e.type)
      return true
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  vi.stubGlobal('Event', class { type: string; constructor(t: string) { this.type = t } } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function pendingCount() {
  return stores.get('pending-answers')?.data.size ?? 0
}

// ── submitAnswer ────────────────────────────────────────────────────────────

describe('submitAnswer', () => {
  it('submits directly and queues nothing when online and the server returns 2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const res = await submitAnswer('/api/quiz/submit', { score: 100 })
    expect(res).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(pendingCount()).toBe(0)
  })

  it('queues without attempting a network call when offline', async () => {
    setOnline(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await submitAnswer('/api/quiz/submit', { score: 100 })
    expect(res).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(pendingCount()).toBe(1)
  })

  it('queues for retry when the server responds non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const res = await submitAnswer('/api/quiz/submit', { score: 100 })
    expect(res).toBeNull()
    expect(pendingCount()).toBe(1)
  })

  it('queues for retry when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const res = await submitAnswer('/api/quiz/submit', { score: 100 })
    expect(res).toBeNull()
    expect(pendingCount()).toBe(1)
  })
})

// ── drainQueue ──────────────────────────────────────────────────────────────

describe('drainQueue', () => {
  it('replays every queued item and clears them on success', async () => {
    await queueSubmit('/api/quiz/submit', { n: 1 })
    await queueSubmit('/api/quiz/submit', { n: 2 })
    expect(pendingCount()).toBe(2)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await drainQueue()

    expect(pendingCount()).toBe(0)
  })

  it('replays queued items in FIFO order', async () => {
    await queueSubmit('/api/quiz/submit', { n: 1 })
    await queueSubmit('/api/quiz/submit', { n: 2 })
    await queueSubmit('/api/quiz/submit', { n: 3 })

    const seen: number[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      seen.push(JSON.parse(init.body).n)
      return { ok: true }
    }))

    await drainQueue()
    expect(seen).toEqual([1, 2, 3])
  })

  it('keeps items in the queue when replay fails (so nothing is lost)', async () => {
    await queueSubmit('/api/quiz/submit', { n: 1 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await drainQueue()
    expect(pendingCount()).toBe(1)
  })

  it('keeps items when the network throws mid-drain', async () => {
    await queueSubmit('/api/quiz/submit', { n: 1 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('still offline')))
    await drainQueue()
    expect(pendingCount()).toBe(1)
  })

  it('brackets a non-empty drain with sync-start and sync-end events', async () => {
    await queueSubmit('/api/quiz/submit', { n: 1 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await drainQueue()
    expect(dispatched).toContain('decifer:sync-start')
    expect(dispatched).toContain('decifer:sync-end')
  })

  it('does nothing (and emits no events) when the queue is empty', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await drainQueue()
    expect(dispatched).toEqual([])
  })
})
