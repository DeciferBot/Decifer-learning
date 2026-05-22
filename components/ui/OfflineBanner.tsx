'use client'

import { useEffect, useState } from 'react'
import { registerOnlineDrain } from '@/lib/offline'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)

    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    const onSyncStart = () => setSyncing(true)
    const onSyncEnd = () => setSyncing(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('decifer:sync-start', onSyncStart)
    window.addEventListener('decifer:sync-end', onSyncEnd)

    const unregisterDrain = registerOnlineDrain()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('decifer:sync-start', onSyncStart)
      window.removeEventListener('decifer:sync-end', onSyncEnd)
      unregisterDrain()
    }
  }, [])

  if (!offline && !syncing) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white ${
        syncing ? 'bg-maths' : 'bg-muted'
      }`}
    >
      {syncing ? (
        <span>↻ Syncing results…</span>
      ) : (
        <span>Offline — quizzes will sync when you reconnect</span>
      )}
    </div>
  )
}
