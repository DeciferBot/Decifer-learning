// POST /api/cron/streak-nudge
// Vercel Cron — runs daily at 18:00 UTC.
// Sends a push notification to children who have a streak ≥ 1 but haven't logged in today.
//
// The threshold was 3. Nobody on this product has ever reached a streak of 5, so
// a bar of 3 meant almost every at-risk streak was invisible to this job. Day 2
// is exactly when a streak is most fragile and most worth saving.
const MIN_STREAK_TO_NUDGE = 1

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

  // A round is what keeps the streak, so "at risk" means no round today — not
  // merely "hasn't opened the app". A child who browsed but never played is
  // exactly who this nudge is for.
  const todayStr = new Date().toISOString().slice(0, 10)

  // Find children with a live streak who haven't been active today
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, streak_days, last_round_on')
    .eq('role', 'child')
    .gte('streak_days', MIN_STREAK_TO_NUDGE)
    .or(`last_round_on.is.null,last_round_on.lt.${todayStr}`)

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
          // The ask has to match what the app now asks for. One round is about
          // two minutes, and saying so is the difference between a nudge that
          // sounds like homework and one that sounds doable before bed.
          body: `${name}, one 2-minute round keeps your streak alive.`,
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
