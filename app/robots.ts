import type { MetadataRoute } from 'next'

/**
 * Crawl rules for the public site.
 *
 * Everything under the (child), (parent) and admin trees is signed-in product:
 * a crawler that fetches one gets a 307 to /login and nothing else, so every
 * such fetch is crawl budget spent on a redirect instead of on the curriculum
 * and guide pages that are the point of the site. The disallow list previously
 * covered only part of that tree, leaving /explore, /topics, /exam, /profile,
 * /missions, /leaderboard, /customise, /daily-challenge, /onboarding and /admin
 * open. All ten were confirmed on the live site to redirect to /login.
 *
 * /login, /register and /reset-password are deliberately NOT disallowed. They
 * each set `robots: noindex` in their own metadata, and a disallowed URL is
 * never fetched, so the crawler would never read the tag. Disallow and noindex
 * do not compose; to honour noindex the page has to stay fetchable.
 *
 * AI assistant crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
 * CCBot) are covered by the `*` rule and are welcome on the public pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help/', '/curriculum', '/subjects', '/how-it-works', '/pricing', '/blitz', '/guides', '/games'],
        disallow: [
          '/api/',
          // Parent and admin product
          '/dashboard/',
          '/admin',
          // Child product
          '/collection',
          '/customise',
          '/daily-challenge',
          '/exam',
          '/explore',
          '/guardian/',
          '/leaderboard',
          '/learn/',
          '/missions',
          '/profile',
          '/topics',
          '/vault',
          '/world-map',
          // Session surfaces
          '/live/',
          '/onboarding',
          '/play',
          '/join',
        ],
      },
    ],
    sitemap: 'https://www.deciferlearning.com/sitemap.xml',
  }
}
