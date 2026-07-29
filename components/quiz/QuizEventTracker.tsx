'use client'

import { useEffect, useRef } from 'react'
import { postQuizEvent } from './quiz-events'

interface QuizEventTrackerProps {
  topicId: string
  subjectId?: string | null
}

/**
 * Fires quiz_started on mount.
 *
 * Note this counts page views, not attempts: a reload or a look at the
 * difficulty picker both produce one. The events that say what the child
 * actually did are quiz_first_answer and quiz_abandoned, both fired from
 * QuizShell, and quiz_completed, recorded server-side in POST /api/quiz/submit.
 */
export function QuizEventTracker({ topicId, subjectId }: QuizEventTrackerProps) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    void postQuizEvent({
      eventType: 'quiz_started',
      topicId,
      subjectId: subjectId ?? null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
