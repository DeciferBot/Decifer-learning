'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DeciferAvatar } from '@/components/ui/DeciferAvatar'
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLOURS, EYE_STYLES, ACCESSORIES, OUTFIT_COLOURS,
  DEFAULT_AVATAR_CONFIG, isUnlocked,
  type AvatarConfig, type SkinTone, type HairStyle, type HairColour, type EyeStyle, type Accessory,
} from '@/lib/avatar-catalogue'
import { BUDDIES } from '@/lib/customise-config'
import { BUDDY_ICONS } from '@/lib/icon-tokens'
import { Check, Lock } from '@/components/ui/icons'
import {
  FAVOURITE_SUBJECTS, INTERESTS, LEARN_STYLES,
  CONFIDENCE_AREAS, CONFIDENCE_LEVELS,
  type LearningProfile,
} from '@/lib/onboarding-config'
import type { ComponentType, SVGProps } from 'react'
import { Target, BookOpen, FlaskConical, Search, Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil, Eye, Zap, TrendingUp, Star, Trophy } from '@/components/ui/icons'

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
const CHOICE_ICONS: Record<string, IconComp> = { Target, BookOpen, FlaskConical, Search, Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil, Eye, Zap, TrendingUp, Star, Trophy }

const THEMES = [
  { id: 'default', label: 'Classic',    bg: '#FAFBFF', accent: '#6C9EFF' },
  { id: 'maths',   label: 'Maths',      bg: '#EFF4FF', accent: '#6C9EFF' },
  { id: 'english', label: 'English',    bg: '#FFF0F5', accent: '#FF8FAB' },
  { id: 'science', label: 'Science',    bg: '#EDFFF7', accent: '#52D9A0' },
  { id: 'night',   label: 'Night',      bg: '#131734', accent: '#FF7A4D' },
] as const

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomisePage() {
  const router = useRouter()
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)

  // Avatar
  const [avatarCfg, setAvatarCfg] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG)

  // Decor
  const [theme,  setTheme]  = useState('default')
  const [buddy,  setBuddy]  = useState<string | null>(null)

  // About me
  const [favSubject,  setFavSubject]  = useState<string | null>(null)
  const [interests,   setInterests]   = useState<string[]>([])
  const [learnStyles, setLearnStyles] = useState<string[]>([])
  const [confidence,  setConfidence]  = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/profile/me')
      .then((r) => r.json())
      .then((d: { profile?: {
        avatarConfig?: Partial<AvatarConfig>
        theme?: string
        studyBuddy?: string | null
        learningProfile?: LearningProfile
        totalPoints?: number
      } }) => {
        if (!d.profile) return
        if (d.profile.avatarConfig) {
          setAvatarCfg({ ...DEFAULT_AVATAR_CONFIG, ...d.profile.avatarConfig })
        }
        setTheme(d.profile.theme ?? 'default')
        setBuddy(d.profile.studyBuddy ?? null)
        setTotalPoints(d.profile.totalPoints ?? 0)
        const lp = d.profile.learningProfile ?? {}
        setFavSubject(lp.favourite_subject ?? null)
        setInterests(lp.interests ?? [])
        setLearnStyles(lp.learn_styles ?? [])
        setConfidence((lp.confidence as Record<string, number>) ?? {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function setAvatar<K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) {
    setAvatarCfg((prev) => ({ ...prev, [key]: val }))
  }

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const learningProfile: Record<string, unknown> = {}
    if (favSubject)          learningProfile.favourite_subject = favSubject
    if (interests.length)    learningProfile.interests = interests
    if (learnStyles.length)  learningProfile.learn_styles = learnStyles
    if (Object.keys(confidence).length) learningProfile.confidence = confidence

    fetch('/api/profile/customise', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarConfig: avatarCfg, theme, studyBuddy: buddy, learningProfile }),
    })
      .then((r) => { if (r.ok) { setSaved(true); router.refresh() } })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 space-y-6 pb-10">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink">My Avatar</h1>
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">← Back</button>
      </div>

      {/* ── Preview ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface shadow-sm p-6 flex flex-col items-center gap-3">
        <DeciferAvatar config={avatarCfg} size={120} />
        <p className="font-heading font-bold text-ink text-lg">{buddy ? `+ ${BUDDIES.find((b) => b.id === buddy)?.name}` : 'Your Decifer character'}</p>
        <p className="text-xs text-muted">{totalPoints.toLocaleString()} XP earned · more unlocks as you learn</p>
      </div>

      {/* ── Skin tone ─────────────────────────────────────── */}
      <Section title="Skin tone">
        <div className="flex gap-3 flex-wrap">
          {SKIN_TONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setAvatar('skinTone', s.id as SkinTone)}
              aria-label={s.name}
              aria-pressed={avatarCfg.skinTone === s.id}
              className={`h-10 w-10 rounded-full border-2 transition-transform ${
                avatarCfg.skinTone === s.id ? 'scale-125 border-ink shadow-md' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: s.swatch }}
            />
          ))}
        </div>
      </Section>

      {/* ── Hair style ────────────────────────────────────── */}
      <Section title="Hair style">
        <div className="grid grid-cols-4 gap-2">
          {HAIR_STYLES.map((s) => {
            const unlocked = isUnlocked(s.unlock, totalPoints)
            const selected = avatarCfg.hairStyle === s.id
            return (
              <button
                key={s.id}
                onClick={() => unlocked && setAvatar('hairStyle', s.id as HairStyle)}
                aria-pressed={selected}
                disabled={!unlocked}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-1 transition-all ${
                  selected    ? 'border-brand bg-brand/10 shadow-sm scale-105'
                  : unlocked  ? 'border-black/10 bg-black/[0.02] hover:border-brand/40'
                              : 'border-black/5 bg-black/[0.02] opacity-50 cursor-not-allowed'
                }`}
              >
                <DeciferAvatar
                  config={{ ...avatarCfg, hairStyle: s.id as HairStyle }}
                  size={44}
                />
                <span className={`text-[10px] font-semibold leading-tight ${selected ? 'text-brand' : 'text-muted'}`}>
                  {s.name}
                </span>
                {!unlocked && (
                  <span className="absolute top-1 right-1 flex items-center gap-0.5 text-[9px] text-muted font-bold">
                    <Lock className="w-2.5 h-2.5" />{s.unlock!.xp >= 1000 ? `${(s.unlock!.xp / 1000).toFixed(1)}k` : s.unlock!.xp}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Hair colour ───────────────────────────────────── */}
      <Section title="Hair colour">
        <div className="flex gap-3 flex-wrap">
          {HAIR_COLOURS.map((c) => {
            const unlocked = isUnlocked(c.unlock, totalPoints)
            const selected = avatarCfg.hairColour === c.id
            return (
              <div key={c.id} className="relative">
                <button
                  onClick={() => unlocked && setAvatar('hairColour', c.id as HairColour)}
                  aria-label={c.name}
                  aria-pressed={selected}
                  disabled={!unlocked}
                  className={`h-10 w-10 rounded-full border-2 transition-transform ${
                    selected   ? 'scale-125 border-ink shadow-md'
                    : unlocked ? 'border-transparent hover:scale-110'
                               : 'border-transparent opacity-40 cursor-not-allowed'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
                {!unlocked && (
                  <Lock className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-muted bg-surface rounded-full p-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Eyes ──────────────────────────────────────────── */}
      <Section title="Eyes">
        <div className="grid grid-cols-5 gap-2">
          {EYE_STYLES.map((e) => {
            const unlocked = isUnlocked(e.unlock, totalPoints)
            const selected = avatarCfg.eyeStyle === e.id
            return (
              <button
                key={e.id}
                onClick={() => unlocked && setAvatar('eyeStyle', e.id as EyeStyle)}
                aria-pressed={selected}
                disabled={!unlocked}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-1 transition-all ${
                  selected    ? 'border-brand bg-brand/10 shadow-sm scale-105'
                  : unlocked  ? 'border-black/10 bg-black/[0.02] hover:border-brand/40'
                              : 'border-black/5 bg-black/[0.02] opacity-50 cursor-not-allowed'
                }`}
              >
                <DeciferAvatar
                  config={{ ...avatarCfg, eyeStyle: e.id as EyeStyle }}
                  size={44}
                />
                <span className={`text-[10px] font-semibold leading-tight ${selected ? 'text-brand' : 'text-muted'}`}>
                  {e.name}
                </span>
                {!unlocked && (
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-muted" />
                )}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Accessories ───────────────────────────────────── */}
      <Section title="Accessories">
        <div className="grid grid-cols-4 gap-2">
          {ACCESSORIES.map((a) => {
            const unlocked = isUnlocked(a.unlock, totalPoints)
            const selected = avatarCfg.accessory === a.id
            return (
              <button
                key={a.id}
                onClick={() => unlocked && setAvatar('accessory', a.id as Accessory)}
                aria-pressed={selected}
                disabled={!unlocked}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-1 transition-all ${
                  selected    ? 'border-brand bg-brand/10 shadow-sm scale-105'
                  : unlocked  ? 'border-black/10 bg-black/[0.02] hover:border-brand/40'
                              : 'border-black/5 bg-black/[0.02] opacity-50 cursor-not-allowed'
                }`}
              >
                <DeciferAvatar
                  config={{ ...avatarCfg, accessory: a.id as Accessory }}
                  size={44}
                />
                <span className={`text-[10px] font-semibold leading-tight ${selected ? 'text-brand' : 'text-muted'}`}>
                  {a.name}
                </span>
                {!unlocked && a.unlock && (
                  <span className="absolute top-1 right-1 flex items-center gap-0.5 text-[9px] text-muted font-bold">
                    <Lock className="w-2.5 h-2.5" />{a.unlock.xp >= 1000 ? `${(a.unlock.xp/1000).toFixed(1)}k` : a.unlock.xp}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Outfit colour ─────────────────────────────────── */}
      <Section title="Outfit colour">
        <div className="flex gap-3 flex-wrap">
          {OUTFIT_COLOURS.map((c) => (
            <button
              key={c.id}
              onClick={() => setAvatar('outfitColour', c.hex)}
              aria-label={c.name}
              aria-pressed={avatarCfg.outfitColour === c.hex}
              className={`h-10 w-10 rounded-full border-2 transition-transform ${
                avatarCfg.outfitColour === c.hex ? 'scale-125 border-ink shadow-md' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </Section>

      {/* ── Study buddy ───────────────────────────────────── */}
      <Section title="Study buddy">
        <div className="grid grid-cols-4 gap-2">
          {BUDDIES.map((b) => {
            const Icon = BUDDY_ICONS[b.id]
            const selected = buddy === b.id
            return (
              <button
                key={b.id}
                onClick={() => setBuddy(selected ? null : b.id)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition-all ${
                  selected
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

      {/* ── Theme ─────────────────────────────────────────── */}
      <Section title="Theme">
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => {
            const selected = theme === t.id
            const isNight  = t.id === 'night'
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-all ${
                  selected ? 'border-brand shadow-sm' : 'border-black/10 hover:border-brand/40'
                }`}
                style={{
                  backgroundColor: isNight ? '#1E2244'
                    : selected ? 'rgba(251,90,36,0.08)'
                    : 'rgba(0,0,0,0.02)',
                }}
              >
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: t.accent + '33', border: `2px solid ${t.accent}` }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.accent }} />
                </div>
                <span className="text-[10px] font-semibold leading-tight" style={{ color: isNight ? '#B7B0C6' : undefined }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── About me ──────────────────────────────────────── */}
      <Section title="Favourite subject">
        <div className="grid grid-cols-4 gap-2">
          {FAVOURITE_SUBJECTS.map((s) => (
            <Chip key={s.id} iconName={s.iconName} label={s.label}
              active={favSubject === s.id}
              onClick={() => setFavSubject(favSubject === s.id ? null : s.id)} />
          ))}
        </div>
      </Section>

      <Section title="Things I'm into">
        <div className="grid grid-cols-3 gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i.id} iconName={i.iconName} label={i.label}
              active={interests.includes(i.id)}
              onClick={() => toggle(interests, setInterests, i.id)} />
          ))}
        </div>
      </Section>

      <Section title="How I like to learn">
        <div className="grid grid-cols-2 gap-2">
          {LEARN_STYLES.map((l) => (
            <Chip key={l.id} iconName={l.iconName} label={l.label}
              active={learnStyles.includes(l.id)}
              onClick={() => toggle(learnStyles, setLearnStyles, l.id)} />
          ))}
        </div>
      </Section>

      <Section title="How I feel about it">
        <div className="space-y-4">
          {CONFIDENCE_AREAS.map((area) => (
            <div key={area.id}>
              <p className="mb-2 text-sm font-semibold text-ink">{area.label}</p>
              <div className="grid grid-cols-4 gap-2">
                {CONFIDENCE_LEVELS.map((lvl) => (
                  <Chip key={lvl.value} iconName={lvl.iconName} label={lvl.label}
                    active={confidence[area.id] === lvl.value}
                    onClick={() =>
                      setConfidence((c) =>
                        c[area.id] === lvl.value
                          ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== area.id))
                          : { ...c, [area.id]: lvl.value },
                      )
                    } />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Save ──────────────────────────────────────────── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-2xl bg-brand py-4 font-heading font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {saving ? 'Saving…'
          : saved
            ? <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" aria-hidden /> Saved!</span>
            : 'Save changes'
        }
      </button>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  )
}

function Chip({ iconName, label, active, onClick }: {
  iconName: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 transition-all ${
        active
          ? 'border-brand bg-brand/10 shadow-sm scale-105'
          : 'border-black/10 bg-black/[0.02] hover:border-brand/40'
      }`}
    >
      {(() => { const Icon = CHOICE_ICONS[iconName] ?? Target; return <Icon className={`w-5 h-5 ${active ? 'text-brand' : 'text-muted'}`} aria-hidden /> })()}
      <span className={`text-[11px] font-semibold leading-tight ${active ? 'text-brand' : 'text-ink'}`}>{label}</span>
    </button>
  )
}
