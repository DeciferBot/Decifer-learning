// Icon lookup for the onboarding wizard's option cards.
//
// This lives apart from the wizard so a test can check it against
// lib/onboarding-config.ts. Every `iconName` in that file must have an entry
// here: a missing one falls back to a generic icon without any error, which is
// how History and Geography were about to show the same picture as Maths.

import {
  Target, BookOpen, FlaskConical, Search, ScrollText, MapFold,
  Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil,
  Eye, Zap, TrendingUp, Star, Trophy,
} from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

export type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export const ONBOARDING_ICONS: Record<string, IconComp> = {
  Target, BookOpen, FlaskConical, Search, ScrollText, MapFold,
  Telescope, Dragon, PencilLine, Layers, Music, Leaf, Anvil,
  Eye, Zap, TrendingUp, Star, Trophy,
}
