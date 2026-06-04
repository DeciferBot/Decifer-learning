# Decifer Learning — Design System v2.0
> **Deliverables 3–7** of the complete design system.
> Deliverable 1 (token dictionary) → `tokens.css` + `tokens.json`
> Deliverable 2 (Tailwind config) → `tailwind.config.ts`

---

## Deliverable 3 — Component Specifications

### Notation
Each component table covers: sizes · states · props · measurements · colour usage · animation · accessibility.

---

### ATOMS

---

#### Button

| Property | sm (36px) | md (44px) | lg (52px) |
|----------|-----------|-----------|-----------|
| Height | 36px | 44px | 52px |
| Padding | 8px 16px | 12px 20px | 14px 28px |
| Font | label-md / Nunito 700 | label-lg / Nunito 700 | label-lg / Nunito 700 |
| Radius | `--radius-button` (12px) | `--radius-button` | `--radius-button` |
| Icon gap | 6px | 8px | 8px |

**Variants**

| Variant | Default bg | Default text | Hover bg | Shadow |
|---------|-----------|-------------|----------|--------|
| primary | `--maths` (#6C9EFF) | white | darken 8% | `--shadow-primary-btn` |
| secondary | `--surface` | `--text-primary` | `--surface-raised` | elevation-1 |
| ghost | transparent | `--text-secondary` | `--surface-sunken` | none |
| danger | `--error` | white | darken 8% | none |
| success | `--correct` | white | darken 8% | none |

**States**
- **default**: as above
- **hover**: `translateY(-1px)`, shadow increases one level, bg shifts
- **pressed/active**: `scale(0.96)`, shadow decreases, `transition: 80ms`
- **focused**: `outline: 2px solid var(--border-focus); outline-offset: 2px`
- **disabled**: opacity 0.45, `cursor: not-allowed`, no transform
- **loading**: replace label with 16px spinner (same colour as text), disable pointer events
- **icon-only**: square proportions, `border-radius: --radius-button` or 50% (circular variant)
- **full-width**: `width: 100%`

**Animations**
- Hover lift: `transform 150ms var(--ease-out)`, `box-shadow 150ms var(--ease-out)`
- Press: `transform 80ms ease-in`
- Release: `transform 150ms var(--ease-out-back)` (spring-back from tap)

**Accessibility**
- `role="button"` or native `<button>`
- `aria-disabled="true"` when disabled (not HTML `disabled` alone)
- `aria-busy="true"` during loading state
- Loading spinner: `aria-label="Loading"` + `role="status"`
- Icon-only: `aria-label` required, no visible text
- Minimum touch target: 44px height (md and lg meet this; sm needs 4px vertical padding added on mobile)

---

#### Input / TextField

| Measurement | Value |
|-------------|-------|
| Height | 48px (meets 44px touch target + breathing room) |
| Padding | 12px 16px |
| Radius | `--radius-input` (12px) |
| Border | 1.5px solid `--border-default` |
| Font | body-md / Inter 400 |
| Label | label-md / Nunito 700, above field, 8px gap |
| Helper text | caption / Inter 400, 4px below field |
| Error text | caption / Inter 400, `--error` colour, 4px below |

**States**
| State | Border | Background | Text |
|-------|--------|------------|------|
| default | `--border-default` | `--surface-sunken` | `--text-primary` |
| focused | `--border-focus` (2px) | `--surface` | `--text-primary` |
| filled | `--border-default` | `--surface` | `--text-primary` |
| error | `--error` (2px) | `--error-bg` | `--text-primary` |
| disabled | `--border-default` at 50% | `--surface-sunken` at 50% | `--text-disabled` |

**Focus ring**: `box-shadow: 0 0 0 3px rgba(74, 127, 212, 0.20)` in addition to border change.

**Special variants**
- Password: eye icon button (right-aligned, 48×48 tap target)
- Number: increment/decrement buttons on tablet+; native spinner on mobile
- Clear button: × icon, appears when filled, 48×48 tap target

**Accessibility**
- `<label>` always associated via `for`/`id` — never `placeholder` as only label
- Error text: `aria-describedby` pointing to error element + `aria-invalid="true"`
- Character count: `aria-describedby` pointing to count element

---

#### Checkbox

| Measurement | Value |
|-------------|-------|
| Visual size | 20×20px |
| Touch target | 24×24px minimum (add padding) |
| Radius | 6px |
| Border | 2px solid `--border-default` |
| Check icon | Lucide `Check`, 14px, white |

**States**
| State | Background | Border |
|-------|------------|--------|
| unchecked | `--surface` | `--border-default` |
| checked | `--maths` | `--maths` |
| indeterminate | `--maths` at 60% | `--maths` |
| disabled | `--surface-sunken` | `--border-default` at 40% |

**Animation**: check icon scales in from 0 → 1 at `150ms var(--ease-out-back)`.

**Accessibility**: native `<input type="checkbox">` or `role="checkbox"` + `aria-checked`.

---

#### Radio Button

| Measurement | Value |
|-------------|-------|
| Visual size | 20×20px |
| Touch target | 48×48px |
| Inner dot size | 8px |
| Radius | 50% |

Always in `role="radiogroup"` with `aria-labelledby` pointing to group label.

**Card-style radio** (year-group selection):
- Full card hit area
- `border: 2px solid --border-default` → `border: 2px solid --maths` when selected
- Background: `--surface` → `--surface-maths` when selected
- Elevation-1 shadow

---

#### Toggle / Switch

| Measurement | Value |
|-------------|-------|
| Track size | 44×24px |
| Thumb size | 20×20px |
| Travel distance | 20px |
| Track radius | 12px (pill) |
| Thumb radius | 50% |

**States**
| State | Track | Thumb |
|-------|-------|-------|
| off | `--border-default` bg | white |
| on | `--maths` bg | white |
| disabled | either at 40% opacity | — |

**Animation**: thumb slides `translate: 0 → 20px` at `150ms var(--ease-out)`.

**Accessibility**: `role="switch"`, `aria-checked="true/false"`, `aria-label`.

---

#### Badge / Chip

**Status/informational badge** (read-only pill)
```
padding: 2px 8px
border-radius: --radius-pill
font: label-sm / Nunito 600
```
Colours: one per subject/semantic token. Text always `--text-on-{subject}` or `--text-primary`.

**Tier chip** (difficulty indicator)
| Tier | Background | Text | Border |
|------|------------|------|--------|
| Sprout | `--sprout` at 20% | `#1A5C42` | `--sprout` |
| Explorer | `--explorer` at 20% | `#1A3A6C` | `--explorer` |
| Lightning | `--lightning` at 20% | `#7A5C00` | `--lightning` |

**Count badge** (notification dot)
- Diameter: 18px (number) or 10px (dot)
- Background: `--error`
- Font: label-sm / Nunito 700 / white
- Position: absolute top-right of parent icon

**Removable chip**: add × button (20×20px min tap area) to right of label.

---

#### Tag

**Subject tag**
```
Subject dot (8px circle, subject colour) + subject name
Background: --surface-{subject}
Border: 1px solid --border-{subject}
Radius: --radius-chip (8px)
Padding: 4px 10px
```

**Rarity tag** — uses rarity colour tokens. Frame colour matches card rarity.

**Difficulty tag** — tier chip (Sprout / Explorer / Lightning).

---

#### Avatar

| Size | Diameter | Font for initials |
|------|----------|-------------------|
| xs | 24px | caption 12px |
| sm | 32px | label-sm 12px |
| md | 48px | label-lg 16px |
| lg | 64px | h3 22px |
| xl | 96px | h2 28px |
| 2xl | 128px | h1 36px |

- `border-radius: --radius-avatar` (50%)
- Fallback: initials on `--maths`-coloured circle
- Online dot: 8px green circle, `border: 2px solid --surface`, absolute bottom-right
- Accent ring: 3px ring in subject or rarity colour, 2px gap from edge

**8 base character slots**: each is a distinct illustrated character. Shown as silhouettes (greyscale) until selected. Selected state: full colour + `--maths` ring.

---

#### Spinner / Loader

| Size | Diameter | Stroke |
|------|----------|--------|
| sm | 16px | 2px |
| md | 24px | 2.5px |
| lg | 40px | 3px |

- SVG circle with `stroke-dasharray` animation
- Colours: `--maths` on light bg; white on dark/coloured bg
- Rotation: 360° at 700ms linear infinite
- Page-level skeleton: shimmer gradient (`linear-gradient(90deg, --surface-sunken 0%, --surface 50%, --surface-sunken 100%)`) animated at `1.5s linear infinite`

**Accessibility**: `role="status"`, `aria-label="Loading"`. Page loader: `aria-live="polite"` announces completion.

---

#### Divider

- Horizontal: `height: 1px; background: --divider`
- Vertical: `width: 1px; background: --divider`
- With label: flex row, divider lines + centred label-sm text in `--text-muted`
- Never `<hr>` without `role="separator"` or use a div with `role="separator"` + `aria-orientation`

---

#### Tooltip

```
max-width: 200px
padding: 6px 10px
border-radius: --radius-sm (8px)
background: --text-heading (#1A202C)
color: --text-inverse
font: body-sm / Inter 400
```
- Delay: 400ms on desktop; never on mobile (use long-press on mobile → bottom sheet instead)
- Positions: above (preferred), below, left, right
- Arrow: 6px triangle, same bg
- `role="tooltip"` + `id`, referenced by trigger's `aria-describedby`

---

### MOLECULES

---

#### Card

**Base card**
```
background: --surface
border-radius: --radius-card (16px)
padding: --space-4 (16px)
box-shadow: --shadow-card (elevation-1)
border: 1px solid --border-default
```
Hover: `translateY(-3px)`, shadow → elevation-2, `transition: 250ms var(--ease-out)`.

**Topic card**
```
width: 100% (1-col mobile) | calc(50% - 8px) (2-col tablet)
min-height: 120px
```
- Header row: subject dot (10px circle) + topic name (h3) + status icon (22px)
- State badge (tier chip or status chip)
- Progress bar: present only on in-progress state
- Action row: Learn pill + Quiz pill
- State-specific borders (see CLAUDE.md component states)

**Discovery Card** (collectible)
```
width: 160px (mobile) | 180px (tablet+)
aspect-ratio: 3/4
border-radius: --radius-card
overflow: hidden
```
- Rarity frame: 3px border using rarity colour; Legendary uses `--legendary-gradient`
- Art region: top 60%, illustration placeholder (coloured bg by subject)
- Info region: bottom 40%, `--surface` bg, card title (h4), fact text (body-sm)
- Rarity ribbon: top-right corner, 45° ribbon with rarity name + colour
- Lock state: grayscale filter, lock icon centred on art region
- Legendary shimmer: `animation: shimmer 2s linear infinite` on the border frame

**Badge card** (achievements)
```
width: 100px (3-col grid on mobile)
aspect-ratio: 1/1.2
```
- Icon region: 60px circle centred
- Name: label-md below
- Locked: grayscale + opacity 0.5, lock overlay icon
- Unlocked: full colour, subtle glow shadow

**Stat card** (parent dashboard)
```
padding: --space-5
background: --surface-raised
border-radius: --radius-card
```
- Icon: 32px, subject or semantic colour
- Number: display-lg, `--text-heading`
- Label: label-md, `--text-muted`

**Mission card**
- Icon (32px), description (body-sm), progress bar, reward chip
- Progress: fills with `--maths` colour (or relevant subject)

**Daily Challenge card**
- Question count badge, subject tags (up to 2), "Play" CTA, completion state (green check)

---

#### Modal / Dialog

| Size | Width | Usage |
|------|-------|-------|
| sm | 320px | Simple confirm, single-field input |
| md | 400px | Standard dialogs, form |
| lg | 480px | Rich content, multi-step |
| fullscreen | 100vw × 100dvh | Mobile (<480px) — always fullscreen |

```
border-radius: --radius-modal (24px)
background: --surface
box-shadow: --shadow-elevated
```
- Backdrop: `--overlay` (rgba(15,23,42,0.60)), blur(8px) on tablet+
- Transition: `scale(0.95) → scale(1)` + `opacity 0 → 1` at 250ms `--ease-out-expo`
- Close button: top-right, 48×48px tap target, Lucide `X` icon
- Focus trap: Tab cycles within modal; first focusable element receives focus on open
- Escape: closes modal, returns focus to trigger
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing to modal title

---

#### Bottom Sheet / Drawer

Mobile-only. On tablet+, use modal instead.
- Handle bar: 32×4px, `--border-default` bg, centred top, 8px from top edge
- Snap points: 50% height (default), 100% height (full)
- Dismiss: swipe down (velocity-based), tap backdrop
- Transition: `translateY(100%) → translateY(0)` at 400ms `--ease-out-expo`
- `role="dialog"`, focus trap, `aria-modal="true"`

---

#### Toast / Notification

```
min-width: 280px; max-width: 360px
padding: --space-4 --space-5
border-radius: --radius-card (16px)
box-shadow: --shadow-toast (elevation-5)
```
Position: top-centre on mobile; bottom-right on desktop.

| Type | Left border | Icon | Text colour |
|------|-------------|------|-------------|
| success | `--correct` 4px | CheckCircle | `--text-primary` |
| error | `--error` 4px | XCircle | `--text-primary` |
| warning | `--warning` 4px | AlertTriangle | `--text-primary` |
| info | `--info` 4px | Info | `--text-primary` |

- Auto-dismiss: 3s default (pause on hover/focus)
- Queue: max 1 visible; queue the rest
- Enter: `slideDown + fadeIn` 250ms `--ease-out-expo`
- Exit: `fadeOut` 200ms ease-in
- Never use for game feedback — use inline states only
- `role="status"` (success/info/warning), `role="alert"` (error)

---

#### Progress Bar

| Variant | Height | Usage |
|---------|--------|-------|
| topic-progress | 8px | Topic card fill |
| quiz-progress | 6px | Quiz screen top |
| xp-bar | 12px | Player XP bar |
| guardian-hp | 16px | Boss HP — animated drain |

```
background (track): --surface-sunken
border-radius: --radius-pill
overflow: hidden
```
Fill colour: subject colour for topic/quiz; `--points-gold` for XP; `--error` for guardian HP.
Animation: `width 0% → N%` at `250ms var(--ease-in-out)` on mount.
Striped variant (in-progress): diagonal stripe CSS pattern at 45°, animated scroll.

**Labelled variant**: percentage text right-aligned above bar.
**Accessibility**: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label`.

---

#### Progress Ring

| Size | Diameter | Stroke |
|------|----------|--------|
| sm | 48px | 4px |
| md | 64px | 6px |
| lg | 96px | 8px |

SVG-based. Track: `--surface-sunken`. Fill: subject or semantic colour.
Animation: `stroke-dashoffset` transition at `400ms var(--ease-in-out)`.
Centre text: percentage (label-md / Nunito 700).

---

#### Hearts / Lives Display

3 hearts in a row. Gap: `--space-2` (8px).

| State | Icon | Colour |
|-------|------|--------|
| full | Lucide `Heart` filled | `--error` (#FF6B6B) |
| empty | Lucide `Heart` outline | `--border-default` |

**Break animation**: heart icon `scale(1.3)` → shatters (two halves translate outward) → fades out → empty heart fades in. Duration: `600ms var(--ease-out-back)`.
**Gain animation**: empty → full with `scale(0) → scale(1.2) → 1.0` at `400ms var(--ease-out-back)` + pulse shadow.
**Accessibility**: `aria-label="Lives: 2 of 3"` on container; `aria-live="assertive"` for changes.

---

#### Hint Button

3 levels, revealed sequentially. Each level:
```
height: 44px
padding: 0 --space-4
border-radius: --radius-button
font: label-md
```

| Level | Background | Border | Cost label |
|-------|------------|--------|-----------|
| hint-1 | `--info-bg` | `--info-bdr` | "−5 pts" |
| hint-2 | `--warning-bg` | `--warning-bdr` | "−10 pts" |
| hint-3 | `--error-bg` | `--error-bdr` | "−15 pts" |

Locked state (prev hint not yet used): opacity 0.4, `cursor: not-allowed`.
Reveal animation: card expands from button with `scaleY(0) → 1` at `250ms var(--ease-out-back)`.

---

#### Answer Option (Quiz)

```
width: 100% (mobile); calc(50% - 8px) (tablet, for short options only)
min-height: 56px
padding: 14px 16px
border-radius: --radius-card (16px)
border: 2px solid --border-default
font: body-md / Inter 400
```

**States**

| State | Border | Background | Text |
|-------|--------|------------|------|
| default | `--border-default` | `--surface` | `--text-primary` |
| hover | `--border-strong` | `--surface-raised` | `--text-primary` |
| selected | `--maths` 2px | `--surface-maths` | `--text-primary` |
| correct | `--correct` 2px | `--success-bg` | `--text-primary` |
| incorrect | `--error` 2px | `--error-bg` | `--text-primary` |
| revealed-correct | `--correct` 2px dashed | transparent | `--text-primary` |
| disabled | `--border-default` at 40% | — | `--text-disabled` |

**Letter bubble**: 28×28px circle, left-aligned. Fills solid on correct/incorrect.
**Answer animation**: correct → `correctPulse` 500ms; incorrect → `incorrectShake` 400ms.
**Disabled after submit**: pointer-events none, opacity 0.5 on non-selected non-correct options.

**Accessibility**: `role="radio"` in `role="radiogroup"`, `aria-checked`, keyboard: Enter/Space to select.

---

#### Quiz Progress Header

Fixed at top of quiz screen.
```
height: 56px
padding: 0 --space-4
background: --surface / transparent (guardian screen)
box-shadow: --shadow-sticky (elevation-3)
```
- Left: pause/exit icon button (48×48px)
- Centre: progress bar (full-width, 6px, subject colour)
- Right: hearts display + animated point counter

**Point counter animation**: rolling number increment using CSS counter or JS at `800ms --ease-out-expo`.
**Question counter**: "3 / 10" label-sm above progress bar, `--text-muted`.

---

#### Streak Widget

```
display: flex; align-items: center; gap: --space-2
padding: 8px 12px
border-radius: --radius-pill
background: --streak-bg
```
- Flame icon (Lucide `Flame`, 20px, `--streak`): `animation: flamePulse 2s ease-in-out infinite`
- Day count: label-lg / Nunito 800, `--streak`
- Streak-at-risk: flame colour → `--streak-at-risk`, background → `--warning-bg`, add "at risk!" label-sm

---

#### Point Burst

Triggered by: correct answer, quiz complete, card drop.
```
position: absolute (relative to triggering element)
font: display-xl / Nunito 900
color: --points-gold
animation: pointBurst 800ms --ease-out-expo forwards
```
`+10`, `+50`, `+100` etc. Floats upward 48px and fades out.
Not focusable; `aria-hidden="true"`.

---

### ORGANISMS

---

#### Bottom Tab Bar (mobile/phablet only)

```
height: 64px + env(safe-area-inset-bottom)
background: --surface
border-top: 1px solid --border-default
box-shadow: --shadow-sticky
position: fixed; bottom: 0; left: 0; right: 0
z-index: --z-sticky
```

4 tabs: **Home** (house icon) · **World Map** (map icon) · **Collection** (layers/cards icon) · **Profile** (avatar)

| State | Icon | Label |
|-------|------|-------|
| inactive | Lucide outline, `--text-muted` | label-sm, `--text-muted` |
| active | Lucide filled, subject colour | label-sm, subject colour |

Active indicator: 2px underline in subject colour, or filled icon.
Notification dot: absolute top-right of icon.
Hidden at 768px+ (sidebar nav replaces it).

**Accessibility**: `role="tablist"`, each tab is `role="tab"`, `aria-selected`, `aria-label`.

---

#### Top App Bar

```
height: 56px
padding: 0 --space-4
position: sticky; top: 0
z-index: --z-sticky
box-shadow: --shadow-sticky
background: --surface (or transparent on world-map/guardian screens)
```
- Left: back button (Lucide `ChevronLeft`, 48×48) or hamburger (admin/parent only)
- Centre: page title (h3, `--text-heading`, truncated with ellipsis)
- Right: up to 2 icon buttons (48×48px each)

Transparent variant: only on full-bleed screens (world map, guardian battle). Text colour switches to `--text-inverse`.

---

#### World Map Node

States:
| State | Visual | Interaction |
|-------|--------|-------------|
| locked | Greyscale + lock icon centre | Tap: "Complete previous zones first" tooltip |
| available | Glow animation, subject colour ring | Tap: enter zone |
| completed | Star(s) overlay (1–3 stars) | Tap: replay or view progress |
| guardian | Special design (dragon/boss silhouette) | Tap: enter boss battle |

Connecting paths: SVG lines between nodes, dashed for locked, solid for unlocked.
Glow animation: `box-shadow: 0 0 0 0 subjectColour → 0 0 0 12px transparent` at `1.5s ease-out infinite`.

---

#### Quiz Question Container

```
padding: --space-4
max-width: --content-max-width
margin: 0 auto
```
- Question text: body-md (16px min), `--text-primary`, centred, `line-height: 1.65`
- Image/diagram region: max-height 240px on mobile, `border-radius: --radius-card`, only when question has image
- Audio button (Phase 2): bottom-left of question area, 48×48px, leave DOM slot
- Answer grid: below question, full-width, 1-col mobile, 2-col tablet (short options only)

---

#### Learn Content Container

```
padding: 0 --space-4 --space-16
max-width: --content-max-width
```
- Section heading: h3, `--text-heading`
- Body copy: body-lg (18px), Inter 400, `--text-primary`, `line-height: 1.7`
- Paragraph spacing: `--space-4` (16px)
- Example boxes: `background: --surface-{subject}`, `border-radius: --radius-sm`, `padding: --space-3 --space-4`
- Key term highlights: `border-bottom: 2px solid subjectColour`, no background
- "Next section" CTA: full-width secondary button, sticky at bottom on long content

---

#### Guardian Battle Screen

```
background: --guardian-dark (#2D1B4E)
min-height: 100dvh
```
- Boss illustration: centred, top 45% of screen, max-width 280px
- Boss HP bar: `--error` fill, 16px height, below illustration, label showing HP/MaxHP
- Round counter: top-right chip, `--guardian` bg, white text
- Player hearts: bottom-left, `position: fixed`
- Question card: `--surface`, `--radius-modal`, floating above battlefield, `--shadow-elevated`
- Question text: body-md, `--text-primary`
- Answer options: 4 tiles in `--guardian-dark` themed card style

Guardian entrance animation: `guardianEnter 600ms --ease-out-back` on screen mount.

---

#### Card Reveal Sequence

1. Dark overlay (`--overlay`) fades in: 250ms
2. Card flips in from face-down: `cardFlip 600ms --ease-out-back`
3. Rarity particles (Legendary only): CSS sparkle divs, radiate outward
4. Card details slide up: `translateY(20px) → 0` at `400ms --ease-out-expo`, delayed 300ms
5. "Add to Collection" CTA: fades in at `800ms`

Full sequence: ~1200ms total. `prefers-reduced-motion`: skip flip + particles, just fade in card at `400ms`.

---

#### Parent Dashboard Layout

**Tablet+ (768px+)**: sidebar + main content
```
sidebar: width 240px, fixed left, full-height, --surface, --shadow-sticky
main: margin-left 240px, padding --space-8, max-width 1100px
```
**Mobile (<768px)**: single column, sidebar becomes hamburger menu → bottom sheet.

Sections (in order):
1. Stats row: 4 stat-cards in a grid (2-col mobile, 4-col desktop)
2. Weak areas: signal cards — subject + topic + accuracy %
3. Recent activity feed: timeline of quiz attempts
4. Screen time control: per-child time limits + toggle

---

#### Empty State

```
max-width: 280px; margin: 0 auto; text-align: center; padding: --space-16 --space-4
```
- Illustration: max 180px, `aria-hidden="true"`
- Heading: h3, `--text-heading`
- Body: body-md, `--text-muted`
- CTA: primary button (optional)

Defined states:
| State | Heading | CTA |
|-------|---------|-----|
| no quiz attempts | "Ready to test yourself?" | "Start a Quiz" |
| no cards collected | "Your collection is empty" | "Do a Quiz to earn cards" |
| no weak areas | "You're doing great!" | — |
| no children linked | "No learners yet" | "Add a child" |
| offline | "You're offline" | "Retry" |

---

#### Onboarding Flow

6 screens. Screen layout:
```
top 50%: illustration (full-bleed, coloured bg by step)
bottom 50%: options grid + heading + CTA
```
Step indicator: dots (6 dots), active dot expands to 24px wide pill.
"Continue" CTA: full-width primary button, bottom of screen.
"Skip" link: top-right, ghost style, always visible.
Back: top-left, Lucide `ChevronLeft`, 48×48px tap target.

Screens:
1. **Avatar** — pick 1 of 8 character bases
2. **Buddy** — pick 1 of 4 study companions
3. **Subject preference** — card-style radio, 3 subjects
4. **Interests** — multi-select tiles (6–8 options)
5. **Learning style** — 3 card-style radios (visual/reading/mixed)
6. **Confidence** — 5-star or emoji self-rating per subject

Transition between screens: `pageEnter` (slide up + fade) 250ms `--ease-out-expo`. No slide-out (prevents nausea).

---

## Deliverable 4 — Interaction Pattern Library

### Tap Feedback
Every button/card uses the same pattern:
```css
transition: transform var(--duration-instant) ease-in,
            box-shadow var(--duration-fast) var(--ease-out);
```
- `touchstart` / `mousedown`: `scale(0.96)`, shadow decreases
- `touchend` / `mouseup`: spring back via `var(--ease-out-back)` at `150ms`

### Form Validation
- Validate **on blur** (not on keystroke — reduces anxiety for children)
- Show error below field immediately on blur if invalid
- Clear error as soon as user starts typing again
- On submit: if errors exist, focus first invalid field, announce via `aria-live`
- Never use toast for form errors — always inline

### Quiz Feedback
1. User taps answer option
2. **Immediately** (80ms): lock all options, apply correct/incorrect visual state
3. Feedback strip animates in (`slideUp 250ms --ease-out-back`)
4. If correct: `correctPulse` on option + point burst animation
5. If incorrect: `incorrectShake` on option + heart break if lives lost
6. "Continue" button fades in after 300ms delay
7. `aria-live="polite"` announces result (correct/incorrect + explanation)
8. Hearts lost: `aria-live="assertive"` announces new lives count

### Card Drop
1. Quiz complete screen appears: `pageEnter 250ms`
2. After 800ms: card reveal overlay fades in
3. Card face-down slides up: `guardianEnter 600ms --ease-out-back`
4. Auto-flip after 600ms: `cardFlip 600ms --ease-out-back`
5. Point burst: `+50 pts` floats up
6. Rarity particles (Legendary only)
7. Card details slide up
8. "Add to Collection" CTA appears

### Boss Battle Sequence
1. Screen transition: `pageEnter` with dark bg
2. Guardian entrance: `guardianEnter 600ms --ease-out-back`
3. HP bar animates to full: 400ms
4. Question card slides up: `300ms delay + 400ms --ease-out-expo`
5. Each correct answer: HP drains (`400ms --ease-in-out`), guardian "hurt" shake
6. Each wrong answer: heart breaks, guardian "happy" brief pulse
7. Defeat: guardian scale(0) + fade over `800ms --ease-in-out`; victory screen

### Page Transitions
- Enter: `pageEnter` — `translateY(24px) → 0` + `opacity 0 → 1`, `250ms --ease-out-expo`
- Exit: `pageExit` — `opacity 1 → 0` only (no translate — prevents nausea), `200ms ease-in`
- Back navigation: reverse — previous page slides in from `translateX(-20%) → 0`

### Drawer / Bottom Sheet
- Open: `translateY(100%) → translateY(0)` at `400ms --ease-out-expo`
- Close (swipe down): follows finger velocity, completes at `250ms --ease-in-out` if velocity threshold met
- Backdrop: `opacity 0 → 0.6` at `300ms ease-out`

---

## Deliverable 5 — Motion Choreography

### Quiz Complete → Card Drop → Collection Update

```
t=0ms    Quiz complete screen enters (pageEnter 250ms)
t=600ms  Score number counts up (800ms rolling counter)
t=900ms  "You earned a card!" text fades in
t=1200ms Dark overlay fades in (250ms)
t=1450ms Card (face-down) slides up from bottom (600ms guardianEnter)
t=2050ms Card flips to face-up (600ms cardFlip)
t=2200ms Point burst: "+50 pts" floats (800ms pointBurst)
t=2400ms Card details slide up (400ms, delayed 200ms after flip)
t=2650ms Rarity shimmer begins (Legendary only — continuous)
t=3000ms "Add to Collection" CTA fades in (250ms)
t=3200ms User taps "Add"
t=3200ms Card thumbnail flies to collection tab icon (300ms arc transition)
t=3400ms Collection tab icon bounces (150ms --ease-out-back)
t=3550ms Count badge on collection tab increments (+1)
```

`prefers-reduced-motion` version: skip all transforms, just fade between states at 150ms each.

---

### Guardian Defeat → Legendary Reveal

```
t=0ms    Final HP drains to 0 (400ms --ease-in-out)
t=400ms  Guardian shakes violently (incorrectShake ×2)
t=700ms  Guardian scales to 0 + fades (800ms --ease-in-out)
t=800ms  Screen flashes white briefly (100ms)
t=900ms  "ZONE COMPLETE!" text blasts in (display-xl, scale 0 → 1.1 → 1.0, 600ms --ease-out-back)
t=1200ms Stars rain down (CSS animation, 8 stars, staggered 80ms each)
t=1800ms Dark overlay fades in
t=2000ms Legendary card slides up (guardianEnter 800ms)
t=2800ms Card flip (600ms cardFlip)
t=3000ms Gold shimmer animation begins on card frame (continuous)
t=3200ms Sparkle particles radiate (16 particles, staggered, each 600ms)
t=3400ms "LEGENDARY DROP!" text fades in (display-lg, --legendary colour)
t=3800ms Card details appear
t=4200ms "Add to Collection" CTA appears
```

---

### Onboarding Step Transition

```
t=0ms   User taps "Continue"
t=0ms   Current screen fades out (pageExit 200ms)
t=150ms New illustration cross-fades in (250ms)
t=200ms Step dot animates: current shrinks, next expands (150ms --ease-out-back)
t=250ms New options grid fades + slides up (pageEnter 250ms)
t=400ms CTA button fades in (150ms, slight delay for visual rhythm)
```

---

## Deliverable 6 — Design Decision Rationale

### Why these border radii?
- `--radius-card: 16px` — matches the "friendly, approachable" tone. Circular (50%) feels toy-like; sharp corners feel adult/corporate. 16px is the sweet spot: clearly rounded without looking like a children's app.
- `--radius-button: 12px` — slightly less rounded than cards to create visual hierarchy. Pill buttons (`--radius-pill`) used for CTA primary buttons to draw maximum attention.
- `--radius-modal: 24px` — larger radius on modals because they float above content and need to feel "picked up" from the surface.

### Why Nunito + Inter?
- **Nunito** (display/labels/game): rounded terminals match the friendly, energetic tone. Its heavy weights (800–900) give headings strong visual punch without feeling aggressive. Perfect for children.
- **Inter** (body/parent): designed specifically for screen readability. Neutral, trustworthy, and highly legible at small sizes — exactly right for the parent dashboard where data density matters.
- **JetBrains Mono** (maths expressions): monospace ensures maths equations align correctly. JetBrains Mono has open apertures that aid readability at small sizes.

### Why these specific shadow colours?
Cool-tinted shadows (`rgba(66, 100, 200, 0.*)`) rather than standard black shadows because:
1. The `--background` has a subtle blue tint (`#FAFBFF`). Cool shadows harmonise with it — warm shadows would clash.
2. Blue-tinted shadows feel lighter and more digital-native, matching the gamified aesthetic.
3. At low opacity, blue shadows read as "atmospheric depth" rather than "heavy object" — appropriate for a light, airy UI.

### Why this type scale?
- `body-md` at 16px (minimum) is critical for children aged 7–12 who may have developing reading skills or mild dyslexia. 16px is the WCAG 2.1 recommendation for body text.
- Large step ratios (each step ~1.2–1.3× the previous) ensure headings are **distinguishable without colour** — a hard accessibility requirement.
- The display steps (56px, 72px) are reserved for game-moment UI only — overuse would undermine their impact.

### Why these subject colours?
- All 3 primary subjects have similar chroma/saturation (~0.55 in OKLCH space) ensuring equal visual weight.
- Hues are maximally distinct (blue/pink/green are 120° apart on the colour wheel) — critical for children who may be red-green colour-blind.
- On-subject text colours (`--text-on-maths`, etc.) are dark variants of each hue, ensuring 4.5:1 contrast on their respective tinted surfaces.

### Why 5 difficulty tiers (Sprout → Lightning) instead of 3?
A 3-tier system (easy/medium/hard) carries implicit judgement. The themed names (Sprout, Explorer, Lightning) communicate "journey stages" rather than ability levels — more encouraging for struggling learners and less patronising for advanced ones.

### Why cool-tinted shadows?
Warm brown/grey shadows (typical) would look dusty on a blue-white background. Cool shadows blend with the background's chromatic identity and reinforce the "crisp digital" aesthetic vs. physical print.

---

## Deliverable 7 — Anti-Patterns / Do-Not-Do List

### Colour
- ❌ **Never use `--lightning` (#FFD43B) as text** on `--background` or `--surface` — it fails WCAG AA (1.8:1 contrast). Always use it as background with dark text, or as a decorative border/icon.
- ❌ **Never stack more than 3 chips/badges in a row at 375px** — they overflow. Wrap to second line with `flex-wrap: wrap`, or use a count badge (`+3 more`).
- ❌ **Never mix subject colours** across content domains. A maths card must not use `--english` for any accent — it breaks the subject language system.
- ❌ **Never use `--guardian` colour outside of Guardian/Boss UI** — its deep purple reads as "danger" or "special" and loses meaning if overused.
- ❌ **Never use `--legendary-gradient` on non-Legendary cards** — rarity inflation destroys the reward hierarchy.
- ❌ **Never use `--error` for decorative purposes** (e.g. a red tag that just means "hot topic") — it always signals a problem state.

### Typography
- ❌ **Never go below 12px** for any text the user needs to read, even captions on mobile.
- ❌ **Never use `--font-mono` for anything except maths expressions** — it reads as "technical" and breaks the friendly tone.
- ❌ **Never use `display-xl` or `display-lg` sizes in regular UI** — reserve for celebration screens and boss battles only.
- ❌ **Never use placeholder text as the only label** — always have a visible `<label>` element.
- ❌ **Never use bold alone to indicate a heading level** — use the correct semantic heading element (`h1`–`h4`).

### Layout
- ❌ **Never trigger horizontal scroll at 375px** — test every layout at this width.
- ❌ **Never put content underneath the bottom tab bar** — always add `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to scrollable content.
- ❌ **Never use `position: fixed` for quiz feedback** — it detaches from the answer options visually and confuses children.
- ❌ **Never show the bottom tab bar on tablet/desktop** — use sidebar nav instead.
- ❌ **Never use `overflow: hidden` on `.scroll-area`** — use `-webkit-overflow-scrolling: touch` and `overflow-y: auto` + hide scrollbar via `::-webkit-scrollbar { display: none }`.

### Motion
- ❌ **Never loop a decorative animation on content the user is reading** — the streak flame and idle character animations are fine; spinning backgrounds or pulsing cards are not.
- ❌ **Never animate the page exit with a translate** — only fade out on exit. Translating the exiting page causes visual confusion about direction and can trigger motion sickness in children.
- ❌ **Never use `--duration-dramatic` (800ms) for routine interactions** like button presses or filter toggles — reserve it for once-per-session moments (card reveal, boss defeat).
- ❌ **Never remove `prefers-reduced-motion` handling** — many children with sensory processing differences or vestibular disorders rely on it.

### Accessibility
- ❌ **Never use `outline: none` without a replacement focus indicator**.
- ❌ **Never use emoji in navigation, forms, error states, or buttons** — screen readers announce emoji names which disrupts reading flow (e.g. "sparkles sparkles sparkles Learn").
- ❌ **Never use colour alone** to communicate quiz results, streak status, or topic completion — always pair with an icon and/or text label.
- ❌ **Never put interactive elements inside `aria-hidden` regions**.
- ❌ **Never auto-focus an input on page load on mobile** — it opens the keyboard unexpectedly, which disorients children.

### Components
- ❌ **Never use a toast for quiz answer feedback** — always use inline states (correct/incorrect answer option + feedback strip).
- ❌ **Never make a Discovery Card openable by clicking the progress bar** — only the card tile itself is the hit target.
- ❌ **Never show a Guardian boss screen without completing the lesson prerequisite** — unlocked state must be enforced, not just visually communicated.
- ❌ **Never put more than 4 answer options** on a quiz question — 4 is optimal for children's working memory at this age group.
- ❌ **Never auto-advance after a correct answer** without a user-initiated "Continue" button — some children need extra processing time.

### Dark Mode
- ❌ **Do not implement dark mode for MVP** — maintain a single, well-tested light theme. When dark mode is added later, define new surface tokens rather than inverting existing ones.
