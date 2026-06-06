import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
