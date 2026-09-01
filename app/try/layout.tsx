import { MarketingFooter } from '@/components/marketing/MarketingFooter'

// The /try surface is a funnel, not a reference: a visitor should land on a
// question within two taps and leave with a reason to sign up. It shares the
// marketing footer; each page renders its own nav.
export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MarketingFooter />
    </>
  )
}
