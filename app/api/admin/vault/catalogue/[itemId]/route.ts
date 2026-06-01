import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { updateCatalogueItem } from '@/lib/vault/catalogue'

type Params = { params: { itemId: string } }

// PATCH /api/admin/vault/catalogue/[itemId]
// Update a catalogue item (name, description, category, price_pence, is_active). Admin only.
export async function PATCH(req: Request, { params }: Params) {
  const denied = await requireAdminApi()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const item = await updateCatalogueItem(
      params.itemId,
      body as Parameters<typeof updateCatalogueItem>[1],
    )
    return NextResponse.json(item)
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
