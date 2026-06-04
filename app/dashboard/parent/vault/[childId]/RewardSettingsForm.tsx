'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  childId: string
  initialOptions: Array<{ label: string }>
}

export function RewardSettingsForm({ childId, initialOptions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [options, setOptions] = useState<string[]>(initialOptions.map((o) => o.label))
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addOption() {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    setOptions([...options, trimmed])
    setNewOption('')
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted hover:text-ink underline underline-offset-2"
      >
        Edit ideas
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
      {options.length === 0 && (
        <p className="text-xs text-muted">No ideas yet — add one below.</p>
      )}
      {options.length > 0 && (
        <ul className="space-y-1.5">
          {options.map((label, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ink">{label}</span>
              <button
                onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                className="text-xs text-muted hover:text-incorrect"
                aria-label={`Remove ${label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          maxLength={80}
          placeholder="Add a reward idea…"
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addOption()
            }
          }}
          className="flex-1 min-w-0 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <button
          onClick={addOption}
          disabled={!newOption.trim()}
          className="rounded-xl bg-brand/10 px-3 text-sm font-bold text-brand hover:bg-brand/20 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && <p className="text-sm text-incorrect">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setEditing(false)
            setOptions(initialOptions.map((o) => o.label))
            setError(null)
          }}
          className="flex h-9 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink hover:bg-black/10"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              const res = await fetch(`/api/vault/parent/settings/${childId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  familyRewardOptions: options.map((label) => ({ label })),
                }),
              })
              if (!res.ok) {
                const body = await res.json()
                setError(body.error ?? 'Could not save — please try again')
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
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
