'use client'

import { useState } from 'react'

export function NewParentLinkNotice({ parentName }: { parentName: string }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    fetch('/api/family/mark-link-seen', { method: 'POST' }).catch(() => {})
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-maths/30 bg-maths/10 px-4 py-3">
      <span className="mt-0.5 text-xl" aria-hidden>🔗</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">
          {parentName} can now see your progress
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Your account has been linked to {parentName}&apos;s parent account.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-muted transition hover:text-ink"
      >
        ✕
      </button>
    </div>
  )
}
