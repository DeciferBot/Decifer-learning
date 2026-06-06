export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

type OakLesson = {
  lessonSlug: string
  lessonTitle: string
  pupilLessonOutcome?: string
}

type OakLessonGroup = {
  lessons?: OakLesson[]
}

type OakSummary = {
  keyLearningPoints?: Array<{ keyLearningPoint: string }>
  keywords?: Array<{ keyword: string; description: string }>
  misconceptions?: Array<{ misconception: string; response: string }>
}

async function oakFetch(path: string): Promise<unknown> {
  const key = process.env.OAK_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://open-api.thenational.academy/api/v0${path}`, {
      headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Decifer-Learning/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function fetchUnitLessons(oakUnitSlug: string): Promise<OakLesson[]> {
  // oak_unit_slug format: "history/ks3/year-7/{unit-slug}"
  const parts = oakUnitSlug.split('/')
  if (parts.length < 4) return []
  const [subjectSlug, keyStage, , unitSlug] = parts

  const data = await oakFetch(
    `/key-stages/${keyStage}/subject/${subjectSlug}/lessons?unit=${encodeURIComponent(unitSlug)}`
  ) as OakLessonGroup[] | null

  if (!Array.isArray(data)) return []
  const lessons: OakLesson[] = []
  for (const group of data) {
    if (group.lessons) lessons.push(...group.lessons)
  }
  return lessons
}

async function fetchLessonSummary(lessonSlug: string): Promise<OakSummary | null> {
  return oakFetch(`/lessons/${lessonSlug}/summary`) as Promise<OakSummary | null>
}

export async function generateMetadata({ params }: { params: { id: string; unitId: string } }) {
  const unit = await prisma.curriculumUnit.findUnique({
    where: { id: params.unitId },
    select: { title: true },
  })
  return { title: unit ? `${unit.title} — Decifer Learning` : 'Chapter — Decifer Learning' }
}

export default async function ChapterPage({
  params,
}: {
  params: { id: string; unitId: string }
}) {
  const [unit, topicRow] = await Promise.all([
    prisma.curriculumUnit.findUnique({
      where: { id: params.unitId, topic_id: params.id },
      select: { id: true, title: true, description: true, oak_unit_slug: true, order_index: true },
    }),
    prisma.topic.findUnique({
      where: { id: params.id },
      select: {
        title: true,
        subject: { select: { colour_token: true, name: true, slug: true } },
      },
    }),
  ])

  if (!unit || !topicRow) notFound()

  const subjectColor = topicRow.subject?.colour_token ?? '#6C9EFF'

  // Fetch Oak NA lessons for this unit
  const lessons = unit.oak_unit_slug
    ? await fetchUnitLessons(unit.oak_unit_slug)
    : []

  // Fetch summaries for up to 6 lessons (to keep load reasonable)
  const summaries: Array<{ lesson: OakLesson; summary: OakSummary | null }> = []
  for (const lesson of lessons.slice(0, 6)) {
    const summary = await fetchLessonSummary(lesson.lessonSlug)
    summaries.push({ lesson, summary })
  }

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted flex-wrap" aria-label="breadcrumb">
        <Link href="/dashboard/child" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        {topicRow.subject?.name && (
          <>
            <span>{topicRow.subject.name}</span>
            <span aria-hidden>/</span>
          </>
        )}
        <Link href={`/topics/${params.id}/learn`} className="hover:text-ink">{topicRow.title}</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{unit.title}</span>
      </nav>

      <div
        className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm"
        style={{ borderLeft: `4px solid ${subjectColor}` }}
      >
        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: subjectColor }}>
          Chapter {unit.order_index + 1}
        </p>
        <h1 className="font-heading text-xl font-bold text-ink">{unit.title}</h1>
        {unit.description && (
          <p className="mt-1 text-sm text-muted italic">{unit.description}</p>
        )}
      </div>

      {summaries.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center">
          <p className="text-muted text-sm">Lesson content for this chapter is loading — check back soon.</p>
        </div>
      )}

      {summaries.map(({ lesson, summary }, i) => (
        <div key={lesson.lessonSlug} className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">Lesson {i + 1}</p>
            <h2 className="font-heading text-lg font-bold text-ink">{lesson.lessonTitle}</h2>
            {lesson.pupilLessonOutcome && (
              <p className="mt-1 text-sm text-muted">{lesson.pupilLessonOutcome}</p>
            )}
          </div>

          {summary?.keyLearningPoints && summary.keyLearningPoints.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Key Learning Points</h3>
              <ul className="space-y-1">
                {summary.keyLearningPoints.map((kp, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-ink">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: subjectColor }}
                      aria-hidden
                    />
                    {kp.keyLearningPoint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary?.keywords && summary.keywords.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Key Vocabulary</h3>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {summary.keywords.slice(0, 8).map((kw) => (
                  <div key={kw.keyword} className="rounded-xl bg-black/5 px-3 py-2">
                    <dt className="text-xs font-bold text-ink">{kw.keyword}</dt>
                    <dd className="text-xs text-muted mt-0.5">{kw.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {summary?.misconceptions && summary.misconceptions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Common Misconceptions</h3>
              <ul className="space-y-2">
                {summary.misconceptions.slice(0, 3).map((m, j) => (
                  <li key={j} className="rounded-xl bg-incorrect/10 px-3 py-2 text-sm">
                    <p className="font-medium text-ink">{m.misconception}</p>
                    <p className="text-muted mt-0.5">{m.response}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-between">
        <Link
          href={`/topics/${params.id}/learn`}
          className="inline-flex min-h-[48px] items-center rounded-xl border border-black/10 bg-surface px-5 py-3 text-sm font-bold text-ink shadow-sm"
        >
          ← Back to topic
        </Link>
        <Link
          href={`/topics/${params.id}/quiz`}
          className="inline-flex min-h-[48px] items-center rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: subjectColor }}
        >
          Take Quiz →
        </Link>
      </div>
    </div>
  )
}
