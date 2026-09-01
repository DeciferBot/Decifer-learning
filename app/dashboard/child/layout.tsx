// The child's home screen sits under /dashboard, not in the (child) route
// group, so it never had the bottom tab bar the rest of the child app has.
// That was harmless while the bar's first tab pointed at /world-map. It stopped
// being harmless when Learn became this screen: a child tapping Learn landed
// here and the bar vanished, with no way back to Games, Cards or Profile.
//
// This wrapper adds the same bar, and the same bottom padding the (child)
// layout uses to keep content clear of it.
import { BottomNav } from '@/components/ui/BottomNav'

export default function ChildDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <BottomNav />
    </>
  )
}
