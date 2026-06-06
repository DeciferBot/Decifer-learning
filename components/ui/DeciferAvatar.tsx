'use client'

import type { AvatarConfig, SkinTone, HairColour, HairStyle, EyeStyle, Accessory } from '@/lib/avatar-catalogue'
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-catalogue'

// ── Colour palettes ──────────────────────────────────────────────────────────

type SP = { base: string; shadow: string; hi: string }
const SKIN_PAL: Record<SkinTone, SP> = {
  light:    { base: '#FDDBB4', shadow: '#EFC49A', hi: '#FEE9D0' },
  medLight: { base: '#F5C28A', shadow: '#D9A86A', hi: '#FBDAAE' },
  medium:   { base: '#D4956A', shadow: '#B87548', hi: '#E2AD84' },
  tan:      { base: '#C68642', shadow: '#A06828', hi: '#D89A58' },
  brown:    { base: '#8B5524', shadow: '#6B3D10', hi: '#A8703A' },
  dark:     { base: '#4E2C0E', shadow: '#361A04', hi: '#6A3E18' },
}

type HP = { base: string; hi: string }
const HAIR_PAL: Record<HairColour, HP> = {
  black:  { base: '#1A1A2E', hi: '#3A3A60' },
  brown:  { base: '#5C3317', hi: '#7D4820' },
  blonde: { base: '#C8962A', hi: '#E0B040' },
  auburn: { base: '#7A2200', hi: '#9B3A10' },
  blue:   { base: '#1E4CB0', hi: '#3060D0' },
  purple: { base: '#6A1F8A', hi: '#8B40B0' },
  pink:   { base: '#C0246A', hi: '#E03888' },
  silver: { base: '#7878A0', hi: '#9898C8' },
}

// ── Main component ───────────────────────────────────────────────────────────

interface DeciferAvatarProps {
  config?: Partial<AvatarConfig>
  size?: number
  className?: string
}

export function DeciferAvatar({ config: partial = {}, size = 80, className }: DeciferAvatarProps) {
  const cfg: AvatarConfig = { ...DEFAULT_AVATAR_CONFIG, ...partial }
  const sk  = SKIN_PAL[cfg.skinTone]  ?? SKIN_PAL[DEFAULT_AVATAR_CONFIG.skinTone]
  const hr  = HAIR_PAL[cfg.hairColour] ?? HAIR_PAL[DEFAULT_AVATAR_CONFIG.hairColour]

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={Math.round(size * 1.2)}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* render order: body → hair-back → ears → head → face → hair-front → accessory */}
      <Body outfit={cfg.outfitColour} skin={sk.base} />
      <HairBack hStyle={cfg.hairStyle} hr={hr} />

      {/* Ears — behind head */}
      <ellipse cx="28" cy="43" rx="5.5" ry="6.5" fill={sk.base} />
      <ellipse cx="72" cy="43" rx="5.5" ry="6.5" fill={sk.base} />
      <ellipse cx="28" cy="43" rx="3"   ry="4"   fill={sk.shadow} />
      <ellipse cx="72" cy="43" rx="3"   ry="4"   fill={sk.shadow} />

      {/* Head */}
      <circle cx="50" cy="40" r="22" fill={sk.base} />
      <ellipse cx="50" cy="58" rx="14" ry="5"   fill={sk.shadow} opacity="0.22" />
      <ellipse cx="46" cy="28" rx="9"  ry="5.5" fill={sk.hi}     opacity="0.38" />
      <circle  cx="38" cy="49" r="5.5" fill="#FF9999" opacity="0.22" />
      <circle  cx="62" cy="49" r="5.5" fill="#FF9999" opacity="0.22" />

      <Eyes   style={cfg.eyeStyle} />
      <Nose />
      <Mouth />

      <HairFront hStyle={cfg.hairStyle} hr={hr} />
      <Acc type={cfg.accessory} outfit={cfg.outfitColour} />
    </svg>
  )
}

// ── Body ─────────────────────────────────────────────────────────────────────

