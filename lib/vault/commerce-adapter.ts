// Reward Vault — commerce adapter interface.
// Stage 1-2: NullCommerceAdapter (manual fulfilment, no-op).
// Stage 3: ShopifyAdapter in lib/vault/shopify-adapter.ts — same interface, zero routing changes.

/** Delivery address for physical reward fulfilment. UK-centric (postcode / country). */
export interface DeliveryAddress {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  postcode: string
  country: string   // ISO 3166-1 alpha-2, e.g. 'GB'
}

export interface ApprovedRequest {
  requestId: string
  childProfileId: string
  rewardLabel: string | null
  milestoneBand: string
  // Stage 3+ fields — optional; NullCommerceAdapter ignores these
  shopifyVariantId?: string | null
  deliveryAddress?: DeliveryAddress | null
}

export interface CommerceOrderResult {
  externalOrderId: string | null
  status: 'manual' | 'pending' | 'created'
  message: string
}

export interface CommerceOrderStatus {
  status: 'unknown' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
}

export interface CommerceAdapter {
  createOrder(request: ApprovedRequest): Promise<CommerceOrderResult>
  getOrderStatus(externalOrderId: string): Promise<CommerceOrderStatus>
}

// Stage 1: no-op adapter. Physical reward fulfilment is manual.
// Replace with ShopifyAdapter in Stage 3 — routing code does not change.
export class NullCommerceAdapter implements CommerceAdapter {
  async createOrder(_request: ApprovedRequest): Promise<CommerceOrderResult> {
    return {
      externalOrderId: null,
      status: 'manual',
      message: 'Manual fulfilment — no commerce adapter active',
    }
  }

  async getOrderStatus(_externalOrderId: string): Promise<CommerceOrderStatus> {
    return { status: 'unknown' }
  }
}
