// Adaptive content selection for quiz and practice modes.
//
// SAFETY CONTRACT:
//   - Only ever selects status='published' content (app-layer + RLS defence-in-depth).
//   - No AI provider is called here. Selection is pure DB queries + in-memory logic.
//   - Small pools fail gracefully with a logged fallback_reason, never an error to children.
//
// See docs/VERIFIED_ADAPTIVE_CONTENT_BANK.md for full architecture rationale.

import { createSupabaseServerClient } from '@/lib/supabase/server'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

export type QuestionTier = 'sprout' | 'explorer' | 'lightning'

export interface AdaptiveQuestion {
  id: string
  tier: QuestionTier
  question_text: string
  question_type: string
  correct_answer: string
  distractors: unknown
  hint_1: string | null
  hint_2: string | null
  hint_3: string | null
  explanation: string | null
  worked_example: string | null
  technique_type: string | null
  technique_hint: string | null
  technique_note: string | null
  answer_parts: unknown
}

export interface SelectionAuditLog {
  mode: 'quiz' | 'practice'
  topic_id: string
  profile_id: string
  content_pool_size: number
  selected_question_ids: string[]
  skipped_recent_count: number
  mistake_review_count: number
  fallback_reason: string | null
  ts: string
}

// ── Utilities ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function logSelection(audit: SelectionAuditLog): void {
  // Structured log — no sensitive personal data beyond IDs required for audit.
  console.log('[adaptive-selection]', JSON.stringify(audit))
}

// ── History queries ───────────────────────────────────────────────────────

async function getRecentlySeenIds(
  supabase: SupabaseClient,
  profileId: string,
  topicId: string,
  lookbackAttempts: number,
): Promise<Set<string>> {
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('profile_id', profileId)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(lookbackAttempts)

  if (!attempts?.length) return new Set()

  const attemptIds = attempts.map((a: { id: string }) => a.id)

  const { data: answers } = await supabase
    .from('quiz_answers')
    .select('question_id')
    .in('attempt_id', attemptIds)

  return new Set(answers?.map((a: { question_id: string }) => a.question_id) ?? [])
}

async function getMistakeIds(
  supabase: SupabaseClient,
  profileId: string,
  topicId: string,
  lookbackAttempts: number,
): Promise<Set<string>> {
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('profile_id', profileId)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(lookbackAttempts)

  if (!attempts?.length) return new Set()

  const attemptIds = attempts.map((a: { id: string }) => a.id)

  const { data: answers } = await supabase
    .from('quiz_answers')
    .select('question_id')
    .in('attempt_id', attemptIds)
    .eq('was_correct', false)

  return new Set(answers?.map((a: { question_id: string }) => a.question_id) ?? [])
}

// ── Tier-balanced selection ───────────────────────────────────────────────
//
// Quiz mix: ~40% sprout (confidence), ~40% explorer (current skill), ~20% lightning (challenge).
// Fills any shortfall from the remaining pool so the target count is always met if pool allows.

function pickWithTierBalance(questions: AdaptiveQuestion[], count: number): AdaptiveQuestion[] {
  const byTier: Record<QuestionTier, AdaptiveQuestion[]> = {
    sprout: shuffle(questions.filter((q) => q.tier === 'sprout')),
    explorer: shuffle(questions.filter((q) => q.tier === 'explorer')),
    lightning: shuffle(questions.filter((q) => q.tier === 'lightning')),
  }

  const targets: Record<QuestionTier, number> = {
    sprout: Math.ceil(count * 0.4),
    explorer: Math.ceil(count * 0.4),
    lightning: Math.floor(count * 0.2),
  }

  const selected: AdaptiveQuestion[] = []
  for (const tier of ['sprout', 'explorer', 'lightning'] as QuestionTier[]) {
    selected.push(...byTier[tier].slice(0, targets[tier]))
  }

  // Fill any shortfall from any remaining questions
  if (selected.length < count) {
    const usedIds = new Set(selected.map((q) => q.id))
    const remaining = shuffle(questions.filter((q) => !usedIds.has(q.id)))
    selected.push(...remaining.slice(0, count - selected.length))
  }

  return shuffle(selected).slice(0, count)
}

// ── Quiz selection ────────────────────────────────────────────────────────

export interface SelectQuizOptions {
  /** Target question count. Default: 10 */
  count?: number
  /** Number of past quiz attempts to treat as "recently seen". Default: 2 */
  lookbackAttempts?: number
}

/**
 * Select quiz questions for a child on a topic.
 *
 * Priority order:
 *   1. Fresh questions (not seen in last `lookbackAttempts` quizzes), tier-balanced.
 *   2. Supplement with recently-seen if fresh pool is insufficient.
 *   3. Use full pool if pool is smaller than count.
 *   4. Return empty array with logged fallback if pool is empty.
 *
 * SAFETY: only reads status='published'. No AI calls.
 */
