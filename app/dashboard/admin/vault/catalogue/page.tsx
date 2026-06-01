import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getAllCatalogueItems } from '@/lib/vault/catalogue'
import { CataloguePanel } from './CataloguePanel'

export const metadata = { title: 'Prize Catalogue — Vault Admin — Decifer Learning' }

export default async function AdminVaultCataloguePage() {
  await requireAdmin('/dashboard/admin/vault/catalogue')

  const items = await getAllCatalogueItems()

  const activeCount = items.filter((i) => i.is_active).length

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Prize Catalogue</h1>
          <p className="mt-0.5 text-xs text-muted">
            {activeCount} active prize{activeCount !== 1 ? 's' : ''} · {items.length} total
          </p>
        </div>
        <Link href="/dashboard/admin/vault" className="text-sm text-muted hover:text-ink">← Vault</Link>
      </div>

      <div className="rounded-2xl border border-points-gold/20 bg-points-gold/5 p-4 text-sm text-muted">
        <strong className="text-ink">Admin note:</strong> Price information is for admin reference only and is never
        shown to children or parents. Physical prizes require manual fulfilment — no automated ordering in Stage 2.
      </div>

      <CataloguePanel items={items} />
    </section>
  )
}
