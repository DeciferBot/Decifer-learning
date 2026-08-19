import Link from 'next/link'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingNav } from '@/components/marketing/MarketingNav'

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>

      <MarketingFooter />
    </div>
  )
}
