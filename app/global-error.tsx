'use client'

// App-wide backstop error boundary. Replaces Next's bare "Application error: a
// client-side exception has occurred" screen. global-error renders in place of
// the root layout, so it must ship its own <html>/<body> and inline styles
// (global CSS / Tailwind are not guaranteed here).
//
// Stale-client chunk failures self-heal with a cache-clearing reload; anything
// else gets a calm, on-brand retry.

import { useEffect, useState } from 'react'
import { recoverFromChunkError } from '@/lib/client-recovery'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [recovering, setRecovering] = useState(true)

  useEffect(() => {
    if (!recoverFromChunkError(error)) setRecovering(false)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: '#FAFBFF',
          color: '#2D3748',
          fontFamily:
            "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {recovering ? (
          <>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '3px solid rgba(45,55,72,0.15)',
                borderTopColor: '#6C9EFF',
                animation: 'decifer-spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontSize: 14, color: '#718096', margin: 0 }}>
              Updating to the latest version…
            </p>
            <style>{'@keyframes decifer-spin{to{transform:rotate(360deg)}}'}</style>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🌱</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#718096', maxWidth: 320, margin: 0 }}>
              Sorry about that. Let’s try loading the page again.
            </p>
            <button
              onClick={() => { setRecovering(true); reset() }}
              style={{
                marginTop: 8,
                minHeight: 48,
                padding: '0 28px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)',
              }}
            >
              Try again
            </button>
          </>
        )}
      </body>
    </html>
  )
}
