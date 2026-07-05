'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AVATARS, BUDDIES } from '@/lib/customise-config'
import { AVATAR_ICONS, BUDDY_ICONS, Check } from '@/lib/icon-tokens'
import {
  FAVOURITE_SUBJECTS,
  INTERESTS,
  LEARN_STYLES,
  CONFIDENCE_AREAS,
  CONFIDENCE_LEVELS,
  type LearningProfile,
} from '@/lib/onboarding-config'
import {
  Target, BookOpen, FlaskConical, Search,
  Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil,
  Eye, Zap, TrendingUp, Star, Trophy,
} from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
const ONBOARDING_ICONS: Record<string, IconComp> = {
  Target, BookOpen, FlaskConical, Search,
  Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil,
  Eye, Zap, TrendingUp, Star, Trophy,
}

// Accent colours — mirrors the Customise page palette.
const COLOURS = [
  { id: 'blue',   label: 'Blue',   hex: '#6C9EFF' },
  { id: 'pink',   label: 'Pink',   hex: '#FF8FAB' },
  { id: 'green',  label: 'Green',  hex: '#52D9A0' },
  { id: 'gold',   label: 'Gold',   hex: '#FFC107' },
  { id: 'purple', label: 'Purple', hex: '#9B59B6' },
  { id: 'orange', label: 'Orange', hex: '#FF8C00' },
] as const

interface InitialState {
  avatarBase:   string | null
  avatarColour: string
  studyBuddy:   string | null
  learning:     LearningProfile
}

const STEPS = ['avatar', 'buddy', 'subject', 'interests', 'learn', 'confidence'] as const
type StepName = typeof STEPS[number]

