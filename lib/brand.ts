// Canonical Decifer Learning brand strings. Single source of truth — import
// from here wherever a tagline appears (metadata titles, OG/Twitter cards,
// footer, auth panel) so the brand line never drifts.
//
// The OG share images (the opengraph-image.tsx route files) render the tagline
// split across two lines ("Build confidence," / "one topic at a time.") — keep
// those in sync with TAGLINE by hand.

export const TAGLINE = 'Build confidence, one topic at a time.'

/** Title form used for <title> and og:title, e.g. browser tab and share cards. */
export const TITLE = `${TAGLINE} | Decifer Learning`
