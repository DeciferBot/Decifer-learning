'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AVATARS, BUDDIES } from '@/lib/customise-config'
import { AVATAR_ICONS, BUDDY_ICONS } from '@/lib/icon-tokens'
import { Check } from '@/components/ui/icons'

const COLOURS = [
  { id: 'blue',   label: 'Blue',   hex: '#6C9EFF' },
  { id: 'pink',   label: 'Pink',   hex: '#FF8FAB' },
  { id: 'green',  label: 'Green',  hex: '#52D9A0' },
  { id: 'gold',   label: 'Gold',   hex: '#FFC107' },
  { id: 'purple', label: 'Purple', hex: '#9B59B6' },
  { id: 'orange', label: 'Orange', hex: '#FF8C00' },
] as const

const THEMES = [
  { id: 'default', label: 'Classic',    bg: '#FAFBFF', accent: '#6C9EFF' },
  { id: 'maths',   label: 'Maths',      bg: '#EFF4FF', accent: '#6C9EFF' },
  { id: 'english', label: 'English',    bg: '#FFF0F5', accent: '#FF8FAB' },
  { id: 'science', label: 'Science',    bg: '#EDFFF7', accent: '#52D9A0' },
  { id: 'night',   label: 'Night mode', bg: '#1A1D2E', accent: '#9B59B6' },
] as const

interface Profile {
  avatarBase:   string
  avatarColour: string
  theme:        string
  studyBuddy:   string | null
}

export default function CustomisePage() {
  const router   = useRouter()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)

  // local working state
  const [avatarBase,   setAvatarBase]   = useState('explorer')
  const [avatarColour, setAvatarColour] = useState('blue')
  const [theme,        setTheme]        = useState('default')
  const [buddy,        setBuddy]        = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile/me')
      .then((r) => r.json())
      .then((d: { profile?: Profile }) => {
        if (d.profile) {
          setProfile(d.profile)
          setAvatarBase(d.profile.avatarBase   || 'explorer')
          setAvatarColour(d.profile.avatarColour || 'blue')
          setTheme(d.profile.theme             || 'default')
          setBuddy(d.profile.studyBuddy        ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/profile/customise', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarBase, avatarColour, theme, studyBuddy: buddy }),
    })
    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  const AvatarIcon = AVATAR_ICONS[avatarBase] ?? AVATAR_ICONS.explorer
  const colourHex  = COLOURS.find((c) => c.id === avatarColour)?.hex ?? '#6C9EFF'

  return (
    <div className="max-w-lg mx-auto px-4 space-y-6 pb-10">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink">Customise</h1>
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Back
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center flex-none"
          style={{ backgroundColor: colourHex + '33', border: `3px solid ${colourHex}`, color: colourHex }}
        >
          <AvatarIcon size={32} aria-hidden />
        </div>
        <div>
          <p className="font-heading font-bold text-ink text-base">Your avatar</p>
          <p className="text-xs text-muted mt-0.5">
            {buddy ? `Study buddy: ${BUDDIES.find((b) => b.id === buddy)?.name}` : 'No study buddy selected'}
          </p>
        </div>
      </div>

      {/* Avatar character */}
      <Section title="Avatar character">
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((a) => {
            const Icon = AVATAR_ICONS[a.id]
            return (
              <button
                key={a.id}
                onClick={() => setAvatarBase(a.id)}
                className={`flex h-14 items-center justify-center rounded-2xl border transition-all ${
                  avatarBase === a.id
                    ? 'border-brand bg-brand/10 shadow-sm scale-105 text-brand'
                    : 'border-black/10 bg-black/[0.02] hover:border-brand/40 text-muted'
                }`}
                aria-label={a.name}
              >
                <Icon size={24} aria-hidden />
              </button>
            )
          })}
        </div>
      </Section>

      {/* Avatar colour */}
      <Section title="Accent colour">
        <div className="flex gap-3 flex-wrap">
          {COLOURS.map((c) => (
            <button
              key={c.id}
              onClick={() => setAvatarColour(c.id)}
              aria-label={c.label}
              className={`h-10 w-10 rounded-full border-2 transition-transform ${
                avatarColour === c.id ? 'scale-125 border-ink' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </Section>

      {/* Theme */}
      <Section title="Theme">
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl border p-2 transition-all ${
                theme === t.id
                  ? 'border-brand bg-brand/10 shadow-sm'
                  : 'border-black/10 bg-black/[0.02] hover:border-brand/40'
              }`}
            >
              <div
                className="h-7 w-7 rounded-lg border border-black/10"
                style={{ backgroundColor: t.bg }}
              />
              <span className="text-[10px] font-medium text-muted leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Study buddy */}
      <Section title="Study buddy">
        <div className="grid grid-cols-4 gap-2">
          {BUDDIES.map((b) => {
            const Icon = BUDDY_ICONS[b.id]
            return (
              <button
                key={b.id}
                onClick={() => setBuddy(buddy === b.id ? null : b.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition-all ${
                  buddy === b.id
                    ? 'border-brand bg-brand/10 shadow-sm scale-105 text-brand'
                    : 'border-black/10 bg-black/[0.02] hover:border-brand/40 text-muted'
                }`}
              >
                <Icon size={24} aria-hidden />
                <span className="text-[10px] font-medium text-muted">{b.name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-2xl bg-brand py-4 font-heading font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {saving ? 'Saving…' : saved
          ? <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" aria-hidden /> Saved!</span>
          : 'Save changes'
        }
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  )
}
