import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

type AuthUserRow = {
  id: string
  email: string
  raw_user_meta_data: { role?: string; display_name?: string } | null
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (role !== 'parent') {
    return NextResponse.json({ error: 'Only parent accounts can link children.' }, { status: 403 })
  }

  let body: { childEmail?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const childEmail = body.childEmail?.trim().toLowerCase()
  if (!childEmail) {
    return NextResponse.json({ error: 'Child email is required.' }, { status: 400 })
  }

  if (childEmail === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot link your own account.' }, { status: 400 })
  }

  // Look up the child in auth.users via a raw query (service-role connection can read auth schema)
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id::text, email, raw_user_meta_data
    FROM auth.users
    WHERE lower(email) = ${childEmail}
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No account found with that email. Make sure your child has registered first.' },
      { status: 404 },
    )
  }

  const childUser = rows[0]
  const childRole = childUser.raw_user_meta_data?.role

  if (childRole !== 'child') {
    return NextResponse.json(
      { error: 'That account is not a child account. Only child accounts can be linked.' },
      { status: 400 },
    )
  }

  // Prevent duplicate links
  const existing = await prisma.familyLink.findUnique({
    where: {
      parent_user_id_child_user_id: {
        parent_user_id: user.id,
        child_user_id: childUser.id,
      },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'This child is already linked to your account.' },
      { status: 400 },
    )
  }

  await prisma.familyLink.create({
    data: { parent_user_id: user.id, child_user_id: childUser.id },
  })

  const profile = await prisma.profile.findUnique({
    where: { user_id: childUser.id },
    select: { display_name: true },
  })

  return NextResponse.json({
    success: true,
    displayName: profile?.display_name ?? childUser.email,
  })
}
