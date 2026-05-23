# Decifer Learning — Product Content System

> Version 1.0 — Phase 10C: Product Experience and Brand System
> Defines the content model, copy rules, and structure for every page and state in the product.
> Cross-reference with `DECIFER_BRAND_GUIDELINES.md` for tone and visual rules.

---

## 1. Homepage content structure

### Purpose

Convert curious visitors (parents and students) into registered users.
Secondary: build trust with parents before they encourage their child to register.

### Sections (in order)

| # | Section | Headline |
|---|---|---|
| 1 | Hero | "Learning that talks back." |
| 2 | How it works | "How it works" |
| 3 | Student journey | "The learning journey" |
| 4 | Parent confidence | "Progress you can see. Learning you can trust." |
| 5 | Sample topics | "Explore topics" |
| 6 | Gamification preview | "Progress that motivates" |
| 7 | Help & guides | "Help and guides" |
| 8 | Final CTA | "Ready to start?" |

### Hero copy model

```
[Brand mark — large]

Learning that
talks back.

[Supporting line — 2 sentences max, ≤ 30 words]

[Primary CTA]   [Secondary CTA]
```

Primary CTA: "Start learning →"
Secondary CTA: "Parent sign in"

### Sample topics disclaimer

> "Example topics shown below — actual availability depends on your year group and content status."

Always include this when showing illustrative topic cards on the homepage.

### Parent confidence section — required trust points

1. See progress in real time
2. Structured by UK National Curriculum
3. Quality-checked content only
4. Built to build confidence, not frustration

---

## 2. Login page content structure

### Layout

- Desktop: left panel (brand + journey), right panel (form)
- Mobile: centred form card with brand mark above

### Heading copy

```
Welcome back.
Continue building confidence, one topic at a time.
```

### Supporting links

```
New to Decifer? Create an account
Help & guides · Parent guide
```

### Error states

- Expired/invalid link: "The confirmation link has expired or is invalid. Please sign in or request a new link."
- General failure: "Something went wrong. Please try again."

### Success states

- Password updated: "Password updated. Please sign in with your new password."
- Magic link sent: "Check your email ✓ — We sent a sign-in link to [email]."
- Reset link sent: "Check your email ✓ — We sent a password reset link to [email]."

---

## 3. Student dashboard content rules

### Primary question answered

> What should I do next?

### Required sections

| Section | Content |
|---|---|
| Header | Greeting with first name, year group/KS label, points and streak |
| Suggested next | "Continue learning" — first available topic with a Start → CTA |
| Quick links | World Map, Collection (with card count or "—") |
| Topics list | All published topics for the year group |
| Empty state | "No topics yet — check back soon!" |

### Greeting model

```
Hi {first_name} 👋
{Year Group} · {Key Stage}
```

### Suggested next topic model

```
Continue learning                           [label: text-xs font-bold uppercase text-brand]
{Topic Title}            [Start →]
{Subject Name}
```

### Topic card model (in dashboard)

```
[subject colour strip — h-1]
[subject dot] [Subject Name]              [Year Group]
{Topic Title}
{Description if available}

[📖 Learn] [✏️ Practise] [⚡ Quiz]
```

All three action buttons must be min-h-[48px].

### Empty state copy rules

- No "No records found" or database language.
- Always include an icon and a short encouraging message.
- Include an action where relevant.

---

## 4. Parent dashboard content rules

### Primary questions answered

1. What is my child learning?
2. Are they progressing?
3. Where are they struggling?
4. What should I encourage next?

### Required sections

| Section | Content |
|---|---|
| Header | Greeting, child count context |
| Per-child card | Progress snapshot, accuracy, recommended next, areas to strengthen |
| Link another child | Always available after first child is linked |
| No children state | Prominent "Link a child account" form |

### Child progress labels

- "Topics started" — count of topics with any progress
- "Topics mastered" — count of topics with status='completed' and score ≥ 70%
- "Quizzes taken" — total quiz attempts
- "X this week" — sub-label on quizzes when quizzesThisWeek > 0
- "X% average accuracy" — quiz score average

### Recommended next lesson model

```
[Next lesson] OR [Start here]
{Lesson title}
{Topic title} · {Subject} · {X min}
```

### Areas to strengthen model

```
Areas to strengthen                        [label: text-xs text-incorrect uppercase]
{Topic title}            XX% correct
```

Maximum: 2 topics shown. Always show "no struggle areas" message if all areas are clean and quizzes > 0.

### Screen-time controls

Currently a placeholder. Copy: "Daily time limits and allowed hours are coming in a future update."

---

## 5. Topic card content model

Every rendered topic card should support:

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Topic name from DB |
| `subjectName` | Yes | Subject name |
| `subjectColor` | Yes | Subject colour hex from DB |
| `yearGroupLabel` | No | e.g. "Year 3" |
| `description` | No | Short child-facing description, ≤ 20 words |
| `progressPercent` | No | 0–100, renders a progress bar |
| `xpAvailable` | No | Integer, renders "XX XP available" |
| `isLocked` | No | Default false; renders locked state |

### Locked state

```
[grey dot] {Subject Name}
{Title} (muted)
🔒 Complete earlier topics to unlock this one.
```

### CTA label logic

| Progress | CTA Label |
|---|---|
| No progress data | "Start" |
| 0% < progress < 100% | "Continue" |
| 100% | "Review" |

---

## 6. Learn page content model

The Learn page renders `learn_content.body_html` via `dangerouslySetInnerHTML`.

### Required wrapping copy

