// Phase 2 — profile read helpers.
//
// After registration, the auth.users INSERT trigger (see
// prisma/migrations/20260520120100_phase2_auth_bridge_seed_rls/migration.sql)
// materialises a profiles row from auth.users.raw_user_meta_data. From Phase 2
// onward the application reads role + year_group from the DB, not from auth
// metadata. Metadata stays useful as the source of truth for the *initial*
// profile values, but the DB row is authoritative.
//
// RLS lets a signed-in user SELECT their own profile (policy
// "profiles_select_self"), so the anon-key Supabase client is sufficient — no
// service-role key needed on the read path.
//
// MVP year groups (Year 3, Year 7) only; CLAUDE.md §3.

import type { SupabaseClient } from '@supabase/supabase-js'
import { MVP_YEAR_GROUPS, type Role, type YearGroupLabel } from '@/lib/auth/roles'

export type Profile = {
  id: string
  user_id: string
  display_name: string
  role: Role
  year_group_id: string | null
  year_group_label: YearGroupLabel | null
  total_points: number
  streak_days: number
}

type ProfileRow = {
  id: string
  user_id: string
  display_name: string
  role: Role
  year_group_id: string | null
  total_points: number
  streak_days: number
  year_groups: { label: string } | { label: string }[] | null
}

function pickYearGroupLabel(yg: ProfileRow['year_groups']): YearGroupLabel | null {
  const row = Array.isArray(yg) ? yg[0] : yg
  const label = row?.label
  return MVP_YEAR_GROUPS.some((y) => y.label === label) ? (label as YearGroupLabel) : null
}

export async function getCurrentProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, user_id, display_name, role, year_group_id, total_points, streak_days, year_groups(label)'
    )
    .eq('user_id', userId)
    .maybeSingle<ProfileRow>()

  if (error || !data) return null

  return {
    id: data.id,
    user_id: data.user_id,
    display_name: data.display_name,
    role: data.role,
    year_group_id: data.year_group_id,
    year_group_label: pickYearGroupLabel(data.year_groups),
    total_points: data.total_points,
    streak_days: data.streak_days,
  }
}
