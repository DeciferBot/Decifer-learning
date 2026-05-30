import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

type AuthUserRow = {
  id: string
  email: string
  confirmed_at: string | null
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

  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id::text, email, confirmed_at, raw_user_meta_data
    FROM auth.users
    WHERE lower(email) = ${childEmail}
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No account found with that email. Make sure your child has registered first." },
      { status: 404 },
    )
  }

  const childUser = rows[0]

  if (!childUser.confirmed_at) {
    return NextResponse.json(
      { error: "That account hasn't been verified yet. Ask your child to confirm their email first." },
      { status: 400 },
    )
  }

  const childRole = childUser.raw_user_meta_data?.role
  if (childRole !== 'child') {
    return NextResponse.json(
      { error: 'That account is not a child account. Only child accounts can be linked.' },
      { status: 400 },
    )
  }

  // Check if child is already linked to any parent
  const existingLink = await prisma.familyLink.findUnique({
    where: { child_user_id: childUser.id },
    include: { parent: { select: { display_name: true } } },
  })
  if (existingLink) {
    if (existingLink.parent_user_id === user.id) {
      return NextResponse.json(
        { error: 'This child is already linked to your account.' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: 'That child account is already linked to another parent.' },
      { status: 400 },
    )
  }

  await prisma.familyLink.create({
    data: {
      parent_user_id: user.id,
      child_user_id: childUser.id,
      seen_by_child: false,
    },
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
