import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help/', '/curriculum', '/subjects', '/how-it-works', '/pricing'],
        disallow: ['/dashboard/', '/learn/', '/collection', '/vault', '/world-map', '/guardian/', '/api/'],
      },
    ],
    sitemap: 'https://www.deciferlearning.com/sitemap.xml',
  }
}
