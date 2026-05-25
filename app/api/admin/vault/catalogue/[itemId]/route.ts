import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { updateCatalogueItem } from '@/lib/vault/catalogue'

type Params = { params: { itemId: string } }

// PATCH /api/admin/vault/catalogue/[itemId]
// Update a catalogue item (name, description, category, price_pence, is_active). Admin only.
export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getUserRole(user) !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
