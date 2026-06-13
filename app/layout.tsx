import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Instrument_Serif } from 'next/font/google'
// GoogleAnalytics REMOVED — Children's Code compliance.
// UK Age Appropriate Design Code (ICO, Sept 2021) prohibits third-party tracking
// of children without explicit consent. GA would require a cookie consent banner
// for all users, including children, which conflicts with the "privacy by default"
// standard. Vercel Analytics (below) is first-party, privacy-preserving, and
// does not set cookies or track individuals across sites — compliant by default.
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { jsonLd } from '@/lib/json-ld'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { CookieConsent } from '@/components/ui/CookieConsent'
import './globals.css'

// GeistSans and GeistMono ship with CSS variables --font-geist-sans and --font-geist-mono
// We re-export them under --font-geist and --font-geist-mono for our token system.

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://www.deciferlearning.com/#organization',
      name: 'DECIFER Learning',
      url: 'https://www.deciferlearning.com',
      logo: 'https://www.deciferlearning.com/brand/decifer-app-icon.svg',
      parentOrganization: { '@id': 'https://www.decifer.io/#organization' },
      description:
        'AI-assisted learning for the UK National Curriculum, Year 1 to Year 11. Game-like motivation and quality-checked Maths, English and Science content for families.',
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
  themeColor: '#FB5A24',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover', // exposes safe-area-inset-* env vars for bottom tab bar on iOS
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}>
      <body className="font-body bg-background text-ink min-h-screen">
        <OfflineBanner />
        <CookieConsent />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        {/* Vercel Analytics: first-party, no cookies, no cross-site tracking — Children's Code compliant */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
