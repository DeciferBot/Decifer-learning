import type { Metadata, Viewport } from 'next'
import { Nunito, Inter } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.deciferlearning.com/#organization',
      name: 'DECIFER Learning',
      url: 'https://www.deciferlearning.com',
      parentOrganization: { '@id': 'https://www.decifer.io/#organization' },
      description:
        'AI-assisted learning for UK National Curriculum — Year 3 and Year 7. Game-like motivation and quality-checked content for families.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.deciferlearning.com/#website',
      url: 'https://www.deciferlearning.com',
      name: 'DECIFER Learning',
      publisher: { '@id': 'https://www.deciferlearning.com/#organization' },
    },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'DECIFER Learning — UK National Curriculum for Families',
    template: '%s | DECIFER Learning',
  },
  description:
    'AI-assisted feedback, game-like motivation, and quality-checked curriculum content for Year 3 and Year 7. Parents can see progress, confidence, and where support is needed.',
  metadataBase: new URL('https://www.deciferlearning.com'),
  applicationName: 'DECIFER Learning',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/brand/decifer-favicon.svg', type: 'image/svg+xml' }],
    apple: '/brand/decifer-app-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DECIFER Learning',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'DECIFER Learning — UK National Curriculum for Families',
    description:
      'AI-assisted feedback, game-like motivation, and quality-checked curriculum content for Year 3 and Year 7.',
    url: 'https://www.deciferlearning.com',
    siteName: 'DECIFER Learning',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DECIFER Learning — UK National Curriculum for Families',
    description:
      'AI-assisted feedback, game-like motivation, and quality-checked curriculum content for Year 3 and Year 7.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }),
}

export const viewport: Viewport = {
  themeColor: '#F05A28',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-body bg-background text-ink min-h-screen">
        <OfflineBanner />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      )}
    </html>
  )
}
