'use client'

import { useEffect, useRef } from 'react'

interface QuizEventTrackerProps {
  topicId: string
  subjectId?: string | null
}

async function postEvent(body: Record<string, unknown>) {
  try {
    await fetch('/api/events/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Non-blocking
  }
}

/**
 * Fires quiz_started on mount.
 * quiz_completed is recorded server-side in POST /api/quiz/submit.
 *
 * TODO (PLI v2): detect quiz_abandoned when user navigates away before submitting.
 * This requires tracking quiz start time client-side and comparing against submission
 * records. Needs reliable detection before implementing — not faked in v1.
 */
export function QuizEventTracker({ topicId, subjectId }: QuizEventTrackerProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    void postEvent({
      eventType: 'quiz_started',
      topicId,
      subjectId: subjectId ?? null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
