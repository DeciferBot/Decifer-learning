// The password-gate unlock endpoint has been removed.
// Admin access is now enforced by Supabase role (user_metadata.role === 'admin').
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST() {
  return NextResponse.json({ error: 'This endpoint has been removed. Admin access requires a Supabase admin account.' }, { status: 410 })
}
export async function DELETE() {
  return NextResponse.json({ error: 'This endpoint has been removed.' }, { status: 410 })
}
