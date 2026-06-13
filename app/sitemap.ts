import type { MetadataRoute } from 'next'
import { getPublicCurriculumSummary } from '@/lib/public-curriculum'

const BASE = 'https://www.deciferlearning.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    // Marketing / conversion pages
    { url: `${BASE}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/subjects`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/curriculum`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
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
    { url: `${BASE}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ]

  // Per-subject curriculum pages — driven by published content, so the sitemap
  // never lists a subject with nothing to show.
  let curriculumEntries: MetadataRoute.Sitemap = []
  try {
    const subjects = await getPublicCurriculumSummary()
    curriculumEntries = subjects.map((s) => ({
      url: `${BASE}/curriculum/${s.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (err) {
    // If the DB is unreachable at build time, still emit the static sitemap —
    // but log it so a misconfigured DATABASE_URL is debuggable, not silent.
    console.warn('[sitemap] curriculum entries skipped — DB unavailable:', err)
    curriculumEntries = []
  }

  return [...staticEntries, ...curriculumEntries]
}
