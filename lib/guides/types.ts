// Typed content model for the public UAE parent guides (/guides).
//
// Guides are marketing/editorial content, authored in this repo as data files
// (one file per guide under lib/guides/content/). They are NOT curriculum
// content, so the "no hardcoded content" rule for topics/questions/cards does
// not apply here. Keeping them as typed blocks (rather than free JSX per page)
// gives every article the same structure, lets the renderer emit consistent
// heading anchors and tables, and lets FAQ blocks feed FAQPage JSON-LD
// automatically.
//
// `html` fields may contain limited inline HTML (<strong>, <em>, <a href>).
// They are authored in this repo only — never sourced from user input or the
// database — which is why rendering them with dangerouslySetInnerHTML is
// acceptable.

export type GuideBlock =
  | { kind: 'p'; html: string }
  | { kind: 'h2'; id: string; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { kind: 'callout'; title: string; html: string }
  | { kind: 'cta' }
  | { kind: 'faq'; items: { q: string; a: string }[] }

export type GuideCategory =
  | 'schools-and-fees'
  | 'curriculum-explained'
  | 'planning-and-dates'

export const GUIDE_CATEGORY_LABELS: Record<GuideCategory, string> = {
  'schools-and-fees': 'Schools, ratings and fees',
  'curriculum-explained': 'The British curriculum, explained',
  'planning-and-dates': 'Term dates and planning',
}

export interface GuideSource {
  label: string
  url: string
}

export interface Guide {
  slug: string
  /** <title> tag — leads with what a parent would type into Google. */
  title: string
  /** On-page H1. Can be friendlier than the title tag. */
  h1: string
  description: string
  category: GuideCategory
  /** ISO dates. Bump dateModified whenever facts are refreshed. */
  datePublished: string
  dateModified: string
  blocks: GuideBlock[]
  /** Public, verifiable sources the article's facts come from. Rendered on page. */
  sources: GuideSource[]
  /** Slugs of related guides, rendered as "Keep reading". */
  related: string[]
}
