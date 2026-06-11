import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const units = await prisma.curriculumUnit.findMany({
    where: { topic_id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      order_index: true,
      oak_confidence: true,
    },
    orderBy: { order_index: 'asc' },
  })

  return NextResponse.json(units)
}
