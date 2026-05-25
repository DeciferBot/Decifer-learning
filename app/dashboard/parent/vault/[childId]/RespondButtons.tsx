'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CatalogueItem {
  id: string
  name: string
  category: string | null
}

interface Props {
  requestId: string
  childName: string
  status: string
  physicalRewardsEnabled: boolean
  catalogueItems: CatalogueItem[]
}

type ApproveTab = 'family' | 'physical'

export function RespondButtons({
  requestId,
  childName,
  status,
  physicalRewardsEnabled,
  catalogueItems,
}: Props) {
  const router = useRouter()
  const [action, setAction] = useState<'approve' | 'reject' | 'counter_offer' | null>(null)
  const [approveTab, setApproveTab] = useState<ApproveTab>('family')
  const [note, setNote] = useState('')
  const [rewardLabel, setRewardLabel] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(selectedAction: 'approve' | 'reject' | 'defer' | 'counter_offer') {
    setError(null)
    setSubmitting(true)
    try {
      let body: Record<string, unknown> = { requestId, action: selectedAction }

      if (selectedAction === 'approve') {
        if (approveTab === 'physical') {
          const item = catalogueItems.find((i) => i.id === selectedItemId)
          body = {
            requestId,
            action: 'approve',
            rewardType: 'physical',
            rewardLabel: item?.name ?? '',
          }
        } else {
          body = {
            requestId,
            action: 'approve',
            rewardType: 'family',
            rewardLabel: rewardLabel || undefined,
            note: note || undefined,
          }
        }
      } else if (selectedAction === 'counter_offer') {
        body = {
          requestId,
          action: 'counter_offer',
          note: rewardLabel || undefined,
        }
      } else if (selectedAction === 'reject') {
        body = {
          requestId,
          action: 'reject',
          note: note || undefined,
        }
      }

      const res = await fetch('/api/vault/parent/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const resBody = await res.json()
        setError(resBody.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'counter_offered') {
    return (
      <div className="rounded-2xl border border-maths/20 bg-maths/5 p-4 space-y-1.5">
        <p className="font-heading text-sm font-bold text-maths">Waiting for child response</p>
        <p className="text-sm text-muted">
          Your child can accept or dismiss this counter-offer.
        </p>
      </div>
    )
  }

  if (action === 'approve') {
    return (
      <div className="space-y-3 rounded-2xl border border-correct/20 bg-correct/5 p-4">
        <p className="font-heading text-sm font-bold text-correct">Approve {childName}&apos;s request</p>

        {/* Tabs — only shown when physical is enabled and there are items */}
        {physicalRewardsEnabled && catalogueItems.length > 0 && (
          <div className="flex rounded-xl bg-black/5 p-0.5 gap-0.5">
            <button
              onClick={() => setApproveTab('family')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                approveTab === 'family'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Family reward
            </button>
            <button
              onClick={() => setApproveTab('physical')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                approveTab === 'physical'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Pick a prize
            </button>
          </div>
        )}

        {/* Family reward form */}
        {approveTab === 'family' && (
          <>
            <input
              type="text"
              maxLength={120}
              placeholder="What's the reward? (e.g. Movie night at home)"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              value={rewardLabel}
              onChange={(e) => setRewardLabel(e.target.value)}
            />
            <input
              type="text"
              maxLength={280}
              placeholder="Note to your child (optional)"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        )}

        {/* Physical prize picker */}
        {approveTab === 'physical' && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {catalogueItems.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedItemId === item.id
                    ? 'border-correct/40 bg-correct/5'
                    : 'border-black/10 bg-white hover:border-black/20'
                }`}
              >
                <input
                  type="radio"
                  name="catalogue-item"
                  value={item.id}
                  checked={selectedItemId === item.id}
                  onChange={() => setSelectedItemId(item.id)}
                  className="accent-correct"
                />
                <span className="text-sm text-ink">{item.name}</span>
                {item.category && (
                  <span className="ml-auto flex-none text-xs text-muted">{item.category}</span>
                )}
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-incorrect">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setAction(null); setApproveTab('family'); setSelectedItemId('') }}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10"
          >
            Cancel
          </button>
          <button
            onClick={() => submit('approve')}
            disabled={submitting || (approveTab === 'physical' && !selectedItemId)}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-correct text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Confirm Approve'}
          </button>
        </div>
      </div>
    )
  }

  if (action === 'counter_offer') {
    return (
      <div className="space-y-3 rounded-2xl border border-maths/20 bg-maths/5 p-4">
        <p className="font-heading text-sm font-bold text-maths">Suggest an alternative</p>
        <input
          type="text"
          maxLength={280}
          placeholder="Your suggestion (e.g. Trip to the park)"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          value={rewardLabel}
          onChange={(e) => setRewardLabel(e.target.value)}
        />
        {error && <p className="text-sm text-incorrect">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setAction(null)} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10">Cancel</button>
          <button
            onClick={() => submit('counter_offer')}
            disabled={submitting || !rewardLabel.trim()}
            className="flex h-10 flex-1 items-center justify-center rounded-xl bg-maths text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send Suggestion'}
          </button>
        </div>
      </div>
    )
  }

  if (action === 'reject') {
    return (
      <div className="space-y-3 rounded-2xl border border-incorrect/20 bg-incorrect/5 p-4">
        <p className="font-heading text-sm font-bold text-incorrect">Decline this request</p>
        <input
          type="text"
          maxLength={280}
          placeholder="Note to your child (optional)"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-incorrect">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setAction(null)} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10">Cancel</button>
          <button onClick={() => submit('reject')} disabled={submitting} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-incorrect text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
            {submitting ? 'Declining…' : 'Confirm Decline'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setAction('approve')}
        className="flex h-10 items-center gap-1 rounded-xl bg-correct/10 px-4 text-sm font-bold text-correct transition-colors hover:bg-correct/20"
      >
        ✓ Approve
      </button>
      <button
        onClick={() => submit('defer')}
        disabled={submitting}
        className="flex h-10 items-center gap-1 rounded-xl bg-black/5 px-4 text-sm font-bold text-ink transition-colors hover:bg-black/10 disabled:opacity-60"
      >
        ⏱ Save for later
      </button>
      <button
        onClick={() => setAction('counter_offer')}
        className="flex h-10 items-center gap-1 rounded-xl bg-maths/10 px-4 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
      >
        💬 Suggest different
      </button>
      <button
        onClick={() => setAction('reject')}
        className="flex h-10 items-center gap-1 rounded-xl bg-incorrect/10 px-4 text-sm font-bold text-incorrect transition-colors hover:bg-incorrect/20"
      >
        ✗ Decline
      </button>
    </div>
  )
}
