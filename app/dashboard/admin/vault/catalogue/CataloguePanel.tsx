'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CatalogueItem {
  id: string
  name: string
  description: string | null
  category: string | null
  min_milestone: string | null
  price_pence: number
  is_active: boolean
}

interface Props {
  items: CatalogueItem[]
}

export function CataloguePanel({ items }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: '', min_milestone: '', price_pence: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function createItem() {
    setSaving(true)
    setError(null)
    try {
      const pence = form.price_pence ? parseInt(form.price_pence, 10) : 0
      const res = await fetch('/api/admin/vault/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          min_milestone: form.min_milestone || undefined,
          price_pence: isNaN(pence) ? 0 : pence,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Could not create item')
        return
      }
      setForm({ name: '', description: '', category: '', min_milestone: '', price_pence: '' })
      setAdding(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: CatalogueItem) {
    setTogglingId(item.id)
    try {
      await fetch(`/api/admin/vault/catalogue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      })
      router.refresh()
    } finally {
      setTogglingId(null)
    }
  }

  const grouped: Record<string, CatalogueItem[]> = {}
  for (const item of items) {
    const cat = item.category ?? 'Uncategorised'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  return (
    <div className="space-y-5">
      {/* ── Add item ── */}
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="rounded-xl bg-brand/10 px-4 py-2 text-sm font-bold text-brand hover:bg-brand/20"
        >
          + Add prize
        </button>
      ) : (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <p className="font-heading text-sm font-bold text-ink">New prize</p>
          <input
            type="text"
            maxLength={120}
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <input
            type="text"
            maxLength={280}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={60}
              placeholder="Category (optional)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
            <select
              value={form.min_milestone}
              onChange={(e) => setForm({ ...form, min_milestone: e.target.value })}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Any milestone</option>
              <option value="bronze">Bronze+</option>
              <option value="silver">Silver+</option>
              <option value="gold">Gold+</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>
          <input
            type="number"
            min={0}
            placeholder="Price in pence (0 = free / manual)"
            value={form.price_pence}
            onChange={(e) => setForm({ ...form, price_pence: e.target.value })}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          />
          {error && <p className="text-sm text-incorrect">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setError(null) }}
              className="flex h-9 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10"
            >
              Cancel
            </button>
            <button
              onClick={createItem}
              disabled={saving || !form.name.trim()}
              className="flex h-9 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add prize'}
            </button>
          </div>
        </div>
      )}

      {/* ── Item list ── */}
      {items.length === 0 ? (
        <p className="text-sm text-muted">No prizes yet — add one above.</p>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted">{cat}</h3>
            <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-surface shadow-sm overflow-hidden">
              {catItems.map((item) => (
                <li key={item.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${!item.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted truncate">{item.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted">
                      {item.price_pence > 0 && (
                        <span>£{(item.price_pence / 100).toFixed(2)}</span>
                      )}
                      {item.min_milestone && (
                        <span className="capitalize">{item.min_milestone}+</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(item)}
                    disabled={togglingId === item.id}
                    className={`flex-none rounded-lg px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${
                      item.is_active
                        ? 'bg-correct/10 text-correct hover:bg-correct/20'
                        : 'bg-black/5 text-muted hover:bg-black/10'
                    }`}
                  >
                    {togglingId === item.id ? '…' : item.is_active ? 'Active' : 'Inactive'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
