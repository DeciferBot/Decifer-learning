// Which year groups get the "young mode" quiz presentation: bigger type,
// bigger tap targets, a read-aloud button, picture answer cards where the
// content has them, and a guardrail retry (a wrong pick is ruled out rather
// than staying clickable, so a second guess is narrower, never harder).
//
// Scope: KS1 (Year 1–2) plus Year 3, the year the National Curriculum still
// treats as "learning to read" rather than "reading to learn" (see
// docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md §1 — the Year 3–4
// shift). This changes presentation only; content selection is unaffected
// and still keys off year_group_id as it always has (CLAUDE.md §16.3).
const YOUNG_MODE_YEAR_GROUPS = new Set(['year-1', 'year-2', 'year-3'])

export function isYoungBand(yearGroupLabel: string | null | undefined): boolean {
  return !!yearGroupLabel && YOUNG_MODE_YEAR_GROUPS.has(yearGroupLabel)
}
