// Reward Vault Stage 3 — Shopify webhook handler.
// Receives order fulfillment events from Shopify and updates RewardFulfilment status.
// Validates HMAC-SHA256 signature using SHOPIFY_WEBHOOK_SECRET.
//
// SAFETY: never exposes order data to child routes. Writes to reward_fulfilments only.

import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? ''

/** Validate Shopify HMAC-SHA256 signature using a timing-safe comparison. */
function validateSignature(rawBody: string, hmacHeader: string): boolean {
  if (!WEBHOOK_SECRET || !hmacHeader) return false
  const computed = createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64')
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader))
  } catch {
    return false   // buffers differ in length — definitely invalid
  }
}

export async function POST(req: Request) {
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? ''
  const topic = req.headers.get('x-shopify-topic') ?? ''

  const rawBody = await req.text()

  if (!validateSignature(rawBody, hmacHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── draft_orders/completed: draft order → real order ───────────────────────
  if (topic === 'draft_orders/completed') {
    const draftOrderId = String(payload.id ?? '')
    const orderId = String((payload as { order_id?: unknown }).order_id ?? '')
    const orderStatusUrl = String((payload as { order_status_url?: unknown }).order_status_url ?? '')

    if (draftOrderId && orderId) {
      await prisma.rewardFulfilment.updateMany({
        where: { shopify_order_id: draftOrderId },
        data: {
          shopify_order_id:  orderId,
          shopify_order_url: orderStatusUrl || null,
        },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── orders/fulfilled: fulfilment dispatched ────────────────────────────────
  if (topic === 'orders/fulfilled') {
    const orderId = String(payload.id ?? '')
    const fulfilments = (payload as { fulfillments?: Array<{ tracking_number?: string }> }).fulfillments ?? []
    const trackingNumber = fulfilments[0]?.tracking_number ?? null

    if (orderId) {
      await prisma.rewardFulfilment.updateMany({
        where: { shopify_order_id: orderId },
        data: {
          status: 'dispatched',
          ...(trackingNumber && { tracking_number: trackingNumber }),
        },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── fulfillments/tracking_info_updated: tracking number update ────────────
  if (topic === 'fulfillments/tracking_info_updated') {
    const trackingNumber = String(
      (payload as { tracking_number?: unknown }).tracking_number ?? '',
    )
    const orderId = String(
      (payload as { order_id?: unknown }).order_id ?? '',
    )
    if (orderId && trackingNumber) {
      await prisma.rewardFulfilment.updateMany({
        where: { shopify_order_id: orderId },
        data: { tracking_number: trackingNumber },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // Unknown topic — accept silently (Shopify retries on non-2xx)
  return NextResponse.json({ ok: true, ignored: true })
}
