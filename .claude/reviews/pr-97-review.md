# PR Review: #97 — design(games, practice, site): one colour policy, readable everywhere

**Reviewed**: 2026-08-19
**Author**: Amit Chopra (with Claude)
**Branch**: `claude/game-pages-visual-upgrade-9228ea` → `main` (merged as `6424035`)
**Decision**: REQUEST CHANGES at review time — all findings now fixed in a follow-up

## Summary

The colour work holds up: the policy is consistent, the tokens are right, and the
contrast measurements were verified in a real browser. The defects are in the
code that colour work did not touch — the game logic added alongside it. One is a
crash that reaches production users.

The common thread is worth naming: every real bug lived inside a `'use client'`
component, where the node-only test suite could not reach it, and on a surface
that is either auth-gated or only appears late in a game. Types, build and a
contrast audit all passed while a `RangeError` sat in the chess board.

## Findings

### CRITICAL

**1. Chess board crashes on pawn promotion** — `components/games/ChessGame.tsx:433`

`CapturedStrip` computed `Array((n - remaining) || 0).fill(type)`. Promotion puts
more of a piece on the board than the set started with, and this game *always*
auto-promotes to a queen, so `FULL_SET.q - 2 = -1`. `-1 || 0` is `-1` (truthy),
and `Array(-1)` throws `RangeError: Invalid array length`, taking the whole board
down with it.

Reproduced deterministically from FEN `4k3/8/8/8/8/8/8/3QQ2K w - - 0 1`, and in
the browser by walking a pawn to h8.

**Fixed**: clamped with `Math.max(0, …)`. Logic extracted to
`lib/games/chess-material.ts` and covered by five tests, including the promotion
case and a four-queens position.

### HIGH

**2. Number Line handle does not sit under the finger** — `components/games/NumberLine.tsx`

The painted handle was positioned across the full track width, but a native
`<input type="range">` maps its value across `width - thumbWidth`, insetting by
half a thumb at each end. Since the input is `opacity-0`, the painted handle is
what the user sees — so it drifted up to 22px from the drag point and hung off
the end of the track at max.

**Fixed**: `valueToX` in `lib/games/number-line.ts` insets by `THUMB_RADIUS`,
matching the native mapping. Four tests, including "never hangs off the track".

**3. Number Line can hang the browser tab** — `components/games/NumberLine.tsx:99`

`for (let v = min; v <= max; v += step)` where `step` comes from
`practice_games.config_json`, which is untrusted JSON. A `0` or negative step
never terminates. Pre-existing, but in code this PR rewrote.

**Fixed**: `safeStep` rejects non-finite and non-positive steps, and coarsens a
step that would paint more than 200 ticks.

### MEDIUM

**4. Colour helpers fail unsafely on a malformed value** — `lib/subject-colour.ts`

`subjects.colour_token` is a free-text column. Anything unparseable (`''`,
`'red'`, `'rgb(1,2,3)'`) produced `NaN` channels, and `NaN` fails every
comparison, so `inkOn` fell through to **white** — the worst possible answer,
since every surface in this product is light. A bad import would have printed
white text on a near-white card, which is the exact failure the helper exists to
prevent.

**Fixed**: `channels()` validates and returns `null`; callers fall back to ink.
Twelve tests, including the malformed-input matrix.

Worth recording: `'bad'` is *valid* shorthand hex (`#bbaadd`). Shorthand hex
swallows more typos than it looks. A test caught this assumption.

**5. Board coordinates below AA** — `styles/tokens.css` §14

Rank and file labels measured **3.69:1** on maple and **2.64:1** on walnut at 9px
bold, which is not "large text". Missed on the first pass because the audit ran
on the menu screen, not on a played board.

**Fixed**: both labels are now dark (5.36:1 and 4.75:1). No light tone works on
walnut — even pure white is only 3.37:1.

**6. Two timing-based tests were coin flips**

- `connect4-ai` and `chess-ai` self-play run full minimax and land at 4–6s against
  vitest's 5s default. Not flaky logic, genuinely slow. **Fixed**: 30s budget each.
- `live-nickname` asserted 150ms per 50 calls and failed the suite at **152ms**,
  1.3% over. It was measuring machine load. **Fixed**: measured as a ratio against
  a benign nickname.

  Checked directly rather than assumed: with the run-collapse in `looseForm`
  disabled, that test still passes, because every input it uses is under
  `MAX_INPUT_LENGTH`. The real ReDoS guard is the length cap, and the two tests
  below it *do* fail when it is removed (50,000 characters against a 50ms budget,
  a margin of roughly a thousand times). The comment now says so.

Suite verified stable over 10 consecutive runs.

### LOW

**7. Data layer typed itself from the view layer** — `lib/games/catalogue.ts:1`

`GameId` was imported from `components/games/GamePreview`. Type-only, so no
runtime cost, but backwards. **Fixed**: `GameId` now lives in the catalogue and
the component imports it.

**8. Redundant pointer handler** — `components/games/NumberLine.tsx`

`onPointerDown` recomputed the value from `clientX`, racing the browser's own
mapping. **Fixed**: removed; the input alone owns the value.

**9. Duplicated value in an aria-label** — a native range already announces its
value; the label said "Currently X" as well. **Fixed**.

### Checked and clean

- No hardcoded credentials, no injection surface. JSON-LD goes through
  `lib/json-ld.ts`, which escapes `<`, `>` and `&` — verified.
- No `console.log`, `TODO`, `FIXME`, `debugger`, or `any` introduced.
- No file over 800 lines.
- Every new Tailwind class confirmed present in the built CSS, including the
  dynamically-assembled class strings in `admin/` and `vault/`.
- No collateral damage from the class sweeps.

## Validation Results

| Check | Result |
|---|---|
| Type check | Pass |
| Lint | Pass |
| Brand-hex guardrail | Pass |
| Tests | Pass — 394/394, up from 363 |
| Build | Pass — 498 static pages |
| Contrast audit (browser) | Pass — zero failures across the public surface |

## Still not verified

The five practice widgets have **not been seen rendering in a browser**.
`/topics/*/practise` is auth-gated (307) and the suite is node-only, so a render
check needs jsdom and Testing Library — new dependencies, not added unilaterally.

This is why the geometry was extracted to `lib/games/number-line.ts`: the part
most likely to be wrong is now covered by tests that do not need a browser. The
remaining risk is JSX layout, not arithmetic.

## Files Reviewed

Added: `lib/games/chess-material.ts`, `lib/games/number-line.ts`,
`__tests__/subject-colour.test.ts`, `__tests__/game-widgets.test.ts`

Modified: `components/games/{ChessGame,NumberLine,GamePreview}.tsx`,
`lib/games/catalogue.ts`, `lib/subject-colour.ts`, `styles/tokens.css`,
`__tests__/{connect4-ai,chess-ai,live-nickname}.test.ts`
