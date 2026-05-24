import type { Metadata, Viewport } from 'next'
import { Nunito, Inter } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'DECIFER Learning',
  description: 'UK National Curriculum learning adventure.',
  applicationName: 'DECIFER Learning',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/brand/decifer-favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/brand/decifer-app-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DECIFER Learning',
  },
  formatDetection: {
    telephone: false,
  },
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
      </body>
    </html>
  )
}