function Body({ outfit, skin }: { outfit: string; skin: string }) {
  return (
    <g>
      {/* Neck */}
      <rect x="44" y="60" width="12" height="10" rx="3" fill={skin} />
      {/* Torso */}
      <path
        d="M 30 70 Q 28 66 50 64 Q 72 66 70 70 L 72 108 Q 72 112 68 112 L 32 112 Q 28 112 28 108 Z"
        fill={outfit}
      />
      {/* Collar crease */}
      <path d="M 44 64 Q 50 70 56 64" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Subtle chest shadow line */}
      <path d="M 33 78 Q 50 76 67 78" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      {/* Left arm */}
      <path d="M 30 72 C 20 74 16 88 18 96 L 24 95 C 22 89 26 78 32 76 Z" fill={outfit} />
      <circle cx="20" cy="97" r="5.5" fill={skin} />
      {/* Right arm */}
      <path d="M 70 72 C 80 74 84 88 82 96 L 76 95 C 78 89 74 78 68 76 Z" fill={outfit} />
      <circle cx="80" cy="97" r="5.5" fill={skin} />
    </g>
  )
}

// ── Face features ─────────────────────────────────────────────────────────────

function Nose() {
  return (
    <path
      d="M 48 45 Q 50 48 52 45"
      fill="none" stroke="rgba(100,50,20,0.35)" strokeWidth="1.3" strokeLinecap="round"
    />
  )
}

function Mouth() {
  return (
    <>
      <path d="M 43 52 Q 50 58 57 52" fill="none" stroke="#B85030" strokeWidth="2.2" strokeLinecap="round" />
      {/* Tooth gleam */}
      <path d="M 44.5 53.5 Q 50 57.5 55.5 53.5" fill="rgba(255,255,255,0.55)" />
    </>
  )
}

function Eyes({ style }: { style: EyeStyle }) {
  // shared brow helper
  const brow = (x1: number, xm: number, x2: number, y: number) => (
    <path
      d={`M ${x1} ${y} Q ${xm} ${y - 3} ${x2} ${y}`}
      fill="none" stroke="rgba(70,35,8,0.75)" strokeWidth="1.7" strokeLinecap="round"
    />
  )

  switch (style) {
    case 'round':
      return (
        <g>
          <circle cx="42" cy="38" r="5.5" fill="white" />
          <circle cx="58" cy="38" r="5.5" fill="white" />
          <circle cx="43" cy="38.5" r="3.2" fill="#1A1A2E" />
          <circle cx="59" cy="38.5" r="3.2" fill="#1A1A2E" />
          <circle cx="44.2" cy="37"  r="1.1" fill="white" />
          <circle cx="60.2" cy="37"  r="1.1" fill="white" />
          {brow(38, 42, 46, 32)}
          {brow(54, 58, 62, 32)}
        </g>
      )

    case 'happy':
      return (
        <g>
          <path d="M 37 39 Q 42 34 47 39" fill="none" stroke="#1A1A2E" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M 53 39 Q 58 34 63 39" fill="none" stroke="#1A1A2E" strokeWidth="2.8" strokeLinecap="round" />
          {/* Extra rosy cheeks */}
          <circle cx="37" cy="49" r="6.5" fill="#FF9999" opacity="0.28" />
          <circle cx="63" cy="49" r="6.5" fill="#FF9999" opacity="0.28" />
          {brow(38, 42, 46, 32)}
          {brow(54, 58, 62, 32)}
        </g>
      )

    case 'cool':
      return (
        <g>
          <circle cx="42" cy="38" r="5.5" fill="white" />
          <circle cx="58" cy="38" r="5.5" fill="white" />
          <circle cx="43" cy="39"   r="3.2" fill="#0A0A18" />
          <circle cx="59" cy="39"   r="3.2" fill="#0A0A18" />
          <circle cx="44.2" cy="38" r="1.1" fill="white" />
          <circle cx="60.2" cy="38" r="1.1" fill="white" />
          {/* Heavy drooping eyelids */}
          <path d="M 36.5 36.5 Q 42 35 47.5 36.5" fill="#1A1A2E" />
          <path d="M 52.5 36.5 Q 58 35 63.5 36.5" fill="#1A1A2E" />
          {/* Flat brows */}
          <path d="M 37 31 L 47 31" stroke="#1A1A2E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M 53 31 L 63 31" stroke="#1A1A2E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </g>
      )

    case 'star':
      return (
        <g>
          {/* Dark irises with 4-point star sparkle */}
          <circle cx="42" cy="38" r="5.5" fill="white" />
          <circle cx="58" cy="38" r="5.5" fill="white" />
          <circle cx="42" cy="38" r="4"   fill="#1A1A2E" />
          <circle cx="58" cy="38" r="4"   fill="#1A1A2E" />
          {/* 4-point gold stars */}
          <path d="M 42 33.5 L 43.2 36.8 L 46.5 38 L 43.2 39.2 L 42 42.5 L 40.8 39.2 L 37.5 38 L 40.8 36.8 Z" fill="#FFD700" />
          <path d="M 58 33.5 L 59.2 36.8 L 62.5 38 L 59.2 39.2 L 58 42.5 L 56.8 39.2 L 53.5 38 L 56.8 36.8 Z" fill="#FFD700" />
          {brow(38, 42, 46, 32)}
          {brow(54, 58, 62, 32)}
        </g>
      )

    case 'curious':
      return (
        <g>
          {/* One wider eye (left), one normal (right) */}
          <circle cx="41"   cy="37.5" r="6.5" fill="white" />
          <circle cx="58"   cy="38"   r="4.8" fill="white" />
          <circle cx="42"   cy="38"   r="3.8" fill="#1A1A2E" />
          <circle cx="59"   cy="38.5" r="2.8" fill="#1A1A2E" />
          <circle cx="43.2" cy="36.5" r="1.2" fill="white" />
          <circle cx="60"   cy="37"   r="1"   fill="white" />
          {/* Left brow raised higher */}
          <path d="M 35 30 Q 41 27 47 30" fill="none" stroke="rgba(70,35,8,0.75)" strokeWidth="1.7" strokeLinecap="round" />
          {brow(54, 58, 62, 33)}
        </g>
      )

    default:
      return null
  }
}

