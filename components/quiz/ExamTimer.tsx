'use client'

import { useEffect, useState, useRef } from 'react'

interface Props {
  timeLimitMinutes: number
  onExpire: () => void
}

export function ExamTimer({ timeLimitMinutes, onExpire }: Props) {
  const totalSeconds = timeLimitMinutes * 60
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const expiredRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!expiredRef.current) {
            expiredRef.current = true
            onExpire()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onExpire])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const critical = secondsLeft <= 300 // < 5 minutes

  return (
    <div
      aria-live="polite"
      aria-label={`Time remaining: ${minutes} minutes ${seconds} seconds`}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums transition-colors ${
        critical
          ? 'bg-incorrect/10 text-incorrect'
          : 'bg-black/[0.05] text-ink'
      }`}
    >
      {critical && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-incorrect" aria-hidden />
      )}
      {label}
    </div>
  )
}
