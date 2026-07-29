// Canonical Decifer Learning brand strings. Single source of truth — import
// from here wherever a tagline appears (metadata titles, OG/Twitter cards,
// footer, auth panel) so the brand line never drifts.
//
// The OG share images (the opengraph-image.tsx route files) render the tagline
// split across two lines ("Build confidence," / "one topic at a time.") — keep
// those in sync with TAGLINE by hand.

export const TAGLINE = 'Build confidence, one topic at a time.'

/** Title form used for og:title and share cards, where the brand line belongs. */
export const TITLE = `${TAGLINE} | Decifer Learning`

/**
 * Homepage <title>. Deliberately NOT the tagline.
 *
 * "Build confidence, one topic at a time." is a good brand line and a useless
 * title tag: nobody searches it. Six months of Search Console showed 9 distinct
 * queries total, 7 of them the brand or a misspelling of it, and zero
 * non-brand queries at any usable position. A title has to contain the words a
 * parent would actually type, so this leads with the curriculum and the year
 * span and keeps the brand at the end where it still satisfies a brand search.
 *
 * TAGLINE stays exactly as it is for the OG cards, footer and auth panel.
 */
export const SEO_TITLE = 'UK National Curriculum Learning for Years 1 to 11 | Decifer Learning'
