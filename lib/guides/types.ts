// Typed content model for the public UAE parent guides (/guides).
//
// Guides are marketing/editorial content, authored in this repo as data files
// (one file per guide under lib/guides/content/). They are NOT curriculum
// content, so the "no hardcoded content" rule for topics/questions/cards does
// not apply here. Keeping them as typed blocks (rather than free JSX per page)
// gives every article the same structure, lets the renderer emit consistent
// heading anchors and tables.
//
// FAQ blocks are rendered for readers only. They used to feed FAQPage JSON-LD,
// but Google stopped showing FAQ rich results for everyone on 7 May 2026, so
// that markup was removed rather than maintained for nothing.
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
  /**
   * A direct, self-contained answer to the question the title implies.
   *
   * This is here for readers, not for search. A parent searching for fees wants
   * the number, and making them read four paragraphs of context first is bad
   * writing. Do not justify it on SEO grounds: Google states you cannot mark a
   * page up for featured snippets ("You can't"), and its generative-AI guidance
   * explicitly lists writing in a particular shape for AI among the things that
   * do not help. The widely repeated "40 to 60 word answer paragraph" rule is
   * third-party folklore extrapolated from SERP scrapes, not Google guidance.
   *
   * Keep it factual and free of marketing. Also emitted as the Article's
   * schema.org `abstract`.
   */
  keyAnswer: string
  /** ISO dates. Bump dateModified whenever facts are refreshed. */
  datePublished: string
  dateModified: string
  blocks: GuideBlock[]
  /** Public, verifiable sources the article's facts come from. Rendered on page. */
  sources: GuideSource[]
  /** Slugs of related guides, rendered as "Keep reading". */
  related: string[]
}
