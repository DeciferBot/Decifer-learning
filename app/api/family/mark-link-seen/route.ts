import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.familyLink.updateMany({
    where: { child_user_id: user.id, seen_by_child: false },
    data: { seen_by_child: true },
  })

  return NextResponse.json({ success: true })
}
