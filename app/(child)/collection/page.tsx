export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { CollectionGrid } from './CollectionGrid'

export const metadata = { title: 'My Collection — Decifer Learning' }

export default async function CollectionPage() {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()
  if (!user) notFound()

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) notFound()

  // Published cards for this year group + global cards
  const { data: allCards } = await supabase
    .from('card_catalog')
    .select('id, title, fact_text, rarity, year_group_id, subject_id')
    .eq('status', 'published')
    .eq('is_fusion', false)
    .or(`year_group_id.eq.${profile.year_group_id ?? 'null'},year_group_id.is.null`)
    .order('rarity')

  // Cards this child owns
  const { data: owned } = await supabase
    .from('child_collection')
    .select('card_id, quantity')
    .eq('profile_id', profile.id)

  // Subject list for filter pills (only subjects that have cards)
  const { data: subjectRows } = await supabase
    .from('subjects')
    .select('id, name, colour_token')
    .order('name')

  const ownedSet = new Set((owned ?? []).map((r: { card_id: string }) => r.card_id))
  const cards = (allCards ?? []) as Array<{ id: string; title: string; fact_text: string; rarity: string; year_group_id: string | null; subject_id: string | null }>
  const collectedCount = cards.filter((c) => ownedSet.has(c.id)).length

  // Only include subjects that actually appear in the card pool
  const cardSubjectIds = new Set(cards.map((c) => c.subject_id).filter(Boolean))
  const subjects = (subjectRows ?? []).filter((s) => cardSubjectIds.has(s.id))

  return (
    <section>
      <h1
        className="mb-5 font-extrabold"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h1)',
          color: 'var(--text-heading)',
          letterSpacing: '-0.02em',
        }}
      >
        My Collection
      </h1>

      <CollectionGrid
        cards={cards}
        ownedSet={ownedSet}
        subjects={subjects}
        totalCards={cards.length}
        collectedCount={collectedCount}
      />
    </section>
  )
}
