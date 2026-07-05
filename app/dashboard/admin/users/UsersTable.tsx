'use client'

import { useMemo, useState, useCallback } from 'react'
import { Search, Package, X } from '@/components/ui/icons'
import { MVP_YEAR_GROUPS } from '@/lib/auth/roles'

export type UserRow = {
  id: string       // profile id
  userId: string   // auth user id — used for deletion
  name: string
  email: string | null
  role: 'child' | 'parent' | 'admin'
  yearGroup: string | null       // display string, e.g. "Year 3"
  yearGroupLabel: string | null  // label, e.g. "year-3" — drives the edit select
  points: number
  streak: number
  lastActive: string
  lastActiveTs: number
  joined: string
  joinedTs: number
  relation: string
}

type RoleFilter = 'all' | 'child' | 'parent' | 'admin'
type SortKey = 'joined' | 'active' | 'points'

const ROLE_STYLES: Record<UserRow['role'], string> = {
  child:  'bg-brand/10 text-brand',
  parent: 'bg-correct/15 text-correct',
  admin:  'bg-lightning/20 text-ink',
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const [query, setQuery]           = useState('')
  const [role, setRole]             = useState<RoleFilter>('all')
  const [sort, setSort]             = useState<SortKey>('joined')
  const [deletingId, setDeletingId] = useState<string | null>(null)  // userId being confirmed
  const [busyId, setBusyId]         = useState<string | null>(null)   // userId mid-delete
  const [localRows, setLocalRows]   = useState(rows)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = localRows.filter((r) => {
      if (role !== 'all' && r.role !== role) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        (r.yearGroup?.toLowerCase().includes(q) ?? false)
      )
    })
    return [...out].sort((a, b) => {
      if (sort === 'points') return b.points - a.points
      if (sort === 'active') return b.lastActiveTs - a.lastActiveTs
      return b.joinedTs - a.joinedTs
    })
  }, [localRows, query, role, sort])

  const [yearBusyId, setYearBusyId] = useState<string | null>(null) // userId mid-year-change

  const confirmDelete = useCallback((userId: string) => setDeletingId(userId), [])
  const cancelDelete  = useCallback(() => setDeletingId(null), [])

  // Fix a mis-registered year group (e.g. a kid who signed up as Y7 but is in Y3).
  async function changeYearGroup(userId: string, yearGroup: string) {
    setYearBusyId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearGroup }),
      })
      if (res.ok) {
        const display = MVP_YEAR_GROUPS.find((y) => y.label === yearGroup)?.display ?? yearGroup
        setLocalRows((prev) =>
          prev.map((r) => (r.userId === userId ? { ...r, yearGroup: display, yearGroupLabel: yearGroup } : r)),
        )
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        alert(data.error ?? 'Year group change failed. Try again.')
      }
    } catch {
      alert('Network error. Try again.')
    } finally {
      setYearBusyId(null)
    }
  }

  async function executeDelete(userId: string) {
    setBusyId(userId)
    setDeletingId(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setLocalRows((prev) => prev.filter((r) => r.userId !== userId))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        alert(data.error ?? 'Delete failed. Try again.')
      }
    } catch {
      alert('Network error. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  function exportCsv() {
    const headers = ['Name', 'Email', 'Role', 'Year group', 'Points', 'Streak', 'Last active', 'Joined', 'Link']
    const cell = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      headers.join(','),
      ...filtered.map((r) =>
        [r.name, r.email ?? '', r.role, r.yearGroup ?? '', r.points, r.streak, r.lastActive, r.joined, r.relation]
          .map(cell).join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'decifer-users.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filters: { key: RoleFilter; label: string }[] = [
    { key: 'all',    label: 'All'      },
    { key: 'child',  label: 'Children' },
    { key: 'parent', label: 'Parents'  },
    { key: 'admin',  label: 'Admins'   },
  ]
  const sorts: { key: SortKey; label: string }[] = [
    { key: 'joined', label: 'Newest'           },
    { key: 'active', label: 'Recently active'  },
    { key: 'points', label: 'Top points'       },
  ]

  // Find the row being confirmed so we can show their name
  const pendingRow = deletingId ? localRows.find((r) => r.userId === deletingId) : null

  return (
    <div className="space-y-3">
      {/* Delete confirmation modal */}
      {deletingId && pendingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl space-y-4">
            <h2 className="font-heading text-lg font-bold text-ink">Delete {pendingRow.name}?</h2>
            <p className="text-sm text-muted">
              This permanently removes their account, all quiz history, progress, and points.
              It <strong className="text-ink">cannot be undone</strong>.
            </p>
            {pendingRow.email && <p className="text-xs text-muted font-mono">{pendingRow.email}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={cancelDelete}
                className="flex-1 min-h-[44px] rounded-xl border border-black/10 text-sm font-medium text-ink hover:bg-black/[0.03]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDelete(deletingId)}
                className="flex-1 min-h-[44px] rounded-xl bg-incorrect text-sm font-semibold text-white hover:bg-incorrect/90"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, year…"
            aria-label="Search users"
            className="w-full min-h-[44px] rounded-xl border border-black/10 bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort users"
          className="min-h-[44px] rounded-xl border border-black/10 bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
        >
          {sorts.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-black/[0.03] disabled:opacity-50"
        >
          <Package className="w-4 h-4" aria-hidden /> Export CSV
        </button>
      </div>

      {/* Role filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = role === f.key
          const count  = f.key === 'all' ? localRows.length : localRows.filter((r) => r.role === f.key).length
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setRole(f.key)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors ${
                active ? 'bg-brand text-white' : 'bg-black/[0.04] text-muted hover:bg-black/[0.07]'
              }`}
            >
              {f.label} <span className={active ? 'opacity-80' : 'opacity-60'}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">No users match your filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-surface shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium text-right">Streak</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((r) => (
                <tr key={r.id} className={`hover:bg-black/[0.02] ${busyId === r.userId ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink whitespace-nowrap">{r.name}</p>
                    {r.email && <p className="text-xs text-muted whitespace-nowrap">{r.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[r.role]}`}>
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {r.role === 'child' && r.yearGroupLabel ? (
                      <select
                        value={r.yearGroupLabel}
                        onChange={(e) => changeYearGroup(r.userId, e.target.value)}
                        disabled={yearBusyId === r.userId}
                        aria-label={`Year group for ${r.name}`}
                        className="min-h-[36px] rounded-lg border border-black/10 bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50"
                      >
                        {MVP_YEAR_GROUPS.map((y) => (
                          <option key={y.label} value={y.label}>{y.display}</option>
                        ))}
                      </select>
                    ) : (
                      r.yearGroup ?? '–'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink">{r.points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink">{r.streak}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{r.lastActive}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{r.joined}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{r.relation}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => confirmDelete(r.userId)}
                      disabled={busyId === r.userId || r.role === 'admin'}
                      title={r.role === 'admin' ? 'Cannot delete admin' : `Delete ${r.name}`}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-incorrect/10 hover:text-incorrect disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
