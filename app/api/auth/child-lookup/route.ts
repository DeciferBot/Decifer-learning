import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

type AuthUserRow = {
  id: string
  email: string
  raw_user_meta_data: { role?: string; parent_created?: boolean; display_name?: string } | null
}

// Given a display name, return the synthetic email for a parent-created child
// account so the client can call signInWithPassword(email, pin).
// We only reveal the email for parent_created accounts (real emails are never returned).
export async function POST(req: Request) {
  // Rate limit: 10 requests per IP per minute to prevent account enumeration and PIN brute-force
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`child-lookup:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { displayName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const displayName = body.displayName?.trim()
  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  // Find profiles with matching display_name and child role
  const profiles = await prisma.profile.findMany({
    where: { display_name: { equals: displayName, mode: 'insensitive' }, role: 'child' },
    select: { user_id: true },
  })

  if (profiles.length === 0) {
    // Deliberately vague — don't reveal which names exist
    return NextResponse.json(
      { error: 'No PIN account found with that name. Try a different name or use email login.' },
      { status: 404 },
    )
  }

  const userIds = profiles.map((p) => p.user_id)

  // Among matching profiles, find one that is parent_created
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id::text, email, raw_user_meta_data
    FROM auth.users
    WHERE id = ANY(${userIds}::uuid[])
      AND (raw_user_meta_data->>'parent_created')::boolean = true
    LIMIT 2
  `

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No PIN account found with that name. Try a different name or use email login.' },
      { status: 404 },
    )
  }

  if (rows.length > 1) {
    // Ambiguous — two parent-created children with the same name
    return NextResponse.json(
      { error: 'More than one account matches that name. Please ask your parent for your login email.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ email: rows[0].email })
}
