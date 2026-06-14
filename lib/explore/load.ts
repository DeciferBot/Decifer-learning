import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ExplorerData } from './types'

// Loads a published explorer + its nodes from the DB. RLS already restricts to
// published rows; we keep the explicit is_published filter as defence-in-depth
// (CLAUDE.md §8 — content reads filter published in app code AND in RLS).
// Generic over the explorer shape: `loadExplorer<AtlasExplorer>('world-atlas')`.
export async function loadExplorer<E = ExplorerData>(key: string): Promise<E | null> {
  const supabase = createSupabaseServerClient()

  const { data: explorer, error } = await supabase
    .from('explorers')
    .select('id, key, title, tagline, emoji, scene_type, gradient, config')
    .eq('key', key)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !explorer) return null

  const { data: nodes } = await supabase
    .from('explorer_nodes')
    .select('key, name, order_index, visual, stats, content, quiz')
    .eq('explorer_id', explorer.id)
    .order('order_index', { ascending: true })

  return {
    key: explorer.key,
    title: explorer.title,
    tagline: explorer.tagline,
    emoji: explorer.emoji,
    scene_type: explorer.scene_type,
    gradient: explorer.gradient,
    config: explorer.config,
    nodes: nodes ?? [],
  } as unknown as E
}
