import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// The authenticated caller's profile (id, display_name, avatar, year group).
export async function getAuthedProfile() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.profile.findUnique({
    where: { user_id: user.id },
    select: {
      id: true,
      display_name: true,
      avatar_config: true,
      year_group_id: true,
      role: true,
    },
  })
}

// A short, human-typable join code, unique among games that aren't finished.
export async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    // 6 digits, no leading-zero ambiguity for kids (range 100000–999999).
    const pin = String(100000 + Math.floor(Math.random() * 900000))
    const clash = await prisma.liveGame.findFirst({
      where: { pin, status: { not: 'finished' } },
      select: { id: true },
    })
    if (!clash) return pin
  }
  throw new Error('Could not allocate a unique game PIN')
}