export async function selectQuizQuestions(
  supabase: SupabaseClient,
  profileId: string,
  topicId: string,
  opts: SelectQuizOptions = {},
): Promise<AdaptiveQuestion[]> {
  const count = opts.count ?? 10
  const lookbackAttempts = opts.lookbackAttempts ?? 2

  // Fetch full published pool — .eq('status','published') is defence-in-depth; RLS enforces too.
  const { data: pool } = await supabase
    .from('quiz_questions')
    .select('id, tier, question_type, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation, worked_example, technique_type, technique_hint, technique_note, answer_parts')
    .eq('topic_id', topicId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  const allQuestions = (pool ?? []) as AdaptiveQuestion[]
  const contentPoolSize = allQuestions.length

  const recentIds = await getRecentlySeenIds(supabase, profileId, topicId, lookbackAttempts)
  const mistakeIds = await getMistakeIds(supabase, profileId, topicId, 3)

  const fresh = allQuestions.filter((q) => !recentIds.has(q.id))
  const seen = allQuestions.filter((q) => recentIds.has(q.id))

  let selected: AdaptiveQuestion[]
  let fallbackReason: string | null = null

  if (fresh.length >= count) {
    // Ideal path: enough fresh questions for a full quiz.
    selected = pickWithTierBalance(fresh, count)
  } else if (allQuestions.length >= count) {
    // Pool is large enough but not all questions are fresh — supplement.
    fallbackReason = `Only ${fresh.length} fresh questions; supplementing with ${count - fresh.length} recently-seen`
    const fromFresh = fresh.length > 0 ? pickWithTierBalance(fresh, fresh.length) : []
    const fromSeen = shuffle(seen).slice(0, count - fromFresh.length)
    selected = shuffle([...fromFresh, ...fromSeen])
  } else if (allQuestions.length > 0) {
    // Pool smaller than desired quiz size — use everything.
    fallbackReason = `Content pool smaller than target (${allQuestions.length}/${count}); using full pool`
    selected = shuffle(allQuestions)
  } else {
    fallbackReason = 'No published questions available for this topic'
    selected = []
  }

  const deduped = deduplicateById(selected)
  const mistakeReviewCount = deduped.filter((q) => mistakeIds.has(q.id)).length
  const skippedRecentCount = recentIds.size - deduped.filter((q) => recentIds.has(q.id)).length

  logSelection({
    mode: 'quiz',
    topic_id: topicId,
    profile_id: profileId,
    content_pool_size: contentPoolSize,
    selected_question_ids: deduped.map((q) => q.id),
    skipped_recent_count: Math.max(0, skippedRecentCount),
    mistake_review_count: mistakeReviewCount,
    fallback_reason: fallbackReason,
    ts: new Date().toISOString(),
  })

  return deduped
}

// ── Within-session interleaving ──────────────────────────────────────────
//
// Research basis: Murray, Horner & Göbel 2025 (Educational Psychology Review)
// Spaced practice g=0.43 in isolated practice contexts — significantly larger
// than the g=0.24 for course-embedded instruction. Within-session interleaving
// across recently-completed topics captures this isolated-practice effect.
//
// Triggers when the child has completed 3+ topics in the same zone.
// Pulls 3-4 questions from each of the most recently completed topics,
// shuffled together into a single mixed quiz.

/**
 * Select an interleaved quiz pulling questions from multiple recently-completed
 * topics in the same zone. Only called when the child has 3+ completed topics.
 *
 * Mix: ~3 questions per topic, shuffled. Total ≤ 12 questions.
 * Falls back to single-topic selection if pool is too small.
 *
 * SAFETY: only reads status='published'. No AI calls.
 */
export async function selectInterleavedQuestions(
  supabase: SupabaseClient,
  profileId: string,
  topicIds: string[],   // up to 3 most recently completed topics
  totalCount = 10,
): Promise<AdaptiveQuestion[]> {
  if (topicIds.length === 0) return []

  const perTopic = Math.ceil(totalCount / topicIds.length)

  // Fetch pools for all topics in parallel
  const pools = await Promise.all(
    topicIds.map(async (topicId) => {
      const { data } = await supabase
        .from('quiz_questions')
        .select('id, tier, question_type, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation, worked_example, technique_type, technique_hint, technique_note, answer_parts')
        .eq('topic_id', topicId)
        .eq('status', 'published')
        .order('created_at', { ascending: true })
      return (data ?? []) as AdaptiveQuestion[]
    }),
  )

  // Get recently seen IDs per topic (avoid repetition)
  const recentSets = await Promise.all(
    topicIds.map((topicId) => getRecentlySeenIds(supabase, profileId, topicId, 1)),
  )

  const selected: AdaptiveQuestion[] = []
  for (let i = 0; i < topicIds.length; i++) {
    const pool = pools[i]
    const recentIds = recentSets[i]
    const fresh = pool.filter((q) => !recentIds.has(q.id))
    const source = fresh.length >= perTopic ? fresh : pool
    const picks = pickWithTierBalance(source, Math.min(perTopic, source.length))
    selected.push(...picks)
  }

  return shuffle(selected).slice(0, totalCount)
}

// ── Practice selection ───────────────────────────────────────────────────

export interface SelectPracticeOptions {
  /** Max items to return. Default: 12 */
  maxItems?: number
  /** Attempts to treat as recently seen. Default: 2 */
  lookbackAttempts?: number
}

export interface PracticeItems {
  questions: AdaptiveQuestion[]
  contentPoolSize: number
  mistakeReviewCount: number
  fallbackReason: string | null
}

/**
 * Select practice items for a child on a topic.
 *
 * Practice mix: 50% current skill (explorer), 20% confidence (sprout),
 *               20% mistake review, 10% challenge (lightning).
 *
 * SAFETY: only reads status='published'. No AI calls.
 */
export async function selectPracticeItems(
  supabase: SupabaseClient,
  profileId: string,
  topicId: string,
  opts: SelectPracticeOptions = {},
): Promise<PracticeItems> {
  const maxItems = opts.maxItems ?? 12
  const lookbackAttempts = opts.lookbackAttempts ?? 2

  const { data: pool } = await supabase
    .from('quiz_questions')
    .select('id, tier, question_type, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation, worked_example, technique_type, technique_hint, technique_note, answer_parts')
    .eq('topic_id', topicId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  const allQuestions = (pool ?? []) as AdaptiveQuestion[]
  const contentPoolSize = allQuestions.length

  const recentIds = await getRecentlySeenIds(supabase, profileId, topicId, lookbackAttempts)
  const mistakeIds = await getMistakeIds(supabase, profileId, topicId, 3)

  const fresh = allQuestions.filter((q) => !recentIds.has(q.id))
  const mistakes = allQuestions.filter((q) => mistakeIds.has(q.id))

  // Practice mix targets
  const targets = {
    current: Math.ceil(maxItems * 0.5),   // explorer — current skill
    confidence: Math.ceil(maxItems * 0.2), // sprout — confidence/review
    mistake: Math.ceil(maxItems * 0.2),    // mistake review
    challenge: Math.floor(maxItems * 0.1), // lightning — stretch
  }

  const currentSkill = shuffle(fresh.filter((q) => q.tier === 'explorer')).slice(0, targets.current)
  const confidence = shuffle(fresh.filter((q) => q.tier === 'sprout')).slice(0, targets.confidence)
  const mistakeReview = shuffle(mistakes).slice(0, targets.mistake)
  const challenge = shuffle(fresh.filter((q) => q.tier === 'lightning')).slice(0, targets.challenge)

  let selected = deduplicateById([...currentSkill, ...confidence, ...mistakeReview, ...challenge])

  // Fill any shortfall from remaining fresh questions
  if (selected.length < maxItems) {
    const usedIds = new Set(selected.map((q) => q.id))
    const remaining = shuffle(fresh.filter((q) => !usedIds.has(q.id)))
    selected.push(...remaining.slice(0, maxItems - selected.length))
    selected = deduplicateById(selected)
  }

  let fallbackReason: string | null = null
  if (contentPoolSize === 0) {
    fallbackReason = 'No published questions available for this topic'
  } else if (selected.length < 3) {
    fallbackReason = `Small pool (${contentPoolSize} items); limited practice variety`
  }

  logSelection({
    mode: 'practice',
    topic_id: topicId,
    profile_id: profileId,
    content_pool_size: contentPoolSize,
    selected_question_ids: selected.map((q) => q.id),
    skipped_recent_count: recentIds.size,
    mistake_review_count: mistakeReview.length,
    fallback_reason: fallbackReason,
    ts: new Date().toISOString(),
  })

  return {
    questions: selected,
    contentPoolSize,
    mistakeReviewCount: mistakeReview.length,
    fallbackReason,
  }
}

// ── Fill-blank practice rotation ─────────────────────────────────────────

/**
 * Rotate items from a fill-blank practice game config.
 * Provides session-level freshness without DB history.
 * Returns a shuffled subset of the provided items array.
 *
 * @param items  All questions from config_json.questions
 * @param maxShow Maximum items to show per session (default 10)
 */
export function rotateFillBlankItems<T>(items: T[], maxShow = 10): T[] {
  if (items.length <= maxShow) return shuffle(items)
  return shuffle(items).slice(0, maxShow)
}
