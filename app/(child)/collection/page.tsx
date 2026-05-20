import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { DiscoveryCard, type CardData } from '@/components/cards/DiscoveryCard'

export const metadata = { title: 'My Collection — Decifer Learning' }

export default async function CollectionPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) notFound()

  // All published cards visible to this child (year-group-specific + shared)
  const { data: allCards } = await supabase
    .from('card_catalog')
    .select('id, title, fact_text, rarity, year_group_id')
    .eq('status', 'published')
    .eq('is_fusion', false)
    .or(`year_group_id.eq.${profile.year_group_id ?? 'null'},year_group_id.is.null`)
    .order('rarity')

  // Cards this child has collected
  const { data: owned } = await supabase
    .from('child_collection')
    .select('card_id, quantity')
    .eq('profile_id', profile.id)

  const ownedSet = new Set((owned ?? []).map((r: { card_id: string }) => r.card_id))
  const cards = (allCards ?? []) as (CardData & { year_group_id: string | null })[]
  const collectedCount = cards.filter((c) => ownedSet.has(c.id)).length

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  const sorted = [...cards].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
  )

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">My Collection</h1>
        <p className="mt-1 text-sm text-muted">
          {collectedCount} / {cards.length} cards discovered
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-maths transition-all"
          style={{ width: cards.length > 0 ? `${(collectedCount / cards.length) * 100}%` : '0%' }}
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-muted">No cards available yet — complete a quiz to discover your first card!</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((card) => (
            <DiscoveryCard
              key={card.id}
              card={card}
              collected={ownedSet.has(card.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
