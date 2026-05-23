# Decifer Learning — Brand Guidelines

> Version 1.0 — Phase 10C: Product Experience and Brand System
> This document defines the master brand, visual language, and tone of voice for Decifer Learning.
> It supersedes any prior informal decisions and is the reference for all product design and content decisions.

---

## 1. Brand purpose

Decifer Learning exists to help children build **genuine confidence through structured, guided learning** that talks back.

Learning should feel like a conversation — not a test, a quiz database, or a reward machine. Decifer is the guide in that conversation.

---

## 2. Brand promise

Every child who uses Decifer will leave a session feeling more capable than when they started.

---

## 3. Product positioning

> A guided learning companion for UK primary and secondary students that helps children understand, practise, improve, and feel proud of their progress — with full visibility for parents.

Decifer is not:
- A flashcard app
- A quiz game
- A homework helper
- A corporate EdTech platform

Decifer is:
- A learning companion
- A confidence builder
- A curriculum guide
- A family tool

---

## 4. Master brand name

**Decifer Learning** — full product name.

**Decifer** — short form, acceptable in navigation, badges, app shell, casual copy.

**DL** — initials, acceptable only in very space-constrained contexts (e.g. app icon alt text).

### Naming rules

- Always capital D, lowercase ecifer: **Decifer**, never DECIFER or decifer.
- Do not use "Sproutlearn", "EduPlatform", or any deprecated name anywhere.
- "Learning" can be dropped in product UI when context is clear, but never in marketing or help content.

---

## 5. Brand symbol — the offset dialogue brackets

### Symbol

```
< >
```

The two characters are **vertically offset**: `<` shifted up, `>` shifted down.
Together they form the Decifer mark.

### Meaning

| Bracket | Represents |
|---|---|
| `<` (upper) | The learner — asking, exploring, opening a question |
| `>` (lower) | The guide — responding, explaining, giving feedback |
| The offset | Dialogue in motion — learning is not static |

### Implementation (code)

```tsx
<span className="font-heading font-black text-brand -translate-y-[0.15em]">{'<'}</span>
<span className="font-heading font-black text-brand translate-y-[0.15em]">{'>'}</span>
```

### Usage rules

- The symbol always appears with brand orange (`#F97316`) applied to both brackets.
- The wordmark "Decifer" appears to the right of the symbol in `ink` (`#2D3748`).
- On coloured backgrounds, the wordmark may be white.
- Do not use the symbol without the wordmark in contexts where users are unfamiliar with the brand.
- Do not use the symbol in ways that imply less-than or greater-than mathematical operators.

---

## 6. Colour system

### Brand accent

| Token | Hex | Use |
|---|---|---|
| `brand` | `#F97316` | Primary CTAs, links, active states, the brand mark, key highlights |
| `brand-50` | `#FFF7ED` | Warm background tints, parent section backgrounds, callout panels |
| `brand-600` | `#EA580C` | Hover states on brand-coloured buttons |

### Subject colours

| Token | Hex | Subject |
|---|---|---|
| `maths` | `#6C9EFF` | Maths — blue |
| `english` | `#FF8FAB` | English — rose |
| `science` | `#52D9A0` | Science — green |

Subject colours are **fixed identifiers**, not decorative choices. Never swap them.

### Difficulty tier colours

| Token | Hex | Tier |
|---|---|---|
| `sprout` | `#A8E6CF` | Foundational |
| `explorer` | `#74C0FC` | Standard |
| `lightning` | `#FFD43B` | Stretching |

### Feedback & gamification

| Token | Hex | Use |
|---|---|---|
| `correct` | `#40C057` | Correct answer states |
| `incorrect` | `#FF6B6B` | Incorrect answer states |
| `points-gold` | `#FFC107` | XP, points, star indicators |

### Neutral / UI

| Token | Hex | Use |
|---|---|---|
| `background` | `#FAFBFF` | Page background — warm off-white |
| `surface` | `#FFFFFF` | Cards, panels, forms |
| `ink` | `#2D3748` | Primary text |
| `muted` | `#718096` | Secondary text, labels, captions |

### Rules

- Primary action buttons use `brand` with white text.
- Secondary actions use white/surface with a `border-black/10` border.
- Never use `maths` blue for primary CTAs — that colour is owned by the Maths subject.
- Gradient usage must be minimal. Prefer flat colour with opacity modifiers.
- Brand orange must not appear on red or incorrect states — use `incorrect` (`#FF6B6B`) only.

---

## 7. Typography

### Type scale