// ── Hair back layer (behind head) ────────────────────────────────────────────

function HairBack({ hStyle, hr }: { hStyle: HairStyle; hr: HP }) {
  switch (hStyle) {
    case 'long':
      return (
        <g>
          <path d="M 28 38 Q 22 54 22 72 Q 21 84 27 88 Q 31 86 30 72 Q 29 56 32 42" fill={hr.base} />
          <path d="M 72 38 Q 78 54 78 72 Q 79 84 73 88 Q 69 86 70 72 Q 71 56 68 42" fill={hr.base} />
          <path d="M 24 52 Q 23 64 25 76" fill="none" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          <path d="M 76 52 Q 77 64 75 76" fill="none" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        </g>
      )
    case 'ponytail':
      return (
        <g>
          <path d="M 70 36 Q 86 34 90 50 Q 93 64 84 73 Q 78 77 72 68 Q 80 60 78 48 Q 76 38 70 38" fill={hr.base} />
          <path d="M 82 40 Q 86 53 82 65" fill="none" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        </g>
      )
    case 'braids':
      return (
        <g>
          {/* Left braid */}
          <path d="M 29 46 Q 22 58 24 74 Q 25 84 30 86 Q 34 84 32 74 Q 30 60 34 48" fill={hr.base} />
          <path d="M 26 56 Q 22 63 24 70" fill="none" stroke={hr.hi} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
          <path d="M 28 68 Q 24 74 26 80" fill="none" stroke={hr.hi} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
          {/* Right braid */}
          <path d="M 71 46 Q 78 58 76 74 Q 75 84 70 86 Q 66 84 68 74 Q 70 60 66 48" fill={hr.base} />
          <path d="M 74 56 Q 78 63 76 70" fill="none" stroke={hr.hi} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
          <path d="M 72 68 Q 76 74 74 80" fill="none" stroke={hr.hi} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
        </g>
      )
    case 'afro':
      // Main afro volume sits behind the head; face shows through
      return (
        <g>
          <circle cx="50" cy="30" r="30" fill={hr.base} />
          <circle cx="34" cy="20" r="10" fill={hr.hi} opacity="0.18" />
          <circle cx="64" cy="18" r="9"  fill={hr.hi} opacity="0.18" />
          <circle cx="50" cy="14" r="10" fill={hr.hi} opacity="0.18" />
          <circle cx="22" cy="36" r="8"  fill={hr.hi} opacity="0.14" />
          <circle cx="78" cy="34" r="8"  fill={hr.hi} opacity="0.14" />
        </g>
      )
    default:
      return null
  }
}

// ── Hair front layer (on top of head) ────────────────────────────────────────

