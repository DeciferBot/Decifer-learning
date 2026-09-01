import type { MetadataRoute } from 'next'
import {
  getPublicCurriculumSummary,
  getPublicTopicParams,
  getPublicYearParams,
} from '@/lib/public-curriculum'
import { getAllGuides } from '@/lib/guides'
import { listPublishedChecks } from '@/lib/skills-check/server'

const BASE = 'https://www.deciferlearning.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    // Marketing / conversion pages
    { url: `${BASE}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/subjects`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/curriculum`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    // Free Skills Check — a working tool, so it earns a high priority. Result
    // pages (/skills-check/r/*) are noindex and deliberately absent.
    { url: `${BASE}/skills-check`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    // Free Reasoning Check. Every question is generated from a seed, so these
    // are static routes with NO database behind them — zero queries, not one per
    // page. The result page (/reasoning/r/*) and the delete page are noindex and
    // deliberately absent.
    { url: `${BASE}/reasoning`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/reasoning/non-verbal`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/reasoning/cat4-practice`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/reasoning/11-plus`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/blitz`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    // Free games — public, no-login catalogue for SEO discoverability
    { url: `${BASE}/games`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/games/chess`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/games/checkers`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/games/connect-4`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/games/crossword`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/games/word-tiles`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    // Help centre
    { url: `${BASE}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/help/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/help/how-decifer-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/help/parent-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/help/student-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/help/gamification`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/help/content-quality`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    // Legal
    { url: `${BASE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/legal/privacy-for-kids`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ]

  // Per-subject curriculum pages — driven by published content, so the sitemap
  // never lists a subject with nothing to show.
  let curriculumEntries: MetadataRoute.Sitemap = []
  try {
    // Three levels: subject, then year, then topic. The year and topic pages are
    // where the searchable demand is ("year 7 maths topics", "year 4 fractions"),
    // so they belong in the sitemap even though they far outnumber the rest.
    const [subjects, years, topics] = await Promise.all([
      getPublicCurriculumSummary(),
      getPublicYearParams(),
      getPublicTopicParams(),
    ])
    curriculumEntries = [
      ...subjects.map((s) => ({
        url: `${BASE}/curriculum/${s.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...years.map((y) => ({
        url: `${BASE}/curriculum/${y.subject}/${y.year}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...topics.map((t) => ({
        url: `${BASE}/curriculum/${t.subject}/${t.year}/${t.topic}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
    ]
  } catch (err) {
    // If the DB is unreachable at build time, still emit the static sitemap —
    // but log it so a misconfigured DATABASE_URL is debuggable, not silent.
    console.warn('[sitemap] curriculum entries skipped — DB unavailable:', err)
    curriculumEntries = []
  }

  // UAE parent guides — repo-authored editorial content, no DB dependency.
  // dateModified is per-guide so a refreshed article signals freshness.
  const guideEntries: MetadataRoute.Sitemap = getAllGuides().map((g) => ({
    url: `${BASE}/guides/${g.slug}`,
    lastModified: new Date(g.dateModified),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // One landing page per published check. ONE query for the whole list, not one
  // per page — the same rule the curriculum entries above follow.
  let checkEntries: MetadataRoute.Sitemap = []
  try {
    const checks = await listPublishedChecks()
    checkEntries = checks.map((c) => ({
      url: `${BASE}/skills-check/${c.subjectSlug}/${c.yearLabel}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  } catch (err) {
    console.warn('[sitemap] skills-check entries skipped — DB unavailable:', err)
    checkEntries = []
  }

  return [...staticEntries, ...guideEntries, ...curriculumEntries, ...checkEntries]
}