export function OnboardingWizard({
  displayName,
  initial,
}: {
  displayName: string
  initial: InitialState
}) {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [avatarBase,   setAvatarBase]   = useState<string | null>(initial.avatarBase)
  const [avatarColour, setAvatarColour] = useState<string>(initial.avatarColour || 'blue')
  const [buddy,        setBuddy]        = useState<string | null>(initial.studyBuddy)

  const [favSubject,  setFavSubject]  = useState<string | null>(initial.learning.favourite_subject ?? null)
  const [interests,   setInterests]   = useState<string[]>(initial.learning.interests ?? [])
  const [learnStyles, setLearnStyles] = useState<string[]>(initial.learning.learn_styles ?? [])
  const [confidence,  setConfidence]  = useState<Record<string, number>>(initial.learning.confidence ?? {})

  const stepName: StepName = STEPS[step]
  const isLast = step === STEPS.length - 1

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function buildPayload() {
    const learningProfile: NonNullable<Record<string, unknown>> = {}
    if (favSubject) learningProfile.favourite_subject = favSubject
    if (interests.length) learningProfile.interests = interests
    if (learnStyles.length) learningProfile.learn_styles = learnStyles
    if (Object.keys(confidence).length) learningProfile.confidence = confidence

    return {
      ...(avatarBase ? { avatarBase, avatarColour } : {}),
      ...(buddy ? { studyBuddy: buddy } : {}),
      ...(Object.keys(learningProfile).length ? { learningProfile } : {}),
    }
  }

  async function finish(skip: boolean) {
    setSubmitting(true)
    try {
      await fetch('/api/profile/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(skip ? {} : buildPayload()),
      })
    } catch {
      /* best-effort: onboarded_at write is idempotent; dashboard gate will retry */
    }
    router.refresh()
    router.push('/dashboard/child')
  }

  function next() {
    if (isLast) void finish(false)
    else setStep((s) => s + 1)
  }

  // Avatar character is the one required choice to "Continue" on step 0.
  const canContinue = stepName === 'avatar' ? !!avatarBase : true

  return (
    <div className="space-y-6 pb-6">
      {/* Header: progress dots + skip */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-brand' : i < step ? 'w-1.5 bg-brand/50' : 'w-1.5 bg-black/10'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => void finish(true)}
          disabled={submitting}
          className="text-sm font-medium text-muted hover:text-ink disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>

      {/* ── Step content ─────────────────────────────────────────────────── */}
      {stepName === 'avatar' && (
        <Step
          title={`Hi ${displayName}!`}
          subtitle="Pick a character to be your avatar."
        >
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((a) => {
              const Icon = AVATAR_ICONS[a.id]
              const active = avatarBase === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setAvatarBase(a.id)}
                  aria-pressed={active}
                  aria-label={a.name}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border transition-all ${
                    active
                      ? 'border-brand bg-brand/10 text-brand shadow-sm scale-105'
                      : 'border-black/10 bg-black/[0.02] text-muted hover:border-brand/40'
                  }`}
                >
                  <Icon size={26} aria-hidden />
                  <span className="text-[10px] font-medium">{a.name}</span>
                </button>
              )
            })}
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">Colour</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {COLOURS.map((c) => (
              <button
                key={c.id}
                onClick={() => setAvatarColour(c.id)}
                aria-label={c.label}
                aria-pressed={avatarColour === c.id}
                className={`h-11 w-11 rounded-full border-2 transition-transform ${
                  avatarColour === c.id ? 'scale-125 border-ink' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </Step>
      )}

      {stepName === 'buddy' && (
        <Step title="Choose a study buddy" subtitle="They'll cheer you on. You can skip this.">
          <div className="grid grid-cols-2 gap-2">
            {BUDDIES.map((b) => {
              const Icon = BUDDY_ICONS[b.id]
              const active = buddy === b.id
              return (
                <button
                  key={b.id}
                  onClick={() => setBuddy(active ? null : b.id)}
                  aria-pressed={active}
                  className={`flex min-h-[64px] items-center gap-3 rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-brand bg-brand/10 text-brand shadow-sm'
                      : 'border-black/10 bg-black/[0.02] text-muted hover:border-brand/40'
                  }`}
                >
                  <Icon size={28} aria-hidden />
                  <span className="font-heading font-semibold">{b.name}</span>
                </button>
              )
            })}
          </div>
        </Step>
      )}

      {stepName === 'subject' && (
        <Step title="What do you like best?" subtitle="Pick your favourite, and we'll suggest where to start.">
          <div className="grid grid-cols-2 gap-2">
            {FAVOURITE_SUBJECTS.map((s) => (
              <ChoiceCard
                key={s.id}
                iconName={s.iconName}
                label={s.label}
                active={favSubject === s.id}
                onClick={() => setFavSubject(favSubject === s.id ? null : s.id)}
              />
            ))}
          </div>
        </Step>
      )}

      {stepName === 'interests' && (
        <Step title="What are you into?" subtitle="Pick as many as you like, and we'll use these in questions and cards.">
          <div className="grid grid-cols-3 gap-2">
            {INTERESTS.map((i) => (
              <ChoiceCard
                key={i.id}
                iconName={i.iconName}
                label={i.label}
                active={interests.includes(i.id)}
                onClick={() => toggle(interests, setInterests, i.id)}
              />
            ))}
          </div>
        </Step>
      )}

      {stepName === 'learn' && (
        <Step title="How do you like to learn?" subtitle="Pick any that feel right.">
          <div className="grid grid-cols-2 gap-2">
            {LEARN_STYLES.map((l) => (
              <ChoiceCard
                key={l.id}
                iconName={l.iconName}
                label={l.label}
                active={learnStyles.includes(l.id)}
                onClick={() => toggle(learnStyles, setLearnStyles, l.id)}
              />
            ))}
          </div>
        </Step>
      )}

      {stepName === 'confidence' && (
        <Step title="How do you feel about these?" subtitle="There are no wrong answers!">
          <div className="space-y-5">
            {CONFIDENCE_AREAS.map((area) => (
              <div key={area.id}>
                <p className="mb-2 font-heading text-sm font-bold text-ink">{area.label}</p>
                <div className="grid grid-cols-4 gap-2">
                  {CONFIDENCE_LEVELS.map((lvl) => {
                    const active = confidence[area.id] === lvl.value
                    return (
                      <button
                        key={lvl.value}
                        onClick={() =>
                          setConfidence((c) =>
                            c[area.id] === lvl.value
                              ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== area.id))
                              : { ...c, [area.id]: lvl.value },
                          )
                        }
                        aria-pressed={active}
                        aria-label={`${area.label}: ${lvl.label}`}
                        className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 transition-all ${
                          active
                            ? 'border-brand bg-brand/10 shadow-sm scale-105'
                            : 'border-black/10 bg-black/[0.02] hover:border-brand/40'
                        }`}
                      >
                        {(() => { const Icon = ONBOARDING_ICONS[lvl.iconName] ?? Star; return <Icon className="w-6 h-6 text-muted" aria-hidden /> })()}
                        <span className="text-[10px] font-medium leading-tight text-muted">{lvl.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Step>
      )}

      {/* ── Footer nav ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={submitting}
            className="flex h-12 items-center justify-center rounded-2xl border border-black/10 px-5 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        <button
          onClick={next}
          disabled={!canContinue || submitting}
          className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-brand font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting
            ? 'Saving…'
            : isLast
              ? <span className="flex items-center gap-1.5"><Check className="h-4 w-4" aria-hidden /> All done!</span>
              : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function ChoiceCard({
  iconName,
  label,
  active,
  onClick,
}: {
  iconName: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border p-3 transition-all ${
        active
          ? 'border-brand bg-brand/10 shadow-sm scale-105'
          : 'border-black/10 bg-black/[0.02] hover:border-brand/40'
      }`}
    >
      {(() => { const Icon = ONBOARDING_ICONS[iconName] ?? Target; return <Icon className={`w-6 h-6 ${active ? 'text-brand' : 'text-muted'}`} aria-hidden /> })()}
      <span className={`text-xs font-semibold ${active ? 'text-brand' : 'text-ink'}`}>{label}</span>
    </button>
  )
}