| Role | Font | Weight | Class |
|---|---|---|---|
| Display / hero headings | Nunito | Black (900) | `font-heading font-black` |
| Section headings | Nunito | Bold (700) | `font-heading font-bold` |
| Card titles | Nunito | Semibold (600) | `font-heading font-semibold` |
| Body text | Inter | Regular (400) | `font-body` |
| Labels / tags | Inter | Semibold (600) | `font-semibold uppercase tracking-wide` |
| Captions / meta | Inter | Regular (400) | `text-xs text-muted` |

### Rules

- Nunito is the heading font. Inter is the body font. Do not introduce new fonts.
- Minimum body text size: `text-sm` (14px) for all reading text.
- Minimum label text size: `text-xs` (12px) for short labels only — never for reading text.
- Line length: `max-w-prose` or similar for reading passages. Never let text span the full screen width.
- Child-facing copy: favour shorter sentences. Split at natural pauses. Never exceed 2–3 lines per paragraph on child-facing screens.

---

## 8. Spacing and radius

### Spacing rhythm

Use Tailwind's default 4px base. Common spacings:
- Between sections on a page: `py-16` (64px)
- Within a card: `p-5` (20px)
- Between list items: `gap-3` (12px)
- Button internal padding: `px-4 py-2` or `px-5 py-3`

### Border radius

| Context | Radius |
|---|---|
| Full-width page sections | No radius — edge to edge |
| Cards and panels | `rounded-2xl` (16px) |
| Buttons | `rounded-xl` (12px) |
| Small chips / tags | `rounded-full` |
| Input fields | `rounded-lg` (8px) |

Do not mix radius scales within the same card.

---

## 9. Iconography

- Use standard emoji for functional icons (📖 Learn, ✏️ Practise, ⚡ Quiz, 🗺️ World Map, 🃏 Collection, 🔥 Streak, ⭐ XP).
- Emoji must always have descriptive aria-hidden="true" plus nearby text label.
- Do not use emoji as the sole indicator of meaning.
- Custom SVG icons may be used for decorative purposes but must follow the existing style: round, friendly, minimal strokes.

---

## 10. Illustration guidance

- Illustrations should feel **friendly, modern, and curriculum-adjacent** — not clipart, not anime.
- Avoid characters that could read as stereotyped.
- Science zone illustrations should feel like discovered worlds (cave, forge) not textbook diagrams.
- Maths zone illustrations should feel like adventure spaces (jungle, labyrinth) not classrooms.
- Discovery Card illustrations: variety of natural, cultural, and scientific topics. Five rarity levels should have visually distinct illustration styles (Common = simple, Legendary = dramatic/detailed).

---

## 11. Motion guidance

- Use Framer Motion only where animation communicates something meaningful: a correct answer, a card drop, a badge unlock, a level complete.
- Default to `duration: 0.3` or shorter. Never slow a child down with animation.
- Respect `prefers-reduced-motion` — all animations should have a no-motion fallback.
- No spinning, pulsing, or flashing elements on permanent UI.
- Celebration animations (badge unlock, card reveal) may be more expressive.

---

## 12. Tone of voice

### Core voice qualities

- **Warm** — Decifer is on the child's side.
- **Clear** — One idea at a time. Short sentences.
- **Encouraging** — Progress is noticed. Effort is valued.
- **Honest** — No empty praise. Celebrate real wins.
- **Calm** — No urgency, no fear, no countdown pressure.

### Child-facing voice

- Use "you" and "your" always.
- Use simple, everyday words. Avoid jargon.
- Refer to activities by their short names: Learn, Practise, Quiz.
- Celebrate specifically: "You got 8/10 — that's your best score yet." Not: "Great job!!!"
- Mistakes are framed as information, not failure: "Not quite — here's a hint."
- Short sentences. Max 2 lines per message.

### Parent-facing voice

- More explanatory, slightly more formal, but never cold.
- Use "your child" not "they".
- Explain decisions clearly: "We show only published content — here's what that means."
- Never use shame language about children's performance.
- Progress is "building" and "developing", never "behind" or "below average".

---

## 13. Writing rules — child-facing copy

| Rule | Example |
|---|---|
| Short headlines | "What's next?" not "View your recommended topic for today" |
| Action verbs in CTAs | "Start", "Continue", "Try again" — not "Click here" |
| Second person | "Your streak" not "The streak" |
| Specific celebration | "8 out of 10 — brilliant." not "Well done!" |
| Neutral on mistakes | "Not quite. Try the next question." not "Wrong!" |
| No countdown pressure | No "Only 3 days left to…" |
| Clear mode labels | "📖 Learn", "✏️ Practise", "⚡ Quiz" |
| Friendly empty states | "No topics yet — check back soon!" not "No data found." |

