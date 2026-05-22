import { openDB } from 'idb'

const DB = 'decifer-offline'
const STORE = 'pending-answers'

type PendingItem = {
  url: string
  body: string
  queuedAt: number
}

function getDB() {
  return openDB(DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { autoIncrement: true })
      }
    },
  })
}

export async function queueSubmit(url: string, body: object): Promise<void> {
  const db = await getDB()
  await db.add(STORE, { url, body: JSON.stringify(body), queuedAt: Date.now() } as PendingItem)
}

export async function drainQueue(): Promise<void> {
  const db = await getDB()
  const keys = await db.getAllKeys(STORE)
  if (keys.length === 0) return

  window.dispatchEvent(new Event('decifer:sync-start'))

  for (const key of keys) {
    const item = (await db.get(STORE, key)) as PendingItem | undefined
    if (!item) continue
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: item.body,
      })
      if (res.ok) await db.delete(STORE, key)
    } catch {
      // leave in queue; retry on next online event
    }
  }

  window.dispatchEvent(new Event('decifer:sync-end'))
}

export async function submitAnswer(url: string, body: object): Promise<Response | null> {
  if (!navigator.onLine) {
    await queueSubmit(url, body)
    return null
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res
    // Non-2xx — queue for retry
    await queueSubmit(url, body)
    return null
  } catch {
    await queueSubmit(url, body)
    return null
  }
}

export function registerOnlineDrain(): () => void {
  const handler = () => { drainQueue() }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
