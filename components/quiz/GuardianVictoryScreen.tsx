'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CardReveal } from '@/components/cards/CardReveal'
import { BadgePopup } from '@/components/quiz/BadgePopup'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'
import { Trophy, Crown, Flame, Swords } from '@/components/ui/icons'

// ── Confetti particle ─────────────────────────────────────────────────────────
type Particle = {
  id: number
  x: number
  delay: number
  duration: number
  colour: string
  size: number
  rotate: number
}

const COLOURS = ['#6C9EFF', '#FF8FAB', '#52D9A0', '#FFD43B', '#FFC107', '#A78BFA', '#FF9F43']

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.4 + Math.random() * 1.2,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  }))
}

function Confetti() {
  const [particles] = useState(() => makeParticles(40))
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: -20, x: `${p.x}vw`, rotate: 0 }}
          animate={{ opacity: 0, y: '110vh', rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            background: p.colour,
          }}
        />
      ))}
    </div>
  )
}

// ── Share helper ──────────────────────────────────────────────────────────────
const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? 'https://deciferlearning.com'

function buildShareText(zoneName: string, score: number, total: number) {
  const pct = Math.round((score / total) * 100)
  return `I just defeated the ${zoneName} Guardian on Decifer Learning! 🏆 ${score}/${total} (${pct}%) — can you beat me? ${APP_URL}`
}

async function shareOrCopy(text: string, onCopied: () => void) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch {
      // user cancelled — fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(text).catch(() => {})
  onCopied()
}

// ── Main component ─────────────────────────────────────────────────────────────
export function GuardianVictoryScreen({
  zoneName,
  score,
  total,
  points,
  totalPoints,
  streakDays,
  droppedCard,
  newBadges,
  backHref = '/world-map',
}: {
  zoneName: string
  score: number
  total: number
  points: number
  totalPoints: number
  streakDays: number
  droppedCard: DroppedCard | null
  newBadges: EarnedBadge[]
  backHref?: string
}) {
  const pct = Math.round((score / total) * 100)
  const [phase, setPhase] = useState<'splash' | 'stats' | 'done'>('splash')
  const [showCard, setShowCard] = useState(false)
  const [badgeQueue, setBadgeQueue] = useState<EarnedBadge[]>(newBadges)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Auto-advance splash → stats after 2.2s
  useEffect(() => {
    timerRef.current = setTimeout(() => setPhase('stats'), 2200)
    return () => clearTimeout(timerRef.current)
  }, [])

  // After stats appear, queue card reveal
  useEffect(() => {
    if (phase !== 'stats') return
    if (droppedCard) {
      timerRef.current = setTimeout(() => setShowCard(true), 800)
    }
    return () => clearTimeout(timerRef.current)
  }, [phase, droppedCard])

  function onCardDismissed() {
    setShowCard(false)
    if (newBadges.length > 0) setBadgeQueue(newBadges)
    else setPhase('done')
  }

  function onBadgeDismissed() {
    const remaining = badgeQueue.slice(1)
    setBadgeQueue(remaining)
    if (remaining.length === 0) setPhase('done')
  }

  function handleShare() {
    shareOrCopy(buildShareText(zoneName, score, total), () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <>
      <Confetti />

      {/* Card reveal overlay */}
      {showCard && droppedCard && (
        <CardReveal card={droppedCard} onDismiss={onCardDismissed} />
      )}
      {!showCard && badgeQueue.length > 0 && (
        <BadgePopup badge={badgeQueue[0]} onDismiss={onBadgeDismissed} />
      )}

      {/* ── Splash phase ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-30 flex flex-col items-center justify-center px-6 text-center"
            style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
              className="mb-6 flex justify-center"
            >
              <Trophy className="w-24 h-24 text-points-gold" aria-hidden />
            </motion.div>
            <motion.h1
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="font-heading text-4xl font-extrabold text-white"
              style={{ textShadow: '0 0 40px rgba(255,193,7,0.6)' }}
            >
              Guardian Defeated!
            </motion.h1>
            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-3 text-lg font-semibold"
              style={{ color: '#FFD43B' }}
            >
              {zoneName}
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 1.4, duration: 0.6 }}
              className="mt-8 text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Claiming your rewards…
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats phase ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'stats' || phase === 'done') && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="space-y-4"
          >
            {/* Hero banner */}
            <div
              className="overflow-hidden rounded-3xl p-6 text-center"
              style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', border: '2px solid rgba(255,193,7,0.35)' }}
            >
              <div className="mb-2 flex justify-center"><Trophy className="w-12 h-12 text-points-gold" aria-hidden /></div>
              <h2 className="font-heading text-2xl font-extrabold text-white">Guardian Defeated!</h2>
              <p className="mt-1 font-semibold" style={{ color: '#FFD43B' }}>{zoneName}</p>

              {/* Score ring */}
              <div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full border-4" style={{ borderColor: '#FFC107', background: 'rgba(255,193,7,0.12)' }}>
                <div>
                  <p className="font-heading text-3xl font-extrabold text-white">{pct}%</p>
                  <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{score}/{total}</p>
                </div>
              </div>
            </div>

            {/* Rewards row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-surface p-3 text-center shadow-sm border border-black/5">
                <p className="text-2xl font-extrabold font-heading" style={{ color: '#FFC107' }}>+{points}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-muted">Points</p>
              </div>
              <div className="rounded-2xl bg-surface p-3 text-center shadow-sm border border-black/5">
                <div className="flex justify-center"><Crown className="w-6 h-6 text-points-gold" aria-hidden /></div>
                <p className="mt-0.5 text-[11px] font-semibold text-muted">Legendary card</p>
              </div>
              <div className="rounded-2xl bg-surface p-3 text-center shadow-sm border border-black/5">
                {streakDays > 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-1"><Flame className="w-5 h-5" style={{ color: '#FF6B6B' }} aria-hidden /><span className="text-2xl font-extrabold font-heading" style={{ color: '#FF6B6B' }}>{streakDays}</span></div>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">Day streak</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-extrabold font-heading text-ink">{totalPoints.toLocaleString()}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">Total pts</p>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {/* Share / Challenge a friend */}
              <button
                onClick={handleShare}
                className="relative flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl font-heading text-base font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(90deg, #6C9EFF 0%, #A78BFA 100%)' }}
              >
                <Swords className="w-5 h-5" aria-hidden />
                {copied ? 'Link copied!' : 'Challenge a friend'}
              </button>

              {/* Back to map */}
              <Link
                href={backHref}
                className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-black/10 bg-surface font-heading text-base font-bold text-ink transition-colors hover:bg-black/5"
              >
                Back to World Map
              </Link>
            </div>

            {droppedCard && (
              <p className="text-center text-xs text-muted">Your Legendary card is waiting — tap to reveal it!</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