---

## 14. Writing rules — parent-facing copy

| Rule | Example |
|---|---|
| Context-setting headers | "How your child is getting on" |
| Specific progress | "7 topics started · 3 mastered" |
| Reframe weak areas | "Areas to strengthen" not "Failures" or "Weak subjects" |
| Positive framing of effort | "Completed 4 quizzes this week" |
| Non-alarmist | "These topics had higher error rates — here's what to encourage." |
| Actionable | "Recommended next lesson: Multiplication Tables" |

---

## 15. Do and don't examples

### Copy

| ✓ Do | ✗ Don't |
|---|---|
| "Welcome back." | "Hello, User." |
| "Continue building confidence, one topic at a time." | "Access your learning dashboard." |
| "No topics yet — check back soon!" | "No records found." |
| "Areas to strengthen" | "Failing topics" |
| "8 out of 10 — your best score yet!" | "Score: 80% — average." |
| "Start" / "Continue" / "Review" | "Access" / "Enter" / "Navigate to" |
| "Not quite. Want a hint?" | "Incorrect. Try again." |

### Design

| ✓ Do | ✗ Don't |
|---|---|
| Orange for primary CTAs | Maths blue for primary CTAs |
| `rounded-2xl` cards with `shadow-sm` | Sharp corners or heavy drop shadows |
| 48px minimum tap targets | Small buttons on child-facing screens |
| Single clear action per card | Five equally-weighted buttons per card |
| Subject colour strip at top of card | Subject colour as full background |
| Friendly empty state with icon | Blank screen or generic "no data" |

---

## 16. Accessibility rules

- **Colour contrast**: All text must meet WCAG AA (4.5:1 for body text, 3:1 for large text).
- **Tap targets**: 48 × 48px minimum on all child-facing interactive elements.
- **Keyboard navigation**: All interactive elements reachable by keyboard.
- **Focus states**: Visible focus rings on all interactive elements. Never remove `outline` without adding a visible replacement.
- **Alt text**: All functional images must have descriptive alt text. Decorative images must have `aria-hidden="true"`.
- **Emoji**: Always paired with a text label. Never used as sole meaning-carrier.
- **Reduced motion**: Animations must degrade gracefully when `prefers-reduced-motion: reduce`.
- **Minimum font size**: `text-sm` (14px) for reading text on child-facing screens.

---

## 17. Component style rules

### Cards

```
rounded-2xl border border-black/5 bg-surface shadow-sm
```
- Coloured header strip (`h-1 w-full` with subject colour) for topic cards.
- Padding: `p-5`.
- Section title: `font-heading font-bold text-ink`.

### Primary buttons

```
flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-600
```

### Secondary buttons

```
flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white font-semibold text-ink transition-colors hover:bg-black/5
```

### Subject action buttons (inside topic cards)

```
flex min-h-[48px] items-center justify-center rounded-xl bg-[subject]/10 text-sm font-bold text-[subject] hover:bg-[subject]/20
```

### Form inputs

```
h-12 w-full rounded-lg border border-black/10 bg-white px-3 text-base focus:border-brand focus:ring-2 focus:ring-brand/30
```

### Labels / tags

```
text-xs font-bold uppercase tracking-wide text-muted
```

---

## 18. Gamification principles

See `DECIFER_GAMIFICATION_SYSTEM.md` for full detail.

Core principle: **reward learning effort and progress, not time spent or compulsive return loops**.

The emotional loop:

> I tried → I improved → I can see progress → I want to continue.

---

## 19. Example microcopy

### Dashboard welcome
```
Hi Sam 👋
Year 3 · KS2
```

### Suggested next topic
```
Continue learning
Multiplication Tables  [Start →]
```

### Quiz correct answer
```
Correct! ✓
```

### Quiz incorrect answer
```
Not quite — want a hint?
```

### Quiz result — pass
```
8 out of 10 — that's your best score yet!
You earned 80 XP.
```

### Quiz result — fail
```
You got 4 out of 10 this time.
Let's look at this again.  [Try again →]
```

### Streak display
```
🔥 7 day streak
```

### Empty collection
```
🃏 My Collection
Complete a quiz to earn your first Discovery Card!
```

### Parent progress label
```
Topics mastered: 3
Average accuracy: 78%
```

### Parent weak area
```
Areas to strengthen
Fractions — 42% correct
```
