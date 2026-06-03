// POST /api/push/subscribe  — save a push subscription for the current child
// DELETE /api/push/subscribe — remove it

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

type SubscriptionBody = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({ where: { user_id: user.id }, select: { id: true, role: true } })
  if (!profile || profile.role !== 'child') return NextResponse.json({ error: 'Children only' }, { status: 403 })

  let body: SubscriptionBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  await supabase.from('push_subscriptions').upsert(
    { profile_id: profile.id, endpoint, keys },
    { onConflict: 'profile_id,endpoint' }
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({ where: { user_id: user.id }, select: { id: true } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { endpoint: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  await supabase.from('push_subscriptions').delete()
    .eq('profile_id', profile.id)
    .eq('endpoint', body.endpoint)

  return NextResponse.json({ ok: true })
}
