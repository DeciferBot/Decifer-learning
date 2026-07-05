'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ParticleModelWidget } from '@/lib/learn-widgets'
import { WidgetWrapper } from './WidgetWrapper'
import { Flame } from '@/components/ui/icons'

interface Props {
  widget: ParticleModelWidget
}

type MatterState = 'solid' | 'liquid' | 'gas'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOX_W = 280
const BOX_H = 200
const PARTICLE_COUNT = 16

const STATE_CONFIG = {
  solid: {
    color: '#6C9EFF',
    size: 14,
    speed: 0,
    label: 'Solid',
    badgeClass: 'bg-[#6C9EFF]/15 text-[#6C9EFF] border-[#6C9EFF]/40',
    borderColor: '#6C9EFF',
    temp: 25,
    fact: "Particles are held tightly in a fixed arrangement, and that's why solids keep their shape!",
  },
  liquid: {
    color: '#52D9A0',
    size: 12,
    speed: 20,
    label: 'Liquid',
    badgeClass: 'bg-[#52D9A0]/15 text-[#52D9A0] border-[#52D9A0]/40',
    borderColor: '#52D9A0',
    temp: 55,
    fact: "Particles can flow past each other, and that's why liquids take the shape of their container.",
  },
  gas: {
    color: '#FF8FAB',
    size: 9,
    speed: 80,
    label: 'Gas',
    badgeClass: 'bg-[#FF8FAB]/15 text-[#FF8FAB] border-[#FF8FAB]/40',
    borderColor: '#FF8FAB',
    temp: 85,
    fact: "Particles move freely and fast in all directions, and that's why gases spread to fill any space.",
  },
} as const

// ---------------------------------------------------------------------------
// Particle physics helpers
// ---------------------------------------------------------------------------

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  baseX: number
  baseY: number
}

function gridPositions(count: number, boxW: number, boxH: number): { x: number; y: number }[] {
  const cols = 4
  const rows = Math.ceil(count / cols)
  const padX = boxW * 0.15
  const padY = boxH * 0.15
  const stepX = (boxW - padX * 2) / (cols - 1)
  const stepY = (boxH - padY * 2) / (rows - 1)
  return Array.from({ length: count }, (_, i) => ({
    x: padX + (i % cols) * stepX,
    y: padY + Math.floor(i / cols) * stepY,
  }))
}

function randomVelocity(speed: number): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

