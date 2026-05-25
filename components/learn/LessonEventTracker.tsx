'use client'

import { useEffect, useRef } from 'react'

interface LessonEventTrackerProps {
  topicId: string
  lessonId: string
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
    // Non-blocking: event tracking must never break the lesson experience
  }
}

/**
 * Fires lesson_opened on mount and lesson_active_time_recorded on unmount.
 * No UI rendered — purely behavioural.
 */
export function LessonEventTracker({ topicId, lessonId, subjectId }: LessonEventTrackerProps) {
  const startedAtRef = useRef<number>(Date.now())
  const firedOpenRef = useRef(false)

  useEffect(() => {
    if (firedOpenRef.current) return
    firedOpenRef.current = true
    startedAtRef.current = Date.now()

    void postEvent({
      eventType: 'lesson_opened',
      topicId,
      lessonId,
      subjectId: subjectId ?? null,
    })

    return () => {
      const seconds = Math.round((Date.now() - startedAtRef.current) / 1000)
      if (seconds < 5) return // ignore accidental navigations
      void postEvent({
        eventType: 'lesson_active_time_recorded',
        topicId,
        lessonId,
        subjectId: subjectId ?? null,
        metadata: { seconds },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

interface LessonCompleteCTAProps {
  href: string
  topicId: string
  lessonId: string
  subjectId?: string | null
  children: React.ReactNode
  className?: string
}

/**
 * Wraps the "Start Practising" / "Start Quiz" CTA.
 * Records lesson_completed before navigating.
 */
export function LessonCompleteCTA({
  href,
  topicId,
  lessonId,
  subjectId,
  children,
  className,
}: LessonCompleteCTAProps) {
  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    await postEvent({
      eventType: 'lesson_completed',
      topicId,
      lessonId,
      subjectId: subjectId ?? null,
    })
    window.location.href = href
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
