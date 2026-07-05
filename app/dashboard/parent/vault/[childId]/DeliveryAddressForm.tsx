'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DeliveryAddress {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  postcode: string
  country: string
}

interface Props {
  childId: string
  initialAddress: DeliveryAddress | null
}

const EMPTY: DeliveryAddress = {
  firstName: '', lastName: '', address1: '', address2: '', city: '', postcode: '', country: 'GB',
}

export function DeliveryAddressForm({ childId, initialAddress }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<DeliveryAddress>(initialAddress ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: keyof DeliveryAddress) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value })
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {initialAddress ? (
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-muted leading-snug">
              <p className="text-ink font-semibold">{initialAddress.firstName} {initialAddress.lastName}</p>
              <p>{initialAddress.address1}</p>
              {initialAddress.address2 && <p>{initialAddress.address2}</p>}
              <p>{initialAddress.city}, {initialAddress.postcode}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex-none text-xs text-muted hover:text-ink underline underline-offset-2 whitespace-nowrap"
            >
              Edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-brand hover:text-brand/80 underline underline-offset-2"
          >
            + Add delivery address
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
      <p className="text-xs font-bold text-ink">Delivery address</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="First name *"
          maxLength={60}
          value={form.firstName}
          onChange={field('firstName')}
          className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <input
          type="text"
          placeholder="Last name *"
          maxLength={60}
          value={form.lastName}
          onChange={field('lastName')}
          className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>
      <input
        type="text"
        placeholder="Address line 1 *"
        maxLength={120}
        value={form.address1}
        onChange={field('address1')}
        className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
      />
      <input
        type="text"
        placeholder="Address line 2 (optional)"
        maxLength={120}
        value={form.address2 ?? ''}
        onChange={field('address2')}
        className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="City / Town *"
          maxLength={60}
          value={form.city}
          onChange={field('city')}
          className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <input
          type="text"
          placeholder="Postcode *"
          maxLength={10}
          value={form.postcode}
          onChange={field('postcode')}
          className="rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
      </div>
      <select
        value={form.country}
        onChange={field('country')}
        className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
      >
        <option value="GB">United Kingdom</option>
        <option value="IE">Ireland</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="AU">Australia</option>
        <option value="NZ">New Zealand</option>
      </select>

      {error && <p className="text-sm text-incorrect">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setEditing(false)
            setForm(initialAddress ?? EMPTY)
            setError(null)
          }}
          className="flex h-9 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            const required = [form.firstName, form.lastName, form.address1, form.city, form.postcode]
            if (required.some((v) => !v.trim())) {
              setError('Please fill in all required fields')
              return
            }
            setSaving(true)
            setError(null)
            try {
              const res = await fetch(`/api/vault/parent/settings/${childId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deliveryAddress: {
                    firstName: form.firstName.trim(),
                    lastName:  form.lastName.trim(),
                    address1:  form.address1.trim(),
                    address2:  form.address2?.trim() || undefined,
                    city:      form.city.trim(),
                    postcode:  form.postcode.trim().toUpperCase(),
                    country:   form.country,
                  },
                }),
              })
              if (!res.ok) {
                const body = await res.json()
                setError(body.error ?? 'Could not save, please try again')
                return
              }
              setEditing(false)
              router.refresh()  // background — form already closed
            } finally {
              setSaving(false)
            }
          }}
          disabled={saving}
          className="flex h-9 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save address'}
        </button>
      </div>
    </div>
  )
}
