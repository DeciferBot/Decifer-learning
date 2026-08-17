import { jsonLd } from '@/lib/json-ld'

const BASE = 'https://www.deciferlearning.com'

/**
 * BreadcrumbList structured data for the help centre.
 *
 * The help pages sit two levels down (Home > Help > page) but emitted no
 * structured data, so search engines had no machine-readable signal that they
 * belong to a section. The curriculum and guides trees already publish
 * breadcrumbs; this brings the help centre in line with them.
 *
 * Serialised through the shared `jsonLd` helper so `<` cannot break out of the
 * script block.
 */
export function HelpBreadcrumbSchema({
  title,
  path,
}: {
  /** Page title as shown in the H1, e.g. "Parent guide". */
  title: string
  /** Path below /help, e.g. "/help/parent-guide". */
  path: string
}) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Help', item: `${BASE}/help` },
      { '@type': 'ListItem', position: 3, name: title, item: `${BASE}${path}` },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(node) }}
    />
  )
}
