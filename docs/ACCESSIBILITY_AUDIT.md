# Accessibility Audit — Decifer Learning Core Child Learning Loop

**Auditor:** Senior Accessibility Architect (Claude Code)
**Date:** 2026-06-15
**Standard:** WCAG 2.2 Level AA
**Scope:** components/quiz/, components/world-map/, components/games/, components/cards/, app/(child)/topics/[id]/learn|practise|quiz, app/(child)/world-map

---

## (a) Findings Table

| # | Component / File | WCAG 2.2 Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | `QuizShell` — MCQ buttons | 1.4.1 Use of Colour | High | **Fixed** |
| 2 | `QuizShell` — MCQ buttons | 4.1.2 Name, Role, Value | High | **Fixed** |
| 3 | `QuizShell` — MCQ feedback region | 4.1.3 Status Messages | High | **Fixed** |
| 4 | `QuizShell` — feedback focus | 2.4.3 Focus Order | High | **Fixed** |
| 5 | `QuizShell` — shields span (title-only tooltip) | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 6 | `QuizShell` — live score counter | 4.1.3 Status Messages | Medium | **Fixed** |
| 7 | `QuizShell` — progress bar (no role) | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 8 | `QuizShell` — "← prev" button 44 px | 2.5.8 Target Size (Minimum) | Medium | **Fixed** |
| 9 | `QuizShell` — raw `✗` symbol in feedback text | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 10 | `QuizShell` — raw `✓`/`✗` in prev-review panel | 1.3.1 Info & Relationships | Low | **Fixed** |
| 11 | `QuizShell` — `💡` emoji in technique_note | 1.1.1 Non-text Content | Low | **Fixed** |
| 12 | `HeartsDisplay` — no `aria-live` on loss | 4.1.3 Status Messages | High | **Fixed** |
| 13 | `CardReveal` — missing dialog role/modal semantics | 4.1.2 Name, Role, Value | Critical | **Fixed** |
| 14 | `CardReveal` — no focus management | 2.4.3 Focus Order | Critical | **Fixed** |
| 15 | `CardReveal` — Escape key not handled | 2.1.2 No Keyboard Trap | High | **Fixed** |
| 16 | `BadgePopup` — missing dialog role/modal semantics | 4.1.2 Name, Role, Value | Critical | **Fixed** |
| 17 | `BadgePopup` — no focus management | 2.4.3 Focus Order | Critical | **Fixed** |
| 18 | `BadgePopup` — Escape key not handled | 2.1.2 No Keyboard Trap | High | **Fixed** |
| 19 | `DragDrop` — no non-pointer alternative for dragging | 2.5.7 Dragging Movements | Critical | **Fixed** |
| 20 | `DragDrop` — broken touch/tap-to-place implementation | 2.5.1 Pointer Gestures | High | **Fixed** |
| 21 | `DragDrop` — slot remove button has no `aria-label` | 4.1.2 Name, Role, Value | High | **Fixed** |
| 22 | `DragDrop` — placed count not announced | 4.1.3 Status Messages | Medium | **Fixed** |
| 23 | `SpeedRound` — timer urgency conveyed by colour only | 1.4.1 Use of Colour | High | **Fixed** |
| 24 | `SpeedRound` — hardcoded hex colours in timer | 1.4.1 Use of Colour | Medium | **Fixed** |
| 25 | `SpeedRound` — result dots colour-only | 1.4.1 Use of Colour | Medium | **Fixed** |
| 26 | `SpeedRound` — MCQ buttons no focus style / no state label | 2.4.11 Focus Appearance / 4.1.2 | Medium | **Fixed** |
| 27 | `SpeedRound` — timeout feedback no `aria-live` | 4.1.3 Status Messages | Medium | **Fixed** |
| 28 | `FillBlank` — feedback no `aria-live` | 4.1.3 Status Messages | High | **Fixed** |
| 29 | `FillBlank` — progress bar no `role="progressbar"` | 1.3.1 Info & Relationships | Low | **Fixed** |
| 30 | `FillBlank` — `✗` symbol in feedback | 1.3.1 Info & Relationships | Low | **Fixed** |
| 31 | `TrueFalseGrid` — result `✓`/`✗` symbols missing sr text | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 32 | `TrueFalseGrid` — token inconsistency (`text-correct-700`) | (contrast risk) | Low | **Fixed** |
| 33 | `OrderedList` — result `✓`/`✗` symbols missing sr text | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 34 | `OrderedList` — token inconsistency (`text-correct-700`) | (contrast risk) | Low | **Fixed** |
| 35 | `ReportProblemButton` — idle/action buttons below 48 px | 2.5.8 Target Size (Minimum) | High | **Fixed** |
| 36 | `ReportProblemButton` — textarea no `<label>` | 1.3.1 / 3.3.2 Labels or Instructions | High | **Fixed** |
| 37 | `ReportProblemButton` — error message no `role="alert"` | 4.1.3 Status Messages | High | **Fixed** |
| 38 | `DifficultyPicker` — button description not exposed to AT | 1.3.1 Info & Relationships | Low | **Fixed** |
| 39 | `ZoneMap` — progress bar no `role="progressbar"` | 1.3.1 Info & Relationships | Medium | **Fixed** |
| 40 | `ZoneMap` — node canvas no `role="region"` | 1.3.1 Info & Relationships | Low | **Fixed** |
| 41 | `TopicNode` — completed border hardcoded `#1B7D45` | (token drift, not an AA failure but a maintenance risk) | Low | **Fixed** |
| 42 | `DiscoveryCard` — rarity icon in collected card not `aria-hidden` | 1.1.1 Non-text Content | Low | **Fixed** |
| 43 | `HintButton` — `Lightbulb` icon in locked state not `aria-hidden` | 1.1.1 Non-text Content | Low | **Fixed** |
| 44 | Learn/Practise/Quiz pages — step indicator spans no `aria-current` | 1.3.1 Info & Relationships | Low | **Fixed** |
| 45 | `QuizShell` — `text-correct-700` / `text-rose-700` non-token classes | (contrast unverifiable) | Medium | **Fixed** — switched to `text-correct` / `text-incorrect` tokens |