function buildParticles(state: MatterState): Particle[] {
  const grid = gridPositions(PARTICLE_COUNT, BOX_W, BOX_H)
  const cfg = STATE_CONFIG[state]
  const r = cfg.size / 2

  return grid.map((pos) => {
    const vel = state === 'solid' ? { vx: 0, vy: 0 } : randomVelocity(cfg.speed)
    const px = state === 'gas' ? r + Math.random() * (BOX_W - r * 2) : pos.x
    const py = state === 'gas' ? r + Math.random() * (BOX_H - r * 2) : pos.y
    return {
      x: px,
      y: py,
      vx: vel.vx,
      vy: vel.vy,
      phase: Math.random() * Math.PI * 2,
      baseX: pos.x,
      baseY: pos.y,
    }
  })
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ParticleModel({ widget }: Props) {
  const { config } = widget
  const startState = config.start_state

  const [currentState, setCurrentState] = useState<MatterState>(startState)
  const [temperature, setTemperature] = useState(STATE_CONFIG[startState].temp)
  const [transitioning, setTransitioning] = useState(false)
  const [flashBorder, setFlashBorder] = useState(false)

  const particlesRef = useRef<Particle[]>(buildParticles(startState))
  const domRefsRef = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const currentStateRef = useRef<MatterState>(startState)
  const lastTimeRef = useRef<number>(0)

  // ---------------------------------------------------------------------------
  // Animation loop (direct DOM mutation — avoids re-render thrashing)
  // ---------------------------------------------------------------------------

  const tick = useCallback((time: number) => {
    if (pausedRef.current) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    const dt = lastTimeRef.current
      ? Math.min((time - lastTimeRef.current) / 1000, 0.05)
      : 0.016
    lastTimeRef.current = time

    const state = currentStateRef.current
    const cfg = STATE_CONFIG[state]
    const r = cfg.size / 2
    const particles = particlesRef.current

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      if (state === 'solid') {
        // Vibrate in place (8 cycles/sec roughly)
        p.phase += dt * 50
        const jitter = 2
        p.x = p.baseX + Math.sin(p.phase) * jitter
        p.y = p.baseY + Math.cos(p.phase * 1.37) * jitter
      } else if (state === 'liquid') {
        // Slight pull toward centre keeps particles loosely clustered
        const cx = BOX_W / 2
        const cy = BOX_H / 2
        const dx = cx - p.x
        const dy = cy - p.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const attraction = 10
        p.vx += (dx / dist) * attraction * dt
        p.vy += (dy / dist) * attraction * dt

        // Clamp speed
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > cfg.speed * 1.5) {
          p.vx = (p.vx / spd) * cfg.speed * 1.5
          p.vy = (p.vy / spd) * cfg.speed * 1.5
        }

        p.x += p.vx * dt
        p.y += p.vy * dt

        if (p.x - r < 0) { p.x = r; p.vx = Math.abs(p.vx) }
        if (p.x + r > BOX_W) { p.x = BOX_W - r; p.vx = -Math.abs(p.vx) }
        if (p.y - r < 0) { p.y = r; p.vy = Math.abs(p.vy) }
        if (p.y + r > BOX_H) { p.y = BOX_H - r; p.vy = -Math.abs(p.vy) }
      } else {
        // Gas — fast, elastic wall bounces
        p.x += p.vx * dt
        p.y += p.vy * dt

        if (p.x - r < 0) { p.x = r; p.vx = Math.abs(p.vx) }
        if (p.x + r > BOX_W) { p.x = BOX_W - r; p.vx = -Math.abs(p.vx) }
        if (p.y - r < 0) { p.y = r; p.vy = Math.abs(p.vy) }
        if (p.y + r > BOX_H) { p.y = BOX_H - r; p.vy = -Math.abs(p.vy) }
      }

      // Write position directly to DOM (GPU-accelerated via transform)
      const el = domRefsRef.current[i]
      if (el) {
        el.style.transform = `translate(${p.x - r}px, ${p.y - r}px)`
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  // ---------------------------------------------------------------------------
  // State transition
  // ---------------------------------------------------------------------------

  const transitionTo = useCallback(
    (newState: MatterState) => {
      if (transitioning || newState === currentState) return

      setTransitioning(true)
      pausedRef.current = true
      setFlashBorder(true)
      setTimeout(() => setFlashBorder(false), 700)

      const newCfg = STATE_CONFIG[newState]
      const grid = gridPositions(PARTICLE_COUNT, BOX_W, BOX_H)
      const r = newCfg.size / 2
      const particles = particlesRef.current

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        if (newState === 'solid') {
          p.baseX = grid[i].x
          p.baseY = grid[i].y
          // Smoothly move to grid position
          p.x = grid[i].x
          p.y = grid[i].y
          p.vx = 0
          p.vy = 0
          p.phase = Math.random() * Math.PI * 2
        } else if (newState === 'liquid') {
          p.baseX = grid[i].x
          p.baseY = grid[i].y
          if (currentStateRef.current === 'solid') {
            p.x = grid[i].x
            p.y = grid[i].y
          }
          const vel = randomVelocity(newCfg.speed)
          p.vx = vel.vx
          p.vy = vel.vy
        } else {
          // Gas — scatter particles
          p.x = r + Math.random() * (BOX_W - r * 2)
          p.y = r + Math.random() * (BOX_H - r * 2)
          const vel = randomVelocity(newCfg.speed)
          p.vx = vel.vx
          p.vy = vel.vy
        }
      }

      // Update particle visual properties immediately
      domRefsRef.current.forEach(el => {
        if (!el) return
        el.style.width = `${newCfg.size}px`
        el.style.height = `${newCfg.size}px`
        el.style.backgroundColor = newCfg.color
      })

      currentStateRef.current = newState
      setCurrentState(newState)
      setTemperature(newCfg.temp)

      setTimeout(() => {
        pausedRef.current = false
        setTransitioning(false)
      }, 650)
    },
    [transitioning, currentState]
  )

  const handleHeat = useCallback(() => {
    if (currentState === 'solid') transitionTo('liquid')
    else if (currentState === 'liquid') transitionTo('gas')
  }, [currentState, transitionTo])

  const handleCool = useCallback(() => {
    if (currentState === 'gas') transitionTo('liquid')
    else if (currentState === 'liquid') transitionTo('solid')
  }, [currentState, transitionTo])

  const cfg = STATE_CONFIG[currentState]
  const substance =
    config.substance
      ? config.substance.charAt(0).toUpperCase() + config.substance.slice(1)
      : 'Substance'

  const initCfg = STATE_CONFIG[startState]

  return (
    <WidgetWrapper title={config.title}>
      {/* Substance name + state badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-[#2D3748]">{substance}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={currentState}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-bold ${cfg.badgeClass}`}
          >
            {cfg.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Particle box */}
      <div className="flex justify-center mb-3">
        <motion.div
          className="relative overflow-hidden rounded-xl border-2 bg-[#F0F4FF]"
          animate={{
            borderColor: flashBorder ? cfg.borderColor : '#CBD5E0',
            boxShadow: flashBorder
              ? `0 0 0 4px ${cfg.borderColor}30`
              : '0 0 0 0px transparent',
          }}
          transition={{ duration: 0.3 }}
          style={{ width: BOX_W, height: BOX_H, maxWidth: '100%' }}
          role="img"
          aria-label={`Particle model of ${substance} in ${currentState} state`}
        >
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <div
              key={i}
              ref={el => { domRefsRef.current[i] = el }}
              className="absolute"
              aria-hidden="true"
              style={{
                width: initCfg.size,
                height: initCfg.size,
                borderRadius: '50%',
                backgroundColor: initCfg.color,
                willChange: 'transform',
                transform: `translate(${(particlesRef.current[i]?.x ?? 0) - initCfg.size / 2}px, ${(particlesRef.current[i]?.y ?? 0) - initCfg.size / 2}px)`,
                transition: transitioning
                  ? 'background-color 0.4s ease, width 0.4s ease, height 0.4s ease'
                  : 'background-color 0.4s ease, width 0.4s ease, height 0.4s ease',
              }}
            />
          ))}

          <div className="absolute bottom-1.5 right-2 text-[10px] font-medium text-[#718096]/50 select-none pointer-events-none">
            {PARTICLE_COUNT} particles
          </div>
        </motion.div>
      </div>

      {/* Temperature bar */}
      <div className="mb-4 px-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[#718096]">Cold</span>
          <span className="text-xs font-semibold text-[#2D3748]">{temperature}°</span>
          <span className="text-xs text-[#718096] flex items-center gap-0.5">Hot <Flame className="w-3 h-3" aria-hidden /></span>
        </div>
        <div
          className="relative h-5 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(to right, #6C9EFF, #52D9A0, #FFD43B, #FF8FAB)',
          }}
          role="progressbar"
          aria-valuenow={temperature}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Temperature: ${temperature} percent`}
        >
          {/* White overlay masks the unfilled portion */}
          <motion.div
            className="absolute top-0 bottom-0 bg-surface/55 rounded-r-full"
            animate={{ left: `${temperature}%` }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            style={{ right: 0 }}
          />
          {/* Thumb indicator */}
          <motion.div
            className="absolute top-0.5 bottom-0.5 w-4 bg-surface rounded-full shadow-md"
            animate={{ left: `calc(${temperature}% - 8px)` }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Heat / Cool buttons */}
      {config.interactive !== false && (
        <div className="flex gap-3 justify-center mb-4">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleCool}
            disabled={currentState === 'solid' || transitioning}
            aria-label="Cool down, decrease temperature"
            className={[
              'flex-1 min-h-[52px] rounded-xl border-2 font-bold text-sm',
              'flex items-center justify-center gap-2',
              'transition-opacity duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C9EFF] focus-visible:ring-offset-1',
              currentState === 'solid' || transitioning
                ? 'opacity-30 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                : 'border-[#6C9EFF]/50 bg-[#6C9EFF]/10 text-[#6C9EFF] cursor-pointer hover:bg-[#6C9EFF]/20 active:bg-[#6C9EFF]/30',
            ].join(' ')}
          >
            <span className="text-xl" aria-hidden="true">❄️</span>
            Cool
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleHeat}
            disabled={currentState === 'gas' || transitioning}
            aria-label="Heat up, increase temperature"
            className={[
              'flex-1 min-h-[52px] rounded-xl border-2 font-bold text-sm',
              'flex items-center justify-center gap-2',
              'transition-opacity duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8FAB] focus-visible:ring-offset-1',
              currentState === 'gas' || transitioning
                ? 'opacity-30 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                : 'border-[#FF8FAB]/50 bg-[#FF8FAB]/10 text-[#FF8FAB] cursor-pointer hover:bg-[#FF8FAB]/20 active:bg-[#FF8FAB]/30',
            ].join(' ')}
          >
            <Flame className="w-5 h-5" aria-hidden />
            Heat
          </motion.button>
        </div>
      )}

      {/* State fact */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentState}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${cfg.badgeClass}`}
          role="status"
          aria-live="polite"
        >
          {cfg.fact}
        </motion.div>
      </AnimatePresence>
    </WidgetWrapper>
  )
}
