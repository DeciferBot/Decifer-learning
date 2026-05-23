// Reward Vault — commerce adapter interface and Stage 1 null implementation.
// Stage 3 adds ShopifyAdapter in lib/vault/shopify-adapter.ts implementing this interface.
// NEVER import Shopify or Amazon libraries here or in any Stage 1 file.

export interface ApprovedRequest {
  requestId: string
  childProfileId: string
  rewardLabel: string | null
  milestoneBand: string
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
