import { describe, it, expect } from 'vitest'
import { resolveStreak, earnsFreeze, displayedStreak, streakAtRisk, MAX_STREAK_FREEZES } from '@/lib/streak'

const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

describe('resolveStreak', () => {
  it('starts a streak at 1 for a child who has never played', () => {
    expect(resolveStreak({ lastRoundOn: null, streakDays: 0, freezesAvailable: 0, now: at('2026-07-30') }))
      .toEqual({ streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('is idempotent within the same day', () => {
    // The home screen calls this on every mount.
    const out = resolveStreak({ lastRoundOn: at('2026-07-30'), streakDays: 5, freezesAvailable: 2, now: at('2026-07-30') })
    expect(out).toEqual({ streakDays: 5, changed: false, freezesUsed: 0, streakSaved: false })
  })

  it('does not count a later time on the same UTC day as a new day', () => {
    const out = resolveStreak({
      lastRoundOn: new Date('2026-07-30T01:00:00.000Z'),
      streakDays: 3,
      freezesAvailable: 0,
      now: new Date('2026-07-30T23:59:00.000Z'),
    })
    expect(out.changed).toBe(false)
    expect(out.streakDays).toBe(3)
  })

  it('increments when the child played yesterday', () => {
    expect(resolveStreak({ lastRoundOn: at('2026-07-29'), streakDays: 5, freezesAvailable: 0, now: at('2026-07-30') }))
      .toEqual({ streakDays: 6, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('resets to 1 after a missed day when no freeze is held', () => {
    // The behaviour that kept every streak on this product under 5 days.
    expect(resolveStreak({ lastRoundOn: at('2026-07-28'), streakDays: 9, freezesAvailable: 0, now: at('2026-07-30') }))
      .toEqual({ streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('spends one freeze to survive one missed day', () => {
    expect(resolveStreak({ lastRoundOn: at('2026-07-28'), streakDays: 9, freezesAvailable: 1, now: at('2026-07-30') }))
      .toEqual({ streakDays: 10, changed: true, freezesUsed: 1, streakSaved: true })
  })

  it('spends two freezes to survive two missed days', () => {
    expect(resolveStreak({ lastRoundOn: at('2026-07-27'), streakDays: 9, freezesAvailable: 2, now: at('2026-07-30') }))
      .toEqual({ streakDays: 10, changed: true, freezesUsed: 2, streakSaved: true })
  })

  it('resets when two days were missed but only one freeze is held', () => {
    expect(resolveStreak({ lastRoundOn: at('2026-07-27'), streakDays: 9, freezesAvailable: 1, now: at('2026-07-30') }))
      .toEqual({ streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('never covers more than the freeze cap, however many are held', () => {
    // A fortnight away is a lapsed child, not a streak to protect.
    expect(resolveStreak({ lastRoundOn: at('2026-07-16'), streakDays: 30, freezesAvailable: 99, now: at('2026-07-30') }))
      .toEqual({ streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('handles a gap that spans a month boundary', () => {
    expect(resolveStreak({ lastRoundOn: at('2026-06-30'), streakDays: 4, freezesAvailable: 0, now: at('2026-07-01') }))
      .toEqual({ streakDays: 5, changed: true, freezesUsed: 0, streakSaved: false })
  })

  it('treats a clock that went backwards as the same day rather than resetting', () => {
    const out = resolveStreak({ lastRoundOn: at('2026-07-31'), streakDays: 6, freezesAvailable: 0, now: at('2026-07-30') })
    expect(out.changed).toBe(false)
    expect(out.streakDays).toBe(6)
  })
})

describe('earnsFreeze', () => {
  it('awards on every third day of a streak', () => {
    expect(earnsFreeze(3, 0)).toBe(true)
    expect(earnsFreeze(6, 0)).toBe(true)
    expect(earnsFreeze(9, 1)).toBe(true)
  })

  it('does not award on other days', () => {
    expect(earnsFreeze(1, 0)).toBe(false)
    expect(earnsFreeze(2, 0)).toBe(false)
    expect(earnsFreeze(4, 0)).toBe(false)
  })

  it('stops at the cap', () => {
    expect(earnsFreeze(3, MAX_STREAK_FREEZES)).toBe(false)
    expect(earnsFreeze(9, MAX_STREAK_FREEZES)).toBe(false)
  })

  it('ignores a zero or negative streak', () => {
    expect(earnsFreeze(0, 0)).toBe(false)
    expect(earnsFreeze(-3, 0)).toBe(false)
  })
})

describe('displayedStreak', () => {
  const base = { streakDays: 9, freezesAvailable: 0, now: at('2026-07-30') }

  it('shows nothing when the child has never finished a round', () => {
    expect(displayedStreak({ ...base, lastRoundOn: null })).toBe(0)
  })

  it('shows the streak when they played today', () => {
    expect(displayedStreak({ ...base, lastRoundOn: at('2026-07-30') })).toBe(9)
  })

  it('shows the streak when they played yesterday and today is still open', () => {
    expect(displayedStreak({ ...base, lastRoundOn: at('2026-07-29') })).toBe(9)
  })

  it('shows 0 once the streak has lapsed with no freeze to cover it', () => {
    // The bug this exists for: reading streak_days raw would tell a child who
    // last played a fortnight ago that they still have a 9 day streak.
    expect(displayedStreak({ ...base, lastRoundOn: at('2026-07-16') })).toBe(0)
    expect(displayedStreak({ ...base, lastRoundOn: at('2026-07-28') })).toBe(0)
  })

  it('keeps showing the streak while a freeze still covers the gap', () => {
    expect(displayedStreak({ ...base, freezesAvailable: 1, lastRoundOn: at('2026-07-28') })).toBe(9)
    expect(displayedStreak({ ...base, freezesAvailable: 2, lastRoundOn: at('2026-07-27') })).toBe(9)
  })

  it('does not cover a gap beyond the freeze cap', () => {
    expect(displayedStreak({ ...base, freezesAvailable: 99, lastRoundOn: at('2026-07-25') })).toBe(0)
  })

  it('reports nothing for a zero stored streak', () => {
    expect(displayedStreak({ ...base, streakDays: 0, lastRoundOn: at('2026-07-30') })).toBe(0)
  })
})

describe('streakAtRisk', () => {
  const base = { streakDays: 5, freezesAvailable: 0, now: at('2026-07-30') }

  it('is false when today is already done', () => {
    expect(streakAtRisk({ ...base, lastRoundOn: at('2026-07-30') })).toBe(false)
  })

  it('is true when the last round was yesterday and today is still open', () => {
    expect(streakAtRisk({ ...base, lastRoundOn: at('2026-07-29') })).toBe(true)
  })

  it('is false once the streak has already lapsed — nothing left to save', () => {
    expect(streakAtRisk({ ...base, lastRoundOn: at('2026-07-20') })).toBe(false)
  })

  it('is false when the child has never played', () => {
    expect(streakAtRisk({ ...base, lastRoundOn: null })).toBe(false)
  })
})
