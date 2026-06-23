// Decifer Live — question selection + answer helpers.
// Live is a tap-the-tile format (Kahoot), so we only use questions that have a
// clean multiple-choice shape: a correct_answer plus distractors, and NOT one of
// the multipart types that render their own bespoke UI. Everything reads
// status='published' only (CLAUDE.md §8).

import { prisma } from '@/lib/prisma'

// Types that render their own multi-part UI in QuizShell — unfit for tap-tiles.
const MULTIPART_TYPES = new Set([
  'true_false_grid',
  'ordered_list',
  'source_analysis',
  'explain_example',
  'structured_answer',
])

// How many answer tiles a Live question shows (1 correct + up to 3 distractors).
export const LIVE_MAX_CHOICES = 4

export function normalizeAnswer(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

export type LiveQuestionRow = {
  id: string
  tier: string
  question_text: string
  correct_answer: string
  distractors: string[]
}

type SelectArgs = {
  mode: 'topic' | 'subject'
  topicId?: string | null
  subjectId?: string | null
  yearGroupId?: string | null
  count: number
}

// Returns up to `count` published, tap-tile-friendly questions for the chosen
// scope. Single-topic pulls that topic; mixed-subject pulls across every
// published topic in the subject + year group. Rows are shuffled so each game
// is fresh; the caller persists only the ordered IDs.
export async function selectLiveQuestions(args: SelectArgs): Promise<LiveQuestionRow[]> {
  const { mode, topicId, subjectId, yearGroupId, count } = args

  let topicIds: string[]
  if (mode === 'topic') {
    if (!topicId) return []
    topicIds = [topicId]
  } else {
    if (!subjectId) return []
    const topics = await prisma.topic.findMany({
      where: {
        subject_id: subjectId,
        is_published: true,
        ...(yearGroupId ? { year_group_id: yearGroupId } : {}),
      },
      select: { id: true },
    })
    topicIds = topics.map((t) => t.id)
  }
  if (topicIds.length === 0) return []

  const rows = await prisma.quizQuestion.findMany({
    where: {
      topic_id: { in: topicIds },
      status: 'published',
      question_type: { notIn: [...MULTIPART_TYPES] },
    },
    select: {
      id: true,
      tier: true,
      question_text: true,
      correct_answer: true,
      distractors: true,
    },
  })

  // Keep only rows with a usable set of distractors (a real choice question).
  const usable: LiveQuestionRow[] = rows
    .filter((r) => Array.isArray(r.distractors) && (r.distractors as unknown[]).length >= 1)
    .map((r) => ({
      id: r.id,
      tier: String(r.tier),
      question_text: r.question_text,
      correct_answer: r.correct_answer,
      distractors: (r.distractors as string[]).filter((d) => typeof d === 'string'),
    }))

  return shuffle(usable).slice(0, count)
}

// Fisher–Yates with an optional integer seed for deterministic ordering
// (used so every device renders the same tile layout for a question).
export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr]
  let rand: () => number
  if (seed === undefined) {
    rand = Math.random
  } else {
    // Mulberry32 — small deterministic PRNG.
    let s = seed >>> 0
    rand = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Deterministic seed from a game id + question index, so a question's tile order
// is identical on every device but varies across questions and games.
export function choiceSeed(gameId: string, index: number): number {
  let h = 2166136261
  const key = `${gameId}:${index}`
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Build the shuffled choice list shown to players for a question. The correct
// answer's position is deterministic per (game, index) but not leaked as such.
export function buildChoices(correct: string, distractors: string[], seed: number): string[] {
  const pool = [correct, ...distractors].slice(0, LIVE_MAX_CHOICES)
  return shuffle(pool, seed)
}
