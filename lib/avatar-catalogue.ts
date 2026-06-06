// Decifer Avatar System — catalogue of options and unlock requirements.
// avatar_config JSONB shape: AvatarConfig (new) or { base, colour } (legacy — handled by /api/profile/me).

export type SkinTone   = 'light' | 'medLight' | 'medium' | 'tan' | 'brown' | 'dark'
export type HairStyle  = 'short' | 'long' | 'curly' | 'bun' | 'ponytail' | 'spiky' | 'afro' | 'braids'
export type HairColour = 'black' | 'brown' | 'blonde' | 'auburn' | 'blue' | 'purple' | 'pink' | 'silver'
export type EyeStyle   = 'round' | 'happy' | 'cool' | 'star' | 'curious'
export type Accessory  = 'none' | 'headband' | 'bow' | 'glasses' | 'cap' | 'halo' | 'crown' | 'horns'

export interface AvatarConfig {
  skinTone:     SkinTone
  hairStyle:    HairStyle
  hairColour:   HairColour
  eyeStyle:     EyeStyle
  accessory:    Accessory
  outfitColour: string
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone:     'medium',
  hairStyle:    'short',
  hairColour:   'brown',
  eyeStyle:     'round',
  accessory:    'none',
  outfitColour: '#6C9EFF',
}

// ── Unlock requirements ──────────────────────────────────────────────────────
// xp: points threshold. No entry = free from the start.

export interface UnlockReq { xp: number }

export const HAIR_STYLES: { id: HairStyle; name: string; unlock?: UnlockReq }[] = [
  { id: 'short',    name: 'Short' },
  { id: 'curly',    name: 'Curly' },
  { id: 'bun',      name: 'Bun' },
  { id: 'long',     name: 'Long',     unlock: { xp: 200 } },
  { id: 'ponytail', name: 'Ponytail', unlock: { xp: 500 } },
  { id: 'spiky',    name: 'Spiky',    unlock: { xp: 900 } },
  { id: 'afro',     name: 'Afro',     unlock: { xp: 1400 } },
  { id: 'braids',   name: 'Braids',   unlock: { xp: 2200 } },
]

export const HAIR_COLOURS: { id: HairColour; hex: string; name: string; unlock?: UnlockReq }[] = [
  { id: 'black',  hex: '#1A1A2E', name: 'Black' },
  { id: 'brown',  hex: '#5C3317', name: 'Brown' },
  { id: 'blonde', hex: '#C8962A', name: 'Blonde' },
  { id: 'auburn', hex: '#7A2200', name: 'Auburn' },
  { id: 'blue',   hex: '#1E4CB0', name: 'Blue',   unlock: { xp: 600 } },
  { id: 'purple', hex: '#6A1F8A', name: 'Purple', unlock: { xp: 1100 } },
  { id: 'pink',   hex: '#C0246A', name: 'Pink',   unlock: { xp: 1800 } },
  { id: 'silver', hex: '#7878A0', name: 'Silver', unlock: { xp: 3200 } },
]

export const SKIN_TONES: { id: SkinTone; swatch: string; name: string }[] = [
  { id: 'light',    swatch: '#FDDBB4', name: 'Light'    },
  { id: 'medLight', swatch: '#F5C28A', name: 'Med-light' },
  { id: 'medium',   swatch: '#D4956A', name: 'Medium'   },
  { id: 'tan',      swatch: '#C68642', name: 'Tan'      },
  { id: 'brown',    swatch: '#8B5524', name: 'Brown'    },
  { id: 'dark',     swatch: '#4E2C0E', name: 'Dark'     },
]

export const EYE_STYLES: { id: EyeStyle; name: string; unlock?: UnlockReq }[] = [
  { id: 'round',   name: 'Round' },
  { id: 'happy',   name: 'Happy' },
  { id: 'curious', name: 'Curious' },
  { id: 'cool',    name: 'Cool',  unlock: { xp: 700 } },
  { id: 'star',    name: 'Star',  unlock: { xp: 1200 } },
]

export const ACCESSORIES: { id: Accessory; name: string; unlock?: UnlockReq }[] = [
  { id: 'none',     name: 'None' },
  { id: 'headband', name: 'Headband', unlock: { xp: 300 } },
  { id: 'bow',      name: 'Bow',      unlock: { xp: 650 } },
  { id: 'glasses',  name: 'Glasses',  unlock: { xp: 1000 } },
  { id: 'cap',      name: 'Cap',      unlock: { xp: 1600 } },
  { id: 'halo',     name: 'Halo',     unlock: { xp: 2800 } },
  { id: 'crown',    name: 'Crown',    unlock: { xp: 4500 } },
  { id: 'horns',    name: 'Horns',    unlock: { xp: 6000 } },
]

export const OUTFIT_COLOURS: { id: string; hex: string; name: string }[] = [
  { id: 'blue',   hex: '#6C9EFF', name: 'Blue'   },
  { id: 'pink',   hex: '#FF8FAB', name: 'Pink'   },
  { id: 'green',  hex: '#52D9A0', name: 'Green'  },
  { id: 'gold',   hex: '#FFC107', name: 'Gold'   },
  { id: 'purple', hex: '#9B59B6', name: 'Purple' },
  { id: 'orange', hex: '#FB5A24', name: 'Orange' },
]

export function isUnlocked(req: UnlockReq | undefined, totalPoints: number): boolean {
  if (!req) return true
  return totalPoints >= req.xp
}
