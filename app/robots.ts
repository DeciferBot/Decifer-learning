import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help/'],
        disallow: ['/dashboard/', '/learn/', '/collection', '/vault', '/world-map', '/guardian/', '/api/'],
      },
    ],
    sitemap: 'https://www.deciferlearning.com/sitemap.xml',
  }
}
