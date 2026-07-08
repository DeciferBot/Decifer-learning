import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Instrument_Serif } from 'next/font/google'
import { ConsentedAnalytics } from '@/components/analytics/ConsentedAnalytics'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { jsonLd } from '@/lib/json-ld'
import { TITLE } from '@/lib/brand'
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
      name: 'Decifer Learning',
      url: 'https://www.deciferlearning.com',
      logo: 'https://www.deciferlearning.com/brand/decifer-app-icon.svg',
      parentOrganization: { '@id': 'https://www.decifer.io/#organization' },
      description:
        'British curriculum learning for Years 1 to 11 (KS1 to KS4/GCSE). Quality-checked Maths, English, Science, History and Geography, with a parent learning map that shows exactly where each child stands. Built for British-curriculum families in the UAE, the Gulf and worldwide.',
      areaServed: ['AE', 'GB', 'Worldwide'],
      audience: { '@type': 'EducationalAudience', educationalRole: 'parent' },
      knowsAbout: [
        'UK National Curriculum',
        'British curriculum',
        'Key Stage 1',
        'Key Stage 2',
        'Key Stage 3',
        'GCSE',
        'Maths',
        'English',
        'Science',
        'History',
        'Geography',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.deciferlearning.com/#website',
      url: 'https://www.deciferlearning.com',
      name: 'Decifer Learning',
      publisher: { '@id': 'https://www.deciferlearning.com/#organization' },
    },
  ],
}

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: '%s | Decifer Learning',
  },
  description:
    'British curriculum learning for Years 1 to 11 (KS1 to GCSE): quality-checked Maths, English, Science, History and Geography, plus a parent progress dashboard.',
  keywords: [
    'British curriculum',
    'UK National Curriculum',
    'British curriculum Dubai',
    'British curriculum UAE',
    'online learning UAE',
    'KS1', 'KS2', 'KS3', 'KS4',
    'GCSE revision',
    'maths English science',
    'Year 1 to Year 11',
    'kids learning app',
    'parent learning dashboard',
  ],
  metadataBase: new URL('https://www.deciferlearning.com'),
  applicationName: 'Decifer Learning',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/brand/decifer-favicon.svg', type: 'image/svg+xml' }],
    apple: '/brand/decifer-app-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Decifer Learning',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: TITLE,
    description:
      'Years 1 to 11 across five subjects, with thousands of quality-checked questions, and a learning map that finally shows you where your child stands. Built for British-curriculum families.',
    url: 'https://www.deciferlearning.com',
    siteName: 'Decifer Learning',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description:
      'Years 1 to 11 across five subjects, with thousands of quality-checked questions, and a learning map that finally shows you where your child stands. Built for British-curriculum families.',
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
    <html lang="en-GB" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}>
      <body className="font-body bg-background text-ink min-h-screen">
        {/* Set the colour mode before paint, so there is no flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('decifer-mode');if(m==='dark'||(!m&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <OfflineBanner />
        <CookieConsent />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        {/* Google Analytics — loads only after explicit analytics consent (see ConsentedAnalytics) */}
        <ConsentedAnalytics />
        {/* Vercel Analytics: first-party, no cookies, no cross-site tracking */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