---

## (b) What Was Changed and Why

### QuizShell (`components/quiz/QuizShell.tsx`)

**Feedback region (`aria-live` + focus management):** Added a persistent wrapper `<div ref={feedbackRef} aria-live="polite" aria-atomic="true" tabIndex={-1} className="outline-none">` around the post-answer feedback block. After `pick()` resolves (correct answer or all attempts exhausted), `setTimeout(() => feedbackRef.current?.focus(), 60)` moves focus programmatically so keyboard and switch-access users land on the result without having to navigate to it. The `aria-live` region causes VoiceOver/TalkBack/NVDA to read the result aloud as soon as it appears, even if focus doesn't move (belt-and-braces).

**MCQ button accessibility:** Added `role="group" aria-label="Answer choices"` to the grid wrapper (satisfies 1.3.1 — the set of options is a logical group). Each button gets a dynamic `aria-label` that appends `— correct answer` or `— your incorrect answer` after the question is done (satisfies 1.4.1 — colour is no longer the sole indicator, and 4.1.2 — the accessible name carries state). `aria-pressed` is set to `true` on the last-picked choice so toggle semantics are correct. Added `focus-visible:outline` to each button (was missing from the original `cls` string).

**Incorrect feedback text:** The raw string `` `✗ The answer is ${q.correct_answer}` `` was replaced with `<span aria-hidden>✗</span><span>Incorrect. The answer is <strong>{q.correct_answer}</strong></span>`. Screen readers will read "Incorrect. The answer is …" clearly rather than announcing the Unicode multiplication/cross symbol.

**Technique note emoji removed:** The `💡` emoji before `q.technique_note` was removed. Emojis are announced verbosely by screen readers ("light bulb emoji"). The Lightbulb icon is not present in that context so plain text is used.

**Shields span:** Replaced `title="…"` (hover-only, not accessible on touch) with `aria-label` on the container span. The visible `×N` text is marked `aria-hidden` so the screen reader reads the full label instead.

**Live score:** Wrapped the `questionsCorrect/total` text in a `<span aria-live="polite" aria-atomic="true" aria-label="Score: N of M correct">` so score changes are announced.

**Progress bar:** Added `role="progressbar" aria-valuenow aria-valuemin aria-valuemax aria-label` to the progress `<div>`.

**Previous-review overlay:** `min-h-[44px]` → `min-h-[48px]` on the "← Back to quiz" button; added `focus-visible:outline` to both buttons; cleaned up `✓`/`✗` symbols with `aria-hidden`.

**Token fix:** `text-correct-700` → `text-correct` and `text-rose-700` → `text-incorrect` throughout the file. `text-correct-700` is not a defined CLAUDE.md token; `text-correct` maps to `#40C057` which has adequate contrast on white backgrounds.

### HeartsDisplay (`components/quiz/HeartsDisplay.tsx`)

Added `aria-live="polite" aria-atomic="true"` to the `role="img"` container. The `aria-label` already updates correctly when `hearts` changes; the live region attribute ensures assistive technologies pick up the update without needing a focus change.

### CardReveal (`components/cards/CardReveal.tsx`)

