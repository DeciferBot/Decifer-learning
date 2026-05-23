// Content risk tiers for Decifer Learning.
// Tiers determine verification requirements and confidence thresholds.
// See docs/VERIFIED_ADAPTIVE_CONTENT_BANK.md §17 for full rationale.

export type ContentRiskTier = 1 | 2 | 3 | 4

export interface RiskTierDefinition {
  tier: ContentRiskTier
  label: string
  examples: string[]
  confidenceThreshold: number
  requiresCodeVerification: boolean
  requiresSourceBacking: boolean
  preferTemplates: boolean
  notes: string
}

export const CONTENT_RISK_TIERS: Record<ContentRiskTier, RiskTierDefinition> = {
  1: {
    tier: 1,
    label: 'Code-Verifiable',
    examples: ['arithmetic', 'algebra', 'geometry', 'physics calculations', 'unit conversions'],
    confidenceThreshold: 85,
    requiresCodeVerification: true,
    requiresSourceBacking: false,
    preferTemplates: true,
    notes:
      'Answer computed by SymPy/safe-eval/Pint. AI never produces the canonical answer. ' +
      'Templates preferred — distractors and hints from AI, correct answer from verifier.',
  },
  2: {
    tier: 2,
    label: 'Rule-Verifiable',
    examples: ['grammar', 'spelling', 'punctuation', 'basic language mechanics'],
    confidenceThreshold: 85,
    requiresCodeVerification: true, // LanguageTool counts as code verification
    requiresSourceBacking: false,
    preferTemplates: true,
    notes:
      'LanguageTool (en-GB) validates grammar/spelling rules. Templates preferred for ' +
      'pattern questions. Edge cases (style vs. rule) require constitutional critique.',
  },
  3: {
    tier: 3,
    label: 'Source-Backed Factual',
    examples: ['science facts', 'geography', 'history', 'civics', 'biology factual'],
    confidenceThreshold: 90,
    requiresCodeVerification: false,
    requiresSourceBacking: true,
    preferTemplates: false,
    notes:
      'AI drafts from injected curriculum chunks only. source_chunk_ids must be non-empty. ' +
      'Higher threshold compensates for absence of code verifier.',
  },
  4: {
    tier: 4,
    label: 'Open Explanation',
    examples: [
      'long-form explanations',
      'reading comprehension',
      'interpretive questions',
      'literary analysis',
    ],
    confidenceThreshold: 90,
    requiresCodeVerification: false,
    requiresSourceBacking: true,
    preferTemplates: false,
    notes:
      'Clear rubric in explanation field required. Constitutional critique enforces single ' +
      'defensible answer. Prefer smaller controlled item sets. Passages from pre-approved texts.',
  },
}

// Map from question_type patterns to risk tier
export const QUESTION_TYPE_TIER: Record<string, ContentRiskTier> = {
  maths_arithmetic: 1,
  maths_algebra: 1,
  maths_geometry: 1,
  science_physics_calculation: 1,
  science_chemistry_equation: 1,
  chemistry_element_fact: 1,
  english_grammar: 2,
  english_spelling: 2,
  english_punctuation: 2,
  english_comprehension: 4,
  english_literary_analysis: 4,
  science_biology_factual: 3,
  science_factual: 3,
  geography_factual: 3,
  history_factual: 3,
}

export function getRiskTier(questionType: string): ContentRiskTier {
  return QUESTION_TYPE_TIER[questionType] ?? 3
}

export function getConfidenceThreshold(questionType: string): number {
  const tier = getRiskTier(questionType)
  return CONTENT_RISK_TIERS[tier].confidenceThreshold
}
