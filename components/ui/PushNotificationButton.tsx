'use client'

import { useEffect, useState } from 'react'
import { Bell } from '@/components/ui/icons'

type State = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'

export function PushNotificationButton() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      setState(existing ? 'subscribed' : 'unsubscribed')
    }).catch(() => setState('unsubscribed'))
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
        ) as unknown as ArrayBuffer,
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      setState('subscribed')
    } catch {
      setState(Notification.permission === 'denied' ? 'denied' : 'unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  if (state === 'unsupported') return null

  if (state === 'denied') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Bell size={14} aria-hidden /> Notifications blocked — enable in browser settings
      </p>
    )
  }

  if (state === 'loading') {
    return (
      <button disabled className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-muted opacity-50">
        <Bell size={16} aria-hidden /> …
      </button>
    )
  }

  if (state === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 bg-maths/10 px-3 py-2 text-sm font-medium text-maths transition-colors hover:bg-maths/20"
        aria-label="Turn off streak notifications"
      >
        <Bell size={16} aria-hidden /> Streak alerts on
      </button>
    )
  }

  return (
    <button
      onClick={subscribe}
      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-black/5"
      aria-label="Turn on streak notifications"
    >
      <Bell size={16} aria-hidden /> Get streak alerts
    </button>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