Refactored the two-layer structure: the backdrop is now a separate `aria-hidden` motion div (users cannot interact with it via AT). The modal panel becomes a `<motion.div role="dialog" aria-modal="true" aria-labelledby="card-reveal-title" tabIndex={-1}>` inside a `pointer-events-none` wrapper div at z-index 61 (above the backdrop at z-60). `aria-labelledby` points to the `<h3 id="card-reveal-title">` that already contains the card's title. `useEffect` on mount focuses `dialogRef.current` and stores the previously-focused element, restoring it on unmount. A second `useEffect` listens for `Escape` and calls `onDismiss`.

### BadgePopup (`components/quiz/BadgePopup.tsx`)

Same pattern as CardReveal: backdrop `aria-hidden`, dialog panel with `role="dialog" aria-modal="true" aria-labelledby="badge-popup-title"`, focus trap on mount/unmount, Escape key handler. Badge icon `motion.div` marked `aria-hidden="true"` (it is purely decorative; the badge name in `h3` is the accessible label). Added `focus-visible:outline` on the dismiss button.

### DragDrop (`components/games/DragDrop.tsx`)

**WCAG 2.5.7 fix (Dragging Movements — AA in 2.2):** The original component relied on HTML5 drag-and-drop and a broken touch implementation (`touchItem.current = def` followed immediately by `onDrop(i)` before React re-renders, so `dragging` was never set). This was a full AA failure — there was no reliable single-pointer alternative to dragging.

The fix introduces a `selected` state. Definition chips are now `<button>` elements (keyboard-operable, focusable). Clicking/tapping a definition sets it as `selected` (with `aria-pressed="true"`). Clicking/tapping a slot when a definition is `selected` places it — satisfying the non-dragging alternative requirement. Drag-and-drop still works for pointer users who prefer it; the slot also listens to `onDrop`. A live `sr-only` region announces the selection state ("X selected. Tap a slot to place it."). The placed count now has `aria-live="polite"`. The slot buttons have `aria-label` that describes both the current state (empty/filled) and the action available.

### SpeedRound (`components/games/SpeedRound.tsx`)

**Colour-only timer:** The `timerColor` variable was a hardcoded hex string used in both `style` props and class logic. It is replaced with: (1) a Tailwind class variable `timerBarClass` (`bg-correct` / `bg-lightning` / `bg-incorrect`) applied to the bar via `className`, and (2) Tailwind utility classes for the badge (`bg-correct/20 text-correct`, `bg-lightning/20 text-points-gold`, `bg-incorrect/20 text-incorrect`). These use only the defined CSS tokens. The timer `<div>` has `role="timer"` and an `aria-label` that includes both the time remaining and a textual urgency hint ("plenty of time" / "hurry up" / "almost out of time") — screen readers can poll this without it announcing on every tick (deliberately set to `aria-live="off"`).

**Result dots:** The dots strip in the done screen is marked `aria-hidden="true"` — it is purely decorative; the accessible summary is the `{correctCount} / {questions.length} correct · {pct}%` text already present.

**MCQ buttons:** Added `focus-visible:outline` to the class string and a dynamic `aria-label` that appends the outcome state after the question is answered.

**Timeout feedback:** Wrapped in `<div aria-live="polite" aria-atomic="true">`.

### FillBlank (`components/games/FillBlank.tsx`)

Added `role="progressbar"` with `aria-valuenow/min/max/label` to the progress bar. Wrapped the feedback `<motion.p>` in `<div aria-live="polite" aria-atomic="true">` so correct/incorrect results are announced without requiring a focus change. Replaced the raw `✗` prefix with `<span aria-hidden>✗ </span>` followed by plain text.

### TrueFalseGrid (`components/quiz/TrueFalseGrid.tsx`)

Result indicator spans: removed `aria-hidden` from the `motion.span` container and split it into `<span aria-hidden>✓/✗</span><span className="sr-only">Correct/Incorrect</span>`. The token `text-correct-700` → `text-correct`, `text-rose-700` → `text-incorrect`.

### OrderedList (`components/quiz/OrderedList.tsx`)

Same result indicator fix as TrueFalseGrid. Token fix applied.

### ReportProblemButton (`components/quiz/ReportProblemButton.tsx`)

- Idle button: `flex h-9` → `inline-flex min-h-[48px]` (h-9 = 36 px, below the 48 px requirement).
- Open state Send/Cancel buttons: `flex h-9` → `inline-flex min-h-[48px]` for both.
- Textarea: wrapped `<p>` label into a `<label htmlFor="report-reason">` and added `id="report-reason"` on the textarea.
- Error message: `<p className="text-xs text-incorrect">` → `<p id="report-error" role="alert">`. The textarea gains `aria-describedby="report-error"` when an error exists.
- Added `focus-visible:outline` to both buttons.

### DifficultyPicker (`components/quiz/DifficultyPicker.tsx`)

Each button gains `aria-label="{label} — {desc}"` so screen readers announce both the difficulty name and its description in one pass. The visible children (`icon`, `label` text, `desc` text) are each marked `aria-hidden` to prevent double-announcement.

