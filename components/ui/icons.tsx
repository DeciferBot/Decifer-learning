/**
 * Decifer Learning — Professional SVG line icon library
 *
 * Style: 24×24 viewBox · 1.5px stroke · round caps/joins · no fill
 * Usage: <BookOpen className="w-5 h-5 text-brand" />
 */

import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

// ─── Learning & curriculum ────────────────────────────────────────────────────

export function BookOpen(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2 6.5C2 5.4 2.9 4.5 4 4.5h7v15H4a2 2 0 0 1-2-2V6.5Z" />
      <path d="M22 6.5C22 5.4 21.1 4.5 20 4.5h-7v15h7a2 2 0 0 0 2-2V6.5Z" />
      <path d="M11 4.5v15M7 8h1M7 11h1M7 14h1M16 8h1M16 11h1M16 14h1" />
    </Icon>
  )
}

export function PencilLine(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M15.232 4.768a2.5 2.5 0 0 1 3.536 3.536L7.5 19.572 3 21l1.428-4.5L15.232 4.768Z" />
      <path d="M13 7l3.5 3.5" />
      <path d="M3 21h18" />
    </Icon>
  )
}

export function Zap(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12.5L13 2Z" />
    </Icon>
  )
}

export function Brain(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 3.5a3 3 0 0 0-3 3c0 .5.1 1 .3 1.4A3.5 3.5 0 0 0 3 11.5a3.5 3.5 0 0 0 2.5 3.35V17a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2.15A3.5 3.5 0 0 0 21 11.5a3.5 3.5 0 0 0-3.3-3.6A3 3 0 0 0 15 3.5a3 3 0 0 0-2.5 1.35A3 3 0 0 0 9 3.5Z" />
      <path d="M12 4.85V19M8 10.5h8M8 14.5h8" />
    </Icon>
  )
}

export function Microscope(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10 3h4v10h-4z" />
      <path d="M9 7H7a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2" />
      <path d="M15 7h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2" />
      <path d="M12 13v4" />
      <ellipse cx="12" cy="19" rx="5" ry="2" />
      <path d="M7 21h10" />
    </Icon>
  )
}

export function Compass(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
    </Icon>
  )
}

export function Telescope(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" />
      <path d="m16 21-3.105-6.21" />
      <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.932-.518a1 1 0 0 1 1.213.727l1.053 3.93a1 1 0 0 1-.727 1.213l-1.932.518a2 2 0 0 1-2.425-1.455z" />
      <path d="m6.158 8.633 1.114 4.153" />
      <path d="M8 21l3.105-6.21" />
      <circle cx="12" cy="21" r="1" />
    </Icon>
  )
}

export function FlaskConical(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10 2v7.31l-5.43 9.41A1 1 0 0 0 5.43 21H18.57a1 1 0 0 0 .86-1.28L14 9.31V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </Icon>
  )
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function Home(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Icon>
  )
}

export function MapFold(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.645V16.22a2 2 0 0 1-1.106 1.789l-3.659 1.83a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 18.645V7.071a2 2 0 0 1 1.106-1.789l3.659-1.83a2 2 0 0 1 1.788 0z" />
      <path d="M9 5v14M15 5v14" />
    </Icon>
  )
}

export function LayoutGrid(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </Icon>
  )
}

export function UserCircle(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.168 18.849A4 4 0 0 1 10 17h4a4 4 0 0 1 3.832 1.849" />
    </Icon>
  )
}

export function Users(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  )
}

export function GraduationCap(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </Icon>
  )
}

export function Backpack(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10Z" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" />
      <path d="M8 10h8" />
    </Icon>
  )
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export function Trophy(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9H3.5a2.5 2.5 0 0 0 0 5H6" />
      <path d="M18 9h2.5a2.5 2.5 0 0 1 0 5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Icon>
  )
}

export function Medal(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2" />
      <path d="m13 12 5.88-9.8" />
      <path d="M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </Icon>
  )
}

export function Star(p: IconProps) {
  return (
    <Icon {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  )
}

export function Crown(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </Icon>
  )
}

export function Gem(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 3h12l4 6-10 13L2 9Z" />
      <path d="M11 3 8 9l4 13 4-13-3-6" />
      <path d="M2 9h20" />
    </Icon>
  )
}

export function Shield(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  )
}

export function ShieldCheck(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  )
}

export function HeartFull(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Icon>
  )
}

export function HeartEmpty(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Icon>
  )
}

export function HeartCrack(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="m12 13-1-4 2-2-3-4" />
    </Icon>
  )
}

export function Flame(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Icon>
  )
}

export function Swords(p: IconProps) {
  return (
    <Icon {...p}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" x2="9" y1="14" y2="18" />
      <line x1="7" x2="4" y1="17" y2="20" />
      <line x1="3" x2="5" y1="19" y2="21" />
    </Icon>
  )
}

export function Sparkles(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
    </Icon>
  )
}

export function Gift(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </Icon>
  )
}

export function GiftLocked(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  )
}

// ─── Status & feedback ────────────────────────────────────────────────────────

export function CircleCheck(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  )
}

export function CircleX(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </Icon>
  )
}

export function Lightbulb(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 22h4" />
    </Icon>
  )
}

export function Target(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  )
}

export function Flag(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </Icon>
  )
}

export function FlagCheckered(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
      <path d="M8 3v4M12 4v3M16 3v4M8 9v2M12 9v2M16 9v2" strokeWidth="1" />
    </Icon>
  )
}

export function Lock(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  )
}

export function Unlock(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </Icon>
  )
}

export function AlertTriangle(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </Icon>
  )
}

export function RefreshCw(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Icon>
  )
}

// ─── Data & progress ──────────────────────────────────────────────────────────

export function BarChart(p: IconProps) {
  return (
    <Icon {...p}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
      <line x1="2" x2="22" y1="20" y2="20" />
    </Icon>
  )
}

export function TrendingUp(p: IconProps) {
  return (
    <Icon {...p}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Icon>
  )
}

export function ClipboardList(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </Icon>
  )
}

export function Search(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  )
}

export function MapPin(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Icon>
  )
}

export function Link2(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </Icon>
  )
}

// ─── Zone themes ──────────────────────────────────────────────────────────────

export function Leaf(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </Icon>
  )
}

export function TreePine(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3A1 1 0 0 1 15.2 9H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" />
      <path d="M12 22v-3" />
    </Icon>
  )
}

export function Mountain(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </Icon>
  )
}

export function Hexagon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </Icon>
  )
}

export function ScrollText(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M15 8h-5M15 12h-5" />
    </Icon>
  )
}

export function Anvil(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 10H6a4 4 0 0 1 0-8h11a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-1" />
      <path d="M7 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7z" />
      <path d="M9 21v-4" />
      <path d="M15 21v-4" />
      <path d="M8 21h8" />
    </Icon>
  )
}

// ─── Admin & monitoring ───────────────────────────────────────────────────────

export function Package(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </Icon>
  )
}

export function CheckCircle2(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  )
}

export function Scale(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10M12 3v18M3.5 8h5M15.5 8h5" />
    </Icon>
  )
}

export function Eye(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function Bell(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  )
}

export function CalendarDays(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </Icon>
  )
}

export function Clock(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  )
}

export function ChevronRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  )
}

export function ChevronLeft(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

export function ArrowRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Icon>
  )
}

export function X(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function Check(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  )
}
