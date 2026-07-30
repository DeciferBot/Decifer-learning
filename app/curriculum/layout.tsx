import { MarketingFooter } from '@/components/marketing/MarketingFooter'

// Wraps every level of the public curriculum browse surface (subject, year and
// topic pages) so they all carry the shared marketing footer. The pages render
// their own nav, so this layout adds only the footer.
export default function CurriculumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MarketingFooter />
    </>
  )
}
