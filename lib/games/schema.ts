// Structured data for the public, no-login games catalogue (/games and
// /games/*).
//
// These pages shipped with only the site-wide EducationalOrganization and
// WebSite nodes from the root layout, so nothing on them described the thing
// a searcher is actually looking for. VideoGame is the right type here: it is
// what Google reads for game results, and every field below is a fact already
// stated on the page itself. Nothing is inferred or embellished.
//
// playMode is set per game rather than blanket-applied, because it is not the
// same everywhere: chess, checkers and Connect 4 offer both a computer
// opponent and an invite-code friend game, the crossword is solo, and word
// tiles is friend-only. Claiming SinglePlayer on a two-player-only game would
// be a false statement in markup, which is exactly what structured data
// penalties exist for.

const BASE = 'https://www.deciferlearning.com'

export interface GameSchemaInput {
  /** Game name as a person would say it, e.g. "Chess". */
  name: string
  /** Path segment under /games. */
  slug: string
  /** Reuse the page's own meta description. Keeps the two from drifting. */
  description: string
  genre: string
  playMode: Array<'SinglePlayer' | 'MultiPlayer'>
}

const publisher = {
  '@type': 'Organization',
  name: 'Decifer Learning',
  url: BASE,
}

function breadcrumb(trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${BASE}${t.path}`,
    })),
  }
}

/** Graph for a single game page. */
export function gamePageSchema(game: GameSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        name: game.name,
        url: `${BASE}/games/${game.slug}`,
        description: game.description,
        genre: game.genre,
        playMode: game.playMode,
        // Browser-based, so there is no download and no platform to install on.
        gamePlatform: 'Web browser',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any web browser',
        // Free with no account. Deliberately no `offers` node: that would need
        // a currency, and inventing one to satisfy a schema field is worse
        // than leaving the field out.
        isAccessibleForFree: true,
        inLanguage: 'en-GB',
        publisher,
      },
      breadcrumb([
        { name: 'Decifer Learning', path: '/' },
        { name: 'Games', path: '/games' },
        { name: game.name, path: `/games/${game.slug}` },
      ]),
    ],
  }
}

/** Graph for the /games index. */
export function gamesIndexSchema(games: Array<{ name: string; slug: string }>) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Free online games for kids',
        url: `${BASE}/games`,
        isAccessibleForFree: true,
        inLanguage: 'en-GB',
      },
      {
        '@type': 'ItemList',
        itemListElement: games.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: g.name,
          url: `${BASE}/games/${g.slug}`,
        })),
      },
      breadcrumb([
        { name: 'Decifer Learning', path: '/' },
        { name: 'Games', path: '/games' },
      ]),
    ],
  }
}
