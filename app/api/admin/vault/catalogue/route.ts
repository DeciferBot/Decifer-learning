import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { getAllCatalogueItems, createCatalogueItem } from '@/lib/vault/catalogue'

// GET /api/admin/vault/catalogue
// Returns all catalogue items (including inactive). Admin only.
// price_pence is included — this route is admin-facing, never child-facing.
export async function GET(req: Request) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === 'true'

  if (activeOnly) {
    const { getActiveCatalogueItems } = await import('@/lib/vault/catalogue')
    const items = await getActiveCatalogueItems()
    return NextResponse.json(items)
  }

  const items = await getAllCatalogueItems()
  return NextResponse.json(items)
}

// POST /api/admin/vault/catalogue
// Create a new catalogue item. Admin only.
export async function POST(req: Request) {
  const denied = await requireAdminApi()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const item = await createCatalogueItem(body as Parameters<typeof createCatalogueItem>[0])
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