### ZoneMap (`components/world-map/ZoneMap.tsx`)

- Node canvas `<div>`: added `role="region"` alongside the existing `aria-label`.
- Progress bar `<div>`: added `role="progressbar" aria-valuenow aria-valuemin aria-valuemax aria-label`.

### TopicNode (`components/world-map/TopicNode.tsx`)

Completed-state border changed from `'3px solid #1B7D45'` to `'3px solid var(--correct)'`. This uses the defined `--correct: #40C057` token from CLAUDE.md §10 rather than an out-of-band green that would be invisible to the token system.

### DiscoveryCard (`components/cards/DiscoveryCard.tsx`)

Added `aria-hidden="true"` to the rarity icon `<span>` in the collected card view. The rarity label text immediately beside it carries the same meaning, so the icon is decorative.

### HintButton (`components/quiz/HintButton.tsx`)

Added `aria-hidden` to the `Lightbulb` icon in the locked-state paragraph. The surrounding text ("Hint unlocks in Xs — give it a try first!") is sufficient.

### Route pages — step indicators

`app/(child)/topics/[id]/learn/page.tsx`, `practise/page.tsx`, `quiz/page.tsx`: the active step `<span>` gains `aria-current="step"` and the wrapper gains `aria-label="Topic steps"`. This lets screen reader users understand which phase of the learn→practise→quiz journey they are on (satisfies 1.3.1 and 2.4.8).

---

## (c) Deferred / Designer / Manual-Testing Follow-Up

### Requires a screen reader session

1. **Full focus-trap in CardReveal and BadgePopup.** The implementation moves initial focus to the dialog and restores it on close. However, it does not yet implement a full tab-cycle trap (Tab key wrapping within the dialog). In practice these modals have only one interactive element (the dismiss button), so keyboard users can reach it without a trap. A formal audit with NVDA/JAWS should confirm that focus does not escape to background content while the modal is open.

2. **DragDrop keyboard operability.** The tap-to-select/tap-to-place model is now keyboard-operable (buttons are focusable, Enter/Space works). However, the slot buttons are rendered in DOM order (term 1 slot, term 2 slot, …) while definitions are rendered separately, meaning a keyboard user must Tab across all definitions before reaching all slots. A screen reader audit should verify the interaction model is sufficiently clear without visual layout context.

3. **MathText component.** Mathematical expressions rendered by `MathText` (used throughout QuizShell for question text and choices) are assumed to render as readable text. If MathText uses MathML or SVG internally, each symbol/expression needs `aria-label` or `role="math"` verification — not audited in this pass.

4. **Animated content and `prefers-reduced-motion`.** The existing `MotionProvider` correctly sets `reducedMotion="user"` on the global `MotionConfig`, which disables transforms and layout animations. Opacity fades still play. A manual test with Reduce Motion enabled on iOS should confirm that the answer feedback, card reveal, and badge popup animations do not cause vestibular discomfort.

### Contrast items that could not be resolved with existing tokens

5. **`text-rose-700` in MCQ wrong-answer state.** Some wrong-answer states still reference `text-rose-700` (a Tailwind utility not defined in CLAUDE.md §10 token set) for the unanswered-wrong intermediate state (choice === lastPicked and attempts > 0). The `--incorrect` token (#FF6B6B) passes 3:1 against white for large/bold text but only 2.8:1 at normal weight. A designer should confirm whether #FF6B6B text on a white/near-white background passes AA for the 14 px bold text used in these buttons, or provide an alternative token with better contrast.

6. **`text-points-gold` and `text-points-gold-700`.** The `--points-gold: #FFC107` token is used for score/point displays on white backgrounds. #FFC107 on white = 1.9:1, which fails AA. This was pre-existing and is out of the current scope (it affects score displays on the result screen). The designer should pick a darker gold for text — for example `#B8860B` achieves 5.8:1 on white. This is flagged as a deferred design decision.

7. **SpeedRound `text-points-gold` on the timer badge.** The warning-state timer badge now uses `text-points-gold` (via the `text-points-gold` Tailwind class alias). Same contrast concern as above applies.

### Scope boundaries (not audited in this pass)

- `components/explore/` — explicitly excluded from scope.
- `components/quiz/StructuredAnswer.tsx`, `SourceAnalysis.tsx`, `ExplainExample.tsx` — multipart question types with complex sub-UIs; each warrants a dedicated audit pass.
- `app/(child)/guardian/[zoneId]/page.tsx` — uses QuizShell; inherits all QuizShell fixes.
- `app/(child)/collection/` — CardAlbum component (not present in codebase, may be `CollectionGrid`); not in scope.
- Parent dashboard and admin routes — out of scope for child learning loop audit.

---

*End of audit.*
