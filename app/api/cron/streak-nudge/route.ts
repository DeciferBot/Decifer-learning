// POST /api/cron/streak-nudge
// Vercel Cron — runs daily at 18:00 UTC.
// Sends a push notification to children who have a streak ≥ 3 but haven't logged in today.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Vercel Cron invokes the path with a GET request (and an Authorization: Bearer <CRON_SECRET>
// header when CRON_SECRET is configured). POST stays exported for manual/local invocation.
async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 })

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:hello@deciferlearning.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY,
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Find children with streak ≥ 3 who haven't been active today
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, streak_days, last_active')
    .eq('role', 'child')
    .gte('streak_days', 3)
    .lt('last_active', todayStart.toISOString())

  if (!profiles?.length) return NextResponse.json({ sent: 0, reason: 'no at-risk streaks' })

  const profileIds = profiles.map((p) => p.id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('profile_id, endpoint, keys')
    .in('profile_id', profileIds)

  let sent = 0
  const errors: string[] = []

  for (const sub of subs ?? []) {
    const profile = profiles.find((p) => p.id === sub.profile_id)
    if (!profile) continue
    const name = profile.display_name ?? 'there'
    const streak = profile.streak_days ?? 0

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify({
          title: `🔥 ${streak}-day streak at risk!`,
          body: `${name}, log in before midnight to keep your streak alive.`,
          icon: '/icon-192.png',
          url: '/dashboard/child',
          tag: 'streak-nudge',
        }),
      )
      sent++
    } catch (err: unknown) {
      // 410 Gone = subscription expired, clean it up
      if (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await supabase.from('push_subscriptions').delete()
          .eq('profile_id', sub.profile_id).eq('endpoint', sub.endpoint)
      } else {
        errors.push(String(err))
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.slice(0, 5) })
}

export const GET = handler
export const POST = handler
