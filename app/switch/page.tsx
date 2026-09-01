// The shared-iPad hand-over. A parent signs in once, opens this, and their
// children tap their own face to start learning.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { WhoIsLearning, type PickerChild } from './WhoIsLearning'

export const metadata = { title: "Who's learning?" }

type AuthUserRow = { id: string; email: string }

export default async function SwitchPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (!canActAsParent(getUserRole(user))) redirect('/dashboard')

  const links = await prisma.familyLink.findMany({
    where: { parent_user_id: user.id },
    select: {
      child: {
        select: {
          id: true,
          user_id: true,
          display_name: true,
          avatar_config: true,
          year_group: { select: { label: true } },
        },
      },
    },
  })

  const kids = links.map((l) => l.child).filter(Boolean)

  // A sign-in address comes back only for children this parent created here.
  // A child who registered themselves keeps their real address private, even
  // from this screen, because a sibling can read it.
  const rows =
    kids.length > 0
      ? await prisma.$queryRaw<AuthUserRow[]>`
          SELECT id::text, email
          FROM auth.users
          WHERE id = ANY(${kids.map((k) => k.user_id)}::uuid[])
            AND (raw_user_meta_data->>'parent_created')::boolean = true
        `
      : []
  const emailByUserId = new Map(rows.map((r) => [r.id, r.email]))

  const children: PickerChild[] = kids.map((c) => {
    const avatar = (c.avatar_config ?? {}) as { base?: string; colour?: string }
    return {
      profileId: c.id,
      displayName: c.display_name,
      yearLabel: c.year_group?.label ?? null,
      avatarBase: avatar.base ?? null,
      avatarColour: avatar.colour ?? null,
      signInEmail: emailByUserId.get(c.user_id) ?? null,
    }
  })

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      {children.length === 0 ? (
        <div className="mx-auto max-w-sm space-y-4 text-center">
          <h1 className="font-heading text-2xl font-bold text-ink">No children yet</h1>
          <p className="text-sm text-muted">
            Set your child up first. It takes a first name and a school year.
          </p>
          <Link
            href="/dashboard/parent"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 font-heading font-bold text-white transition-colors hover:bg-brand-700"
          >
            Set up a child
          </Link>
        </div>
      ) : (
        <WhoIsLearning kids={children} />
      )}
    </main>
  )
}
