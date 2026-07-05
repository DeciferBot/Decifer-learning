import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help/', '/curriculum', '/subjects', '/how-it-works', '/pricing', '/blitz'],
        disallow: ['/dashboard/', '/learn/', '/collection', '/vault', '/world-map', '/guardian/', '/api/', '/play', '/live/', '/join'],
      },
    ],
    sitemap: 'https://www.deciferlearning.com/sitemap.xml',
  }
}
