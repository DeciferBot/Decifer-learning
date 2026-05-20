import type { Metadata, Viewport } from 'next'
import { Nunito, Inter } from 'next/font/google'
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
  title: 'Decifer Learning',
  description: 'UK National Curriculum learning adventure.',
  applicationName: 'Decifer Learning',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Decifer Learning',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#6C9EFF',
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
        {children}
      </body>
    </html>
  )
}
