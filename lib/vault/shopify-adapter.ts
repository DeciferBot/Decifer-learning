// Reward Vault Stage 3 — Shopify commerce adapter.
// Implements CommerceAdapter via Shopify Admin API (draft orders).
// Active when SHOPIFY_ADMIN_ACCESS_TOKEN + SHOPIFY_STORE_DOMAIN are set.
// Falls back to NullCommerceAdapter when env vars are absent (see requests.ts).
//
// SAFETY: this file must never be imported by child-facing routes or lib files.
// Child sessions must never receive Shopify order IDs, URLs, or pricing data.

import type { CommerceAdapter, ApprovedRequest, CommerceOrderResult, CommerceOrderStatus } from './commerce-adapter'

const SHOPIFY_API_VERSION = '2024-01'

export class ShopifyAdapter implements CommerceAdapter {
  private readonly storeDomain: string
  private readonly accessToken: string
  private readonly baseUrl: string

  constructor(storeDomain: string, accessToken: string) {
    this.storeDomain = storeDomain
    this.accessToken = accessToken
    this.baseUrl = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}`
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
    }
  }

  async createOrder(request: ApprovedRequest): Promise<CommerceOrderResult> {
    // Build line items — use shopifyVariantId if set, otherwise custom line item
    const lineItems = request.shopifyVariantId
      ? [
          {
            variant_id: parseInt(request.shopifyVariantId, 10),
            quantity: 1,
            title: request.rewardLabel ?? 'Reward prize',
          },
        ]
      : [
          {
            title: request.rewardLabel ?? 'Reward prize',
            price: '0.00',
            quantity: 1,
            requires_shipping: true,
          },
        ]

    const draftOrderPayload: Record<string, unknown> = {
      draft_order: {
        line_items: lineItems,
        note: `Decifer Learning reward — milestone: ${request.milestoneBand} — request: ${request.requestId}`,
        tags: ['decifer-learning', `milestone:${request.milestoneBand}`],
        ...(request.deliveryAddress && {
          shipping_address: {
            first_name: request.deliveryAddress.firstName,
            last_name:  request.deliveryAddress.lastName,
            address1:   request.deliveryAddress.address1,
            address2:   request.deliveryAddress.address2 ?? '',
            city:       request.deliveryAddress.city,
            zip:        request.deliveryAddress.postcode,
            country:    request.deliveryAddress.country,
          },
        }),
      },
    }

    const res = await fetch(`${this.baseUrl}/draft_orders.json`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(draftOrderPayload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Shopify draft order creation failed (${res.status}): ${errorText}`)
    }

    const data = (await res.json()) as { draft_order: { id: number; invoice_url?: string; order_number?: number } }
    const draftOrder = data.draft_order

    return {
      externalOrderId: String(draftOrder.id),
      status: 'created',
      message: `Shopify draft order created (id: ${draftOrder.id})`,
    }
  }

  async getOrderStatus(externalOrderId: string): Promise<CommerceOrderStatus> {
    const res = await fetch(`${this.baseUrl}/draft_orders/${externalOrderId}.json`, {
      headers: this.headers,
    })

    if (!res.ok) return { status: 'unknown' }

    const data = (await res.json()) as { draft_order?: { status: string } }
    if (!data.draft_order) return { status: 'unknown' }

    const shopifyStatus = data.draft_order.status
    const statusMap: Record<string, CommerceOrderStatus['status']> = {
      open:           'pending',
      invoice_sent:   'processing',
      completed:      'processing',
    }
    return { status: statusMap[shopifyStatus] ?? 'pending' }
  }
}
