import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { pickRarity } from '@/lib/cards'
import type { DroppedCard } from '@/app/api/quiz/submit/route'

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { aidType: string; topicKey: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profile = await prisma.profile.findFirst({
    where: { user_id: user.id },
    select: { id: true, year_group_id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const card = await dropCard(profile.id, profile.year_group_id)
  return NextResponse.json({ card })
}

async function dropCard(profileId: string, yearGroupId: string | null): Promise<DroppedCard | null> {
  const rarity = pickRarity()

  const candidates = await prisma.cardCatalog.findMany({
    where: {
      rarity,
      status: 'published',
      OR: [
        { year_group_id: yearGroupId ?? undefined },
        { year_group_id: null },
      ],
    },
  })
  if (candidates.length === 0) return null

  const card = candidates[Math.floor(Math.random() * candidates.length)]

  const existing = await prisma.childCollection.findUnique({
    where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
  })

  if (existing) {
    await prisma.childCollection.update({
      where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
      data: { quantity: { increment: 1 } },
    })
  } else {
    await prisma.childCollection.create({
      data: { profile_id: profileId, card_id: card.id, quantity: 1 },
    })
  }

  return { id: card.id, title: card.title, fact_text: card.fact_text, rarity: card.rarity, isNew: !existing }
}
