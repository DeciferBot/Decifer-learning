import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getUserRole, isYearGroupLabel, type YearGroupLabel } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (role !== 'parent') {
    return NextResponse.json({ error: 'Only parent accounts can create child accounts.' }, { status: 403 })
  }

  let body: { displayName?: string; yearGroup?: string; pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const displayName = body.displayName?.trim()
  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: "Child's name must be at least 2 characters." }, { status: 400 })
  }

  const yearGroup = body.yearGroup
  if (!yearGroup || !isYearGroupLabel(yearGroup)) {
    return NextResponse.json({ error: 'A valid year group is required.' }, { status: 400 })
  }

  const pin = body.pin?.trim()
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4–6 digits.' }, { status: 400 })
  }

  // Check parent isn't already linked to too many children (guard against abuse)
  const linkedCount = await prisma.familyLink.count({
    where: { parent_user_id: user.id },
  })
  if (linkedCount >= 10) {
    return NextResponse.json({ error: 'You can link up to 10 children.' }, { status: 400 })
  }

  // Generate a synthetic email that is stable and internal-only.
  // Format: child-<random>@decifer.internal — never used for sending mail.
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  const syntheticEmail = `child-${randomSuffix}@decifer.internal`

  const admin = createSupabaseAdminClient()

  // Create the auth user with service-role (bypasses email confirmation)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: pin,
    email_confirm: true, // pre-confirm — no email is sent
    user_metadata: {
      role: 'child',
      display_name: displayName,
      year_group: yearGroup as YearGroupLabel,
      parent_created: true,
    },
  })

  if (createError || !created.user) {
    console.error('[create-child] auth create error', createError)
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
  }

  const childUserId = created.user.id

  // Look up the year_group row
  const yearGroupRow = await prisma.yearGroup.findFirst({
    where: { label: yearGroup },
    select: { id: true },
  })

  // Create the profile row (the auth trigger may also fire, so upsert)
  await prisma.profile.upsert({
    where: { user_id: childUserId },
    create: {
      user_id: childUserId,
      display_name: displayName,
      role: 'child',
      year_group_id: yearGroupRow?.id ?? null,
    },
    update: {
      display_name: displayName,
      year_group_id: yearGroupRow?.id ?? null,
    },
  })

  // Link to the parent — already confirmed so mark seen_by_child true
  await prisma.familyLink.create({
    data: {
      parent_user_id: user.id,
      child_user_id: childUserId,
      seen_by_child: true,
    },
  })

  return NextResponse.json({
    success: true,
    displayName,
    loginHint: `${displayName} can log in with their name and the PIN you chose.`,
  })
}