function HairFront({ hStyle, hr }: { hStyle: HairStyle; hr: HP }) {
  switch (hStyle) {
    case 'short':
      return (
        <g>
          <path d="M 28 40 Q 28 16 50 16 Q 72 16 72 40 Q 66 30 50 28 Q 34 30 28 40 Z" fill={hr.base} />
          <path d="M 33 28 Q 42 20 50 20 Q 60 20 67 26" fill="none" stroke={hr.hi} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </g>
      )
    case 'long':
      return (
        <g>
          <path d="M 28 40 Q 28 16 50 16 Q 72 16 72 40 Q 66 30 50 28 Q 34 30 28 40 Z" fill={hr.base} />
          <path d="M 33 26 Q 42 20 50 20 Q 60 20 67 24" fill="none" stroke={hr.hi} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </g>
      )
    case 'curly':
      return (
        <g>
          <path d="M 28 40 Q 28 26 34 20 Q 40 14 50 14 Q 60 14 66 20 Q 72 26 72 40 Q 66 32 50 30 Q 34 32 28 40 Z" fill={hr.base} />
          {/* Curly bumps around the top */}
          <circle cx="32" cy="24" r="7"   fill={hr.base} />
          <circle cx="42" cy="17" r="7.5" fill={hr.base} />
          <circle cx="50" cy="15" r="7.5" fill={hr.base} />
          <circle cx="58" cy="17" r="7.5" fill={hr.base} />
          <circle cx="68" cy="24" r="7"   fill={hr.base} />
          <circle cx="30" cy="21" r="3"   fill={hr.hi}   opacity="0.45" />
          <circle cx="50" cy="12" r="3.5" fill={hr.hi}   opacity="0.45" />
          <circle cx="70" cy="21" r="3"   fill={hr.hi}   opacity="0.45" />
        </g>
      )
    case 'bun':
      return (
        <g>
          <path d="M 28 40 Q 28 22 50 20 Q 72 22 72 40 Q 66 32 50 30 Q 34 32 28 40 Z" fill={hr.base} />
          {/* Bun */}
          <circle cx="50" cy="13" r="12"  fill={hr.base} />
          <circle cx="47" cy="10" r="5"   fill={hr.hi}   opacity="0.32" />
          {/* Hair tie */}
          <ellipse cx="50" cy="23" rx="8" ry="3.5" fill={hr.base} />
          <ellipse cx="50" cy="23" rx="8" ry="3.5" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
        </g>
      )
    case 'ponytail':
      return (
        <g>
          <path d="M 28 40 Q 28 18 50 16 Q 72 18 72 40 Q 66 30 50 28 Q 34 30 28 40 Z" fill={hr.base} />
          {/* Ponytail band */}
          <circle cx="70" cy="37" r="4.5" fill={hr.base} />
          <circle cx="70" cy="37" r="4.5" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1.5" />
          <path d="M 33 26 Q 42 20 50 20" fill="none" stroke={hr.hi} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        </g>
      )
    case 'spiky':
      return (
        <g>
          <path d="M 28 40 Q 28 22 50 18 Q 72 22 72 40 Q 66 32 50 30 Q 34 32 28 40 Z" fill={hr.base} />
          {/* Spikes */}
          <path d="M 34 28 L 36 13 L 40 27" fill={hr.base} />
          <path d="M 43 24 L 46 9  L 50 23" fill={hr.base} />
          <path d="M 50 23 L 54 9  L 57 24" fill={hr.base} />
          <path d="M 60 27 L 64 13 L 66 28" fill={hr.base} />
          {/* Spike highlights */}
          <line x1="36" y1="24" x2="36" y2="15" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          <line x1="46" y1="20" x2="46" y2="11" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          <line x1="54" y1="20" x2="54" y2="11" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
          <line x1="64" y1="24" x2="64" y2="15" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        </g>
      )
    case 'afro':
      // Extra poof bumps on top above the hairline
      return (
        <g>
          <circle cx="50" cy="10" r="9"  fill={hr.base} />
          <circle cx="36" cy="16" r="8"  fill={hr.base} />
          <circle cx="64" cy="16" r="8"  fill={hr.base} />
          <circle cx="34" cy="14" r="3"  fill={hr.hi}   opacity="0.38" />
          <circle cx="50" cy="7"  r="3.5" fill={hr.hi}  opacity="0.38" />
          <circle cx="66" cy="14" r="3"  fill={hr.hi}   opacity="0.38" />
        </g>
      )
    case 'braids':
      return (
        <g>
          <path d="M 28 40 Q 28 18 50 16 Q 72 18 72 40 Q 66 30 50 28 Q 34 30 28 40 Z" fill={hr.base} />
          {/* Centre part */}
          <line x1="50" y1="16" x2="50" y2="34" stroke={hr.hi} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <path d="M 36 22 Q 40 24 44 22" fill="none" stroke={hr.hi} strokeWidth="1.2" strokeLinecap="round" opacity="0.38" />
          <path d="M 56 22 Q 60 24 64 22" fill="none" stroke={hr.hi} strokeWidth="1.2" strokeLinecap="round" opacity="0.38" />
        </g>
      )
    default:
      return null
  }
}

// ── Accessory ─────────────────────────────────────────────────────────────────