**Above content:**
```
📖 {Topic Title}
{Subject Name} · {Year Group}
[← Back to topics]
```

**Below content:**
```
[Next: Practise →]
```

### Content quality rules

- All HTML rendered from `body_html` must use `.learn-content` scoped styles.
- Links within learn content must open in the same tab (no `target="_blank"`).
- Images within learn content must have alt text.

---

## 7. Practise page content model

### Before game loads

```
✏️ Practise — {Topic Title}
{Subject Name} · {Year Group}
```

### Progress indicator

Show question count: "Question 3 of 10" or similar.

### After completing practise

```
Well done! You've practised {Topic Title}.
[Take the Quiz →]   [Practise again]
```

---

## 8. Quiz page content model

### Before quiz starts

```
⚡ Quiz — {Topic Title}
{Subject Name} · {Year Group}
[Begin quiz →]
```

### During quiz

- Hearts display: top-right, 3 hearts
- Progress: current question / total
- Hint button: always visible, 3 levels available

### Hint copy model

- Hint button idle: "Hint" or "💡 Hint"
- Hint 1: smallest cost, broadest direction
- Hint 2: mid cost, narrows the approach
- Hint 3: highest cost, closest to answer

### Correct answer feedback

```
Correct! ✓
[brief explanation if available]
```

### Incorrect answer feedback

```
Not quite.
[explanation]
[Next question →]
```

### Quiz result — pass (≥ 70%)

```
{score} out of {total}
[XP earned]
[Discovery Card reveal if applicable]
[→ Back to topics]
```

### Quiz result — fail (< 70%)

```
{score} out of {total}
[Try again →]   [← Back to topics]
```

No shame copy. No "You failed." Just the score and clear options.

---

## 9. Badge and XP copy rules

### Badge award popup

```
🏅 Badge unlocked!
{Badge name}
{Short description}
```

### XP award

```
⭐ +{XP} XP
```

Never say "You earned X points." Always use the inline "+X XP" format in the UI.

### Streak milestone

```
🔥 {N} day streak!
```

For first streak day: "🔥 Streak started!"

---

## 10. Empty state copy

| Context | Copy |
|---|---|
| No topics | "📚 No topics yet — check back soon!" |
| No cards collected | "🃏 Complete a quiz to earn your first Discovery Card!" |
| No badges | "🏅 Earn badges by completing topics and quizzes." |
| No linked children | "Link your child's account to see their progress." |
| No weak areas | "Great work — no struggle areas detected yet." |
| No quizzes taken yet (parent) | "Weak areas will appear after your child completes quizzes." |

---

## 11. Error state copy

| Error | Copy |
|---|---|
| Network/generic | "Something went wrong. Please try again." |
| Expired auth link | "The confirmation link has expired or is invalid. Please sign in or request a new link." |
| Content not found | "This topic isn't available right now. Please go back and try another." |
| No published questions | "No questions available for this topic yet." |
| Failed to submit answer | "We couldn't save your answer. Check your connection and try again." |

Error messages must:
- Never expose database errors or technical detail.
- Always offer a recovery action.
- Use calm, non-alarming language.

---

## 12. Success state copy

| Action | Success message |
|---|---|
| Child account linked | "Account linked. You can now see their progress." |
| Quiz submitted (pass) | "{score}/{total} — [see XP and card reveal]" |
| Quiz submitted (fail) | "{score}/{total} — [Try again CTA]" |
| Streak shield used | "Shield used — your streak is safe." |
| Password reset sent | "Check your email — we sent a reset link to {email}." |
| Magic link sent | "Check your email — we sent a sign-in link to {email}." |

---

## 13. Help content taxonomy

```
/help
  /help/parent-guide
  /help/student-guide
  /help/how-decifer-works
  /help/gamification
  /help/content-quality
  /help/faq
```

### Help page rules

- Each page answers one clear question or serves one audience.
- All pages use the `/help` layout with sticky nav and back-to-dashboard link.
- Parent-facing pages: `audience="parent"` on GuideCard.
- Student-facing pages: `audience="student"` on GuideCard.
- Pages should not require login — all help content is public.

---

## 14. Guide content taxonomy

Each guide covers:

| Page | Primary audience | Question answered |
|---|---|---|
| Parent guide | Parent | How do I set this up and understand my child's progress? |
| Student guide | Student | How do I use Decifer and what do the rewards mean? |
| How Decifer works | Both | What is the philosophy and structure behind Decifer? |
| Gamification explained | Student (+ parent) | What does every reward do and how do I earn it? |
| Content quality | Parent | How are questions made and checked? |
| FAQ | Both | What are the most common questions? |

---

## 15. Navigation content rules

### Authenticated child nav (TopBar)

- Brand mark (left)
- Display name (right, small)
- Sign out button (right)

### Bottom tab bar (mobile, child)

- 🏠 Home → /dashboard/child
- 🗺️ Map → /world-map
- 🃏 Cards → /collection
- 👤 Profile → /settings (future)

### Help nav (inside /help layout)

- Brand mark (left) → links to /
- "Back to dashboard →" (right) → links to /dashboard

### Auth nav (inside auth layout)

- No nav bar on mobile (full-screen form)
- Left panel contains brand mark linking to /

---

## 16. Page title conventions

```
{Page context} — Decifer Learning
```

Examples:
- "Dashboard — Decifer Learning"
- "Sign in — Decifer Learning"
- "Multiplication Tables · Quiz — Decifer Learning"
- "Parent guide — Decifer Learning"
- "Help — Decifer Learning"
