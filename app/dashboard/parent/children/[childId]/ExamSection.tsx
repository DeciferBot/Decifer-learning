'use client'

import { useState } from 'react'
import { SetExamModal } from '@/components/parent/SetExamModal'
import { ExamResultCard } from '@/components/parent/ExamResultCard'
import { ClipboardList } from '@/components/ui/icons'

type Subject = { id: string; name: string; colour_token: string }
type AssignmentRow = {
  id: string
  title: string
  questionCount: number
  timeLimitMinutes: number
  subject: Subject
  attempt: { id: string; score: number | null; status: string; completed_at: string | null } | null
}

interface Props {
  childProfileId: string
  childName: string
  yearGroupId: string | null
  yearGroupLabel: string | null
  subjects: Subject[]
  initialAssignments: AssignmentRow[]
}

export function ExamSection({
  childProfileId,
  childName,
  yearGroupId,
  yearGroupLabel,
  subjects,
  initialAssignments,
}: Props) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>(initialAssignments)
  const [showModal, setShowModal] = useState(false)

  function handleSuccess() {
    setShowModal(false)
    // Refresh assignments list from server
    fetch(`/api/exam/assignments?childId=${childProfileId}`)
      .then((r) => r.json())
      .then((d) => {
        setAssignments(
          (d.assignments ?? []).map((a: {
            id: string
            title: string
            question_count: number
            time_limit_minutes: number
            subject: Subject
            attempts: { id: string; score: number | null; status: string; completed_at: string | null }[]
          }) => ({
            id: a.id,
            title: a.title,
            questionCount: a.question_count,
            timeLimitMinutes: a.time_limit_minutes,
            subject: a.subject,
            attempt: a.attempts[0] ?? null,
          })),
        )
      })
      .catch(() => {})
  }

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-maths" aria-hidden />
            <h2 className="font-heading text-base font-bold text-ink">Exam Revision</h2>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-maths/10 px-4 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20 min-h-[44px]"
          >
            Set exam
          </button>
        </div>

        <p className="text-xs text-muted">
          Assign timed revision exams to {childName}. Each exam is one-shot — {childName} must ask
          you to set a new one for a retry.
        </p>

        {assignments.length === 0 ? (
          <p className="text-sm text-muted">No exams set yet.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <ExamResultCard
                  assignmentId={a.id}
                  title={a.title}
                  questionCount={a.questionCount}
                  timeLimitMinutes={a.timeLimitMinutes}
                  subject={a.subject}
                  attempt={a.attempt}
                  childName={childName}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <SetExamModal
          childProfileId={childProfileId}
          childName={childName}
          subjects={subjects}
          yearGroupId={yearGroupId}
          yearGroupLabel={yearGroupLabel}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
