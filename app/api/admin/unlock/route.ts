// POST   /api/admin/unlock — verify the admin password, set the gate cookie.
// DELETE /api/admin/unlock — lock again (clear the gate cookie).
//
// Public route (see middleware allow-list): this is where the password is entered,
// so it cannot itself sit behind the gate.

import { NextResponse } from 'next/server'
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_MAX_AGE,
  expectedGateToken,
  verifyAdminPassword,
} from '@/lib/auth/admin-gate'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!process.env.ADMIN_DASHBOARD_PASSWORD) {
    return NextResponse.json(
      { error: 'Admin password is not configured on the server.', code: 'NOT_CONFIGURED' },
      { status: 500 },
    )
  }

  let body: { password?: string }
  try {
    body = (await req.json()) as { password?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const password = (body.password ?? '').trim()
  if (!password) {
    return NextResponse.json({ error: 'Password is required', code: 'MISSING_PASSWORD' }, { status: 422 })
  }

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: 'Incorrect password', code: 'BAD_PASSWORD' }, { status: 401 })
  }

  const token = await expectedGateToken()
  if (!token) {
    return NextResponse.json({ error: 'Gate misconfigured', code: 'NOT_CONFIGURED' }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_GATE_MAX_AGE,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_GATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