function Acc({ type, outfit }: { type: Accessory; outfit: string }) {
  switch (type) {
    case 'crown':
      return (
        <g>
          <path
            d="M 33 23 L 33 14 L 39 20 L 50 11 L 61 20 L 67 14 L 67 23 Z"
            fill="#FFD700" stroke="#D4A000" strokeWidth="0.8" strokeLinejoin="round"
          />
          <rect x="33" y="21" width="34" height="5" rx="1.5" fill="#FFD700" stroke="#D4A000" strokeWidth="0.5" />
          <circle cx="41" cy="17"  r="2.2" fill="#E74C3C" />
          <circle cx="50" cy="12.5" r="2.5" fill="#3498DB" />
          <circle cx="59" cy="17"  r="2.2" fill="#2ECC71" />
          <path d="M 36 22 L 38 16" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'glasses':
      return (
        <g>
          <circle cx="42" cy="38" r="7.5" fill="none" stroke="#3A3A3A" strokeWidth="2" />
          <circle cx="58" cy="38" r="7.5" fill="none" stroke="#3A3A3A" strokeWidth="2" />
          <path d="M 49.5 38 L 50.5 38" stroke="#3A3A3A" strokeWidth="2" strokeLinecap="round" />
          <path d="M 24 37 Q 28 38.5 34.5 38" stroke="#3A3A3A" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 76 37 Q 72 38.5 65.5 38" stroke="#3A3A3A" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="42" cy="38" r="7.5" fill={outfit} opacity="0.13" />
          <circle cx="58" cy="38" r="7.5" fill={outfit} opacity="0.13" />
        </g>
      )

    case 'headband':
      return (
        <g>
          <path
            d="M 28 34 Q 38 28 50 26 Q 62 28 72 34"
            fill="none" stroke={outfit} strokeWidth="7.5" strokeLinecap="round"
          />
          <path
            d="M 28 34 Q 38 28 50 26 Q 62 28 72 34"
            fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round"
          />
        </g>
      )

    case 'bow':
      return (
        <g>
          {/* Left wing */}
          <path d="M 58 20 Q 52 13 59 16 Q 64 11 67 18 Z" fill="#FF8FAB" />
          {/* Right wing */}
          <path d="M 67 18 Q 72 11 75 17 Q 73 22 67 20 Z" fill="#FF8FAB" />
          {/* Centre knot */}
          <circle cx="67" cy="19" r="3.5" fill="#D94077" />
          {/* Ribbon tails */}
          <path d="M 64 22 Q 61 27 59 30" fill="none" stroke="#FF8FAB" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 70 22 Q 73 27 75 30" fill="none" stroke="#FF8FAB" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 60 15 Q 63 12 65 14" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        </g>
      )

    case 'cap':
      return (
        <g>
          {/* Dome */}
          <path
            d="M 28 36 Q 28 14 50 12 Q 72 14 72 36 Q 66 28 50 26 Q 34 28 28 36 Z"
            fill={outfit}
          />
          {/* Brim */}
          <path
            d="M 22 38 Q 28 42 50 41 Q 72 42 78 38 Q 72 34 50 34 Q 28 34 22 38 Z"
            fill={outfit}
          />
          <path d="M 22 38 Q 28 40.5 50 39.5 Q 72 40.5 78 38" fill="rgba(0,0,0,0.14)" />
          <circle cx="50" cy="13.5" r="3" fill="rgba(0,0,0,0.2)" />
          <path d="M 44 37.5 Q 50 36.5 56 37.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        </g>
      )

    case 'halo':
      return (
        <g>
          <ellipse cx="50" cy="12" rx="20" ry="6"  fill="none" stroke="#FFD700" strokeWidth="4.5" />
          <ellipse cx="50" cy="12" rx="20" ry="6"  fill="none" stroke="rgba(255,238,80,0.45)" strokeWidth="2" />
          <ellipse cx="50" cy="12" rx="23" ry="7.5" fill="none" stroke="rgba(255,220,0,0.15)" strokeWidth="5" />
        </g>
      )

    case 'horns':
      return (
        <g>
          <path d="M 36 26 Q 32 13 38 10 Q 40 18 38 26 Z" fill="#CC2222" />
          <path d="M 37 24 Q 34 14 38 11" fill="none" stroke="#FF4444" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
          <path d="M 64 26 Q 68 13 62 10 Q 60 18 62 26 Z" fill="#CC2222" />
          <path d="M 63 24 Q 66 14 62 11" fill="none" stroke="#FF4444" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        </g>
      )

    case 'none':
    default:
      return null
  }
}
