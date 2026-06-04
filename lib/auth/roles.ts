// Role + year-group types for Decifer Learning.
// Source of truth: CLAUDE.md §7 (Role enum: child | parent | admin), §3 (MVP year groups).
//
// Phase 1 stores role + year_group in Supabase auth.users.user_metadata so we
// don't need the `profiles` table before its migration lands in Phase 2.
// On Phase 2 the values are synced into profiles.role and profiles.year_group_id.

import type { User } from '@supabase/supabase-js'

export const ROLES = ['child', 'parent', 'admin'] as const
export type Role = (typeof ROLES)[number]

// Self-registration is only allowed for these roles. `admin` must be granted
// out-of-band by ops/Supabase service-role (Phase 12 admin work).
export const SELF_REGISTERABLE_ROLES = ['child', 'parent'] as const
export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function isSelfRegisterableRole(value: unknown): value is SelfRegisterableRole {
  return (
    typeof value === 'string' &&
    (SELF_REGISTERABLE_ROLES as readonly string[]).includes(value)
  )
}

// All supported year groups — Y1–Y11. KS4 (Y10/Y11) requires exam board selection.
export const MVP_YEAR_GROUPS = [
  { label: 'year-1',  display: 'Year 1',  keyStage: 'KS1', requiresExamBoard: false },
  { label: 'year-2',  display: 'Year 2',  keyStage: 'KS1', requiresExamBoard: false },
  { label: 'year-3',  display: 'Year 3',  keyStage: 'KS2', requiresExamBoard: false },
  { label: 'year-4',  display: 'Year 4',  keyStage: 'KS2', requiresExamBoard: false },
  { label: 'year-5',  display: 'Year 5',  keyStage: 'KS2', requiresExamBoard: false },
  { label: 'year-6',  display: 'Year 6',  keyStage: 'KS2', requiresExamBoard: false },
  { label: 'year-7',  display: 'Year 7',  keyStage: 'KS3', requiresExamBoard: false },
  { label: 'year-8',  display: 'Year 8',  keyStage: 'KS3', requiresExamBoard: false },
  { label: 'year-9',  display: 'Year 9',  keyStage: 'KS3', requiresExamBoard: false },
  { label: 'year-10', display: 'Year 10', keyStage: 'KS4', requiresExamBoard: true  },
  { label: 'year-11', display: 'Year 11', keyStage: 'KS4', requiresExamBoard: true  },
] as const

export const EXAM_BOARDS = ['AQA', 'Edexcel', 'OCR'] as const
export type ExamBoard = (typeof EXAM_BOARDS)[number]

export function isExamBoard(value: unknown): value is ExamBoard {
  return typeof value === 'string' && (EXAM_BOARDS as readonly string[]).includes(value)
}

export function yearGroupRequiresExamBoard(label: YearGroupLabel): boolean {
  return MVP_YEAR_GROUPS.find((y) => y.label === label)?.requiresExamBoard ?? false
}

export type YearGroupLabel = (typeof MVP_YEAR_GROUPS)[number]['label']

export function isYearGroupLabel(value: unknown): value is YearGroupLabel {
  return MVP_YEAR_GROUPS.some((y) => y.label === value)
}

// What we store on auth.users.user_metadata during Phase 1.
export type AuthUserMetadata = {
  role?: Role
  display_name?: string
  year_group?: YearGroupLabel
}

export function getUserRole(user: Pick<User, 'user_metadata'>): Role | null {
  const meta = user.user_metadata as AuthUserMetadata | null | undefined
  const role = meta?.role
  return isRole(role) ? role : null
}

export function getUserYearGroup(
  user: Pick<User, 'user_metadata'>
): YearGroupLabel | null {
  const meta = user.user_metadata as AuthUserMetadata | null | undefined
  const yg = meta?.year_group
  return isYearGroupLabel(yg) ? yg : null
}

export function getUserDisplayName(user: Pick<User, 'user_metadata' | 'email'>): string {
  const meta = user.user_metadata as AuthUserMetadata | null | undefined
  const name = meta?.display_name?.trim()
  if (name) return name
  return user.email ?? 'Explorer'
}

// Home path per role. Phase 1 keeps these inside /dashboard/* to avoid the
// route-group dashboard conflict noted in the Phase 1 gate report.
export const ROLE_HOME: Record<Role, string> = {
  child: '/dashboard/child',
  parent: '/dashboard/parent',
  admin: '/dashboard/admin',
}
