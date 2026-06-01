// Onboarding "About me" questions — single source of truth.
//
// These are deliberately non-PII: nothing here identifies a child. They capture
// soft preferences we use to personalise content (favourite subject, interests
// for question/card themes, preferred learning formats, self-rated confidence
// to inform starting difficulty). The API route validates submitted ids against
// the lists below, so adding/removing an option here is the only change needed.
//
// Curriculum content still lives in the DB (CLAUDE.md §16.5); this is app
// configuration, like AVATARS in lib/customise-config.ts.

export const FAVOURITE_SUBJECTS = [
  { id: 'maths',   label: 'Maths',   emoji: '🔢' },
  { id: 'english', label: 'English', emoji: '📚' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'unsure',  label: 'Not sure yet', emoji: '🤔' },
] as const

export type FavouriteSubjectId = typeof FAVOURITE_SUBJECTS[number]['id']

export const INTERESTS = [
  { id: 'space',     label: 'Space',     emoji: '🚀' },
  { id: 'animals',   label: 'Animals',   emoji: '🐾' },
  { id: 'sport',     label: 'Sport',     emoji: '⚽' },
  { id: 'art',       label: 'Art',       emoji: '🎨' },
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦕' },
  { id: 'games',     label: 'Games',     emoji: '🎮' },
  { id: 'music',     label: 'Music',     emoji: '🎵' },
  { id: 'nature',    label: 'Nature',    emoji: '🌿' },
  { id: 'building',  label: 'Building',  emoji: '🧱' },
] as const

export type InterestId = typeof INTERESTS[number]['id']

export const LEARN_STYLES = [
  { id: 'videos',    label: 'Watching videos', emoji: '🎬' },
  { id: 'games',     label: 'Playing games',   emoji: '🕹️' },
  { id: 'reading',   label: 'Reading',         emoji: '📖' },
  { id: 'hands_on',  label: 'Hands-on',        emoji: '✋' },
] as const

export type LearnStyleId = typeof LEARN_STYLES[number]['id']

// Self-rated confidence, 1–4. Stored per area so we can nudge starting difficulty.
export const CONFIDENCE_AREAS = [
  { id: 'maths',   label: 'Maths' },
  { id: 'reading', label: 'Reading' },
] as const

export type ConfidenceAreaId = typeof CONFIDENCE_AREAS[number]['id']

export const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Just starting', emoji: '🌱' },
  { value: 2, label: 'Getting there', emoji: '🙂' },
  { value: 3, label: 'Pretty good',   emoji: '😄' },
  { value: 4, label: 'Love it!',      emoji: '🤩' },
] as const

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]['value']

// Shape persisted to profiles.learning_profile. All fields optional — onboarding
// is fully skippable, so a child may complete some questions and skip the rest.
export interface LearningProfile {
  favourite_subject?: FavouriteSubjectId
  interests?: InterestId[]
  learn_styles?: LearnStyleId[]
  confidence?: Partial<Record<ConfidenceAreaId, ConfidenceLevel>>
}

// Valid-id sets for server-side validation.
export const FAVOURITE_SUBJECT_IDS = FAVOURITE_SUBJECTS.map((s) => s.id) as readonly string[]
export const INTEREST_IDS          = INTERESTS.map((i) => i.id) as readonly string[]
export const LEARN_STYLE_IDS       = LEARN_STYLES.map((l) => l.id) as readonly string[]
export const CONFIDENCE_AREA_IDS   = CONFIDENCE_AREAS.map((a) => a.id) as readonly string[]
export const CONFIDENCE_VALUES     = CONFIDENCE_LEVELS.map((l) => l.value) as readonly number[]

// Shared server-side validation for a submitted learning profile. Returns the
// cleaned object, or an error code the API route maps to a 422. Used by both the
// onboarding route and the Customise (revisit) route so rules stay in one place.
export function parseLearningProfile(input: unknown):
  | { value: LearningProfile }
  | { error: string; code: string } {
  if (input === null || typeof input !== 'object') {
    return { error: 'Invalid learning profile', code: 'INVALID_LEARNING_PROFILE' }
  }
  const lp = input as Record<string, unknown>
  const value: LearningProfile = {}

  if (lp.favourite_subject !== undefined) {
    if (typeof lp.favourite_subject !== 'string' || !FAVOURITE_SUBJECT_IDS.includes(lp.favourite_subject)) {
      return { error: 'Invalid favourite subject', code: 'INVALID_FAVOURITE_SUBJECT' }
    }
    value.favourite_subject = lp.favourite_subject as LearningProfile['favourite_subject']
  }

  if (lp.interests !== undefined) {
    if (!Array.isArray(lp.interests) || lp.interests.some((i) => typeof i !== 'string' || !INTEREST_IDS.includes(i))) {
      return { error: 'Invalid interest', code: 'INVALID_INTEREST' }
    }
    value.interests = [...new Set(lp.interests as string[])] as LearningProfile['interests']
  }

  if (lp.learn_styles !== undefined) {
    if (!Array.isArray(lp.learn_styles) || lp.learn_styles.some((s) => typeof s !== 'string' || !LEARN_STYLE_IDS.includes(s))) {
      return { error: 'Invalid learn style', code: 'INVALID_LEARN_STYLE' }
    }
    value.learn_styles = [...new Set(lp.learn_styles as string[])] as LearningProfile['learn_styles']
  }

  if (lp.confidence !== undefined) {
    if (lp.confidence === null || typeof lp.confidence !== 'object') {
      return { error: 'Invalid confidence', code: 'INVALID_CONFIDENCE' }
    }
    const conf: Record<string, number> = {}
    for (const [area, level] of Object.entries(lp.confidence as Record<string, unknown>)) {
      if (!CONFIDENCE_AREA_IDS.includes(area)) {
        return { error: 'Invalid confidence area', code: 'INVALID_CONFIDENCE_AREA' }
      }
      if (typeof level !== 'number' || !CONFIDENCE_VALUES.includes(level)) {
        return { error: 'Invalid confidence level', code: 'INVALID_CONFIDENCE_LEVEL' }
      }
      conf[area] = level
    }
    if (Object.keys(conf).length > 0) value.confidence = conf as LearningProfile['confidence']
  }

  return { value }
}
