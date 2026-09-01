// The onboarding wizard looks its option icons up by name. A name with no
// entry falls back to a generic icon and nothing complains, so two different
// options can quietly end up wearing the same picture. That is exactly what
// happened when History and Geography were added to FAVOURITE_SUBJECTS: both
// would have shown the Maths icon.
//
// These tests make that a failure instead of a shrug.

import { describe, it, expect } from 'vitest'
import {
  FAVOURITE_SUBJECTS,
  INTERESTS,
  LEARN_STYLES,
  CONFIDENCE_LEVELS,
} from '@/lib/onboarding-config'
import { ONBOARDING_ICONS } from '@/lib/onboarding-icons'

// CONFIDENCE_AREAS is deliberately absent: those two rows are plain labels with
// no icon of their own.
const ALL_OPTIONS: readonly { id: string; iconName: string }[] = [
  ...FAVOURITE_SUBJECTS.map((o) => ({ id: o.id, iconName: o.iconName })),
  ...INTERESTS.map((o) => ({ id: o.id, iconName: o.iconName })),
  ...LEARN_STYLES.map((o) => ({ id: o.id, iconName: o.iconName })),
  ...CONFIDENCE_LEVELS.map((o) => ({ id: `confidence-${o.value}`, iconName: o.iconName })),
]

describe('onboarding option icons', () => {
  it('has a registered icon for every option', () => {
    const missing = ALL_OPTIONS.filter((o) => !ONBOARDING_ICONS[o.iconName]).map(
      (o) => `${o.id} → ${o.iconName}`,
    )
    expect(missing).toEqual([])
  })

  it('gives every subject a distinct icon, so none of them look alike', () => {
    const names = FAVOURITE_SUBJECTS.map((s) => s.iconName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('offers every subject Decifer teaches', () => {
    const ids = FAVOURITE_SUBJECTS.map((s) => s.id)
    for (const subject of ['maths', 'english', 'science', 'history', 'geography']) {
      expect(ids).toContain(subject)
    }
  })
})
