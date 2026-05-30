// Avatar and study-buddy configuration — single source of truth.
// The page file should import from here.

export const AVATARS = [
  { id: 'wizard',    name: 'Wizard'    },
  { id: 'knight',    name: 'Knight'    },
  { id: 'explorer',  name: 'Explorer'  },
  { id: 'scientist', name: 'Scientist' },
  { id: 'artist',    name: 'Artist'    },
  { id: 'athlete',   name: 'Athlete'   },
  { id: 'musician',  name: 'Musician'  },
  { id: 'chef',      name: 'Chef'      },
] as const

export type AvatarId = typeof AVATARS[number]['id']

export const BUDDIES = [
  { id: 'owl',    name: 'Owl'    },
  { id: 'fox',    name: 'Fox'    },
  { id: 'robot',  name: 'Robot'  },
  { id: 'dragon', name: 'Dragon' },
] as const

export type BuddyId = typeof BUDDIES[number]['id']
