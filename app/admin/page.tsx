// The password-gate admin unlock screen has been removed.
// Admin access is now enforced by Supabase role (user_metadata.role === 'admin').
// This route redirects to login so any bookmarked /admin URLs land safely.
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export default function OldAdminUnlockPage() {
  redirect('/login')
}
