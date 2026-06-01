// Standalone onboarding chrome — no top nav / bottom tab bar, so a first-run
// child can't navigate away mid-flow. Auth is enforced by middleware; the page
// itself enforces child-only + already-onboarded redirects.

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
    </div>
  )
}
