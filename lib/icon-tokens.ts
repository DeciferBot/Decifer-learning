// Central mapping of semantic tokens to icon components.
// Import from here instead of hardcoding emoji in UI files.

import {
  Star, Trophy, Medal, Gem, Lock, Flame, Gift, Sparkles,
  BookOpen, Target, BarChart, MapPin, CalendarDays, Flag,
  Package, Truck, RefreshCw, Lightbulb, Zap, Swords,
  FlagCheckered, Check, X, CircleCheck, CircleX,
  Brain, Microscope, FlaskConical, Compass, PencilLine,
  Layers, Music, ChefHat, Owl, Fox, Robot, Dragon,
} from '@/components/ui/icons'
import type { SVGProps } from 'react'

export type IconComponent = (p: SVGProps<SVGSVGElement> & { size?: number }) => JSX.Element

// Milestone tiers
export const MILESTONE_ICONS: Record<string, IconComponent> = {
  none:     Lock,
  bronze:   Medal,
  silver:   Trophy,
  gold:     Star,
  platinum: Gem,
}

// Reward Vault status
export const VAULT_STATUS_ICONS: Record<string, IconComponent> = {
  approved:   Package,
  dispatched: Truck,
  delivered:  Check,
}

// Dashboard stat icons
export const STAT_ICONS = {
  progress:  BarChart,
  accuracy:  Target,
  weakAreas: MapPin,
  activity:  CalendarDays,
} as const

// Avatar characters (used in customise page)
export const AVATAR_ICONS: Record<string, IconComponent> = {
  wizard:    Brain,
  knight:    Swords,
  explorer:  Compass,
  scientist: Microscope,
  artist:    PencilLine,
  athlete:   Zap,
  musician:  Music,
  chef:      ChefHat,
}

// Study buddies
export const BUDDY_ICONS: Record<string, IconComponent> = {
  owl:    Owl,
  fox:    Fox,
  robot:  Robot,
  dragon: Dragon,
}

// Re-export all used icons so consumers can import from one place
export {
  Star, Trophy, Medal, Gem, Lock, Flame, Gift, Sparkles,
  BookOpen, Target, BarChart, MapPin, CalendarDays, Flag,
  Package, Truck, RefreshCw, Lightbulb, Zap, Swords,
  FlagCheckered, Check, X, CircleCheck, CircleX,
  Brain, Microscope, FlaskConical, Compass, PencilLine,
  Layers, Music, ChefHat, Owl, Fox, Robot, Dragon,
}
