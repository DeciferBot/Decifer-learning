# Decifer Learning — Gamification System

> Version 1.0 — Phase 10C: Product Experience and Brand System
> Defines the purpose, mechanics, constraints, and implementation details for all gamification in Decifer Learning.
> Cross-reference with `DECIFER_BRAND_GUIDELINES.md` (tone) and `DECIFER_PRODUCT_CONTENT_SYSTEM.md` (copy).

---

## 1. Purpose of gamification

Gamification in Decifer exists to:

1. **Make progress visible** — so children can see they are improving.
2. **Reinforce effort** — not just results.
3. **Create a reason to return** — a habit, not an addiction.
4. **Signal milestones to parents** — so they can celebrate with their child.
5. **Make the learning loop feel rewarding** — not hollow.

Gamification is a signal layer on top of real learning — it should never replace the actual satisfaction of understanding something.

---

## 2. What gamification should do

- Acknowledge every meaningful action (correct answer, quiz completion, daily login, badge unlock).
- Show progress towards the next step clearly.
- Make streaks a celebration, not a threat.
- Give children something concrete to collect and show.
- Help parents understand engagement through visible signals (XP, badges, cards).
- Create moments of genuine surprise and delight (card drops, badge unlocks, Guardian wins).

---

## 3. What gamification must not do

- Create anxiety about missing a day or losing a streak.
- Make children feel behind, less capable, or embarrassed compared to peers.
- Reward time-spent over learning-achieved.
- Use dark patterns, false urgency, or manufactured scarcity.
- Surface exploit loops that give outsized rewards for low-effort actions.
- Give parents data that ranks or labels children negatively.
- Make the game the primary goal — the learning is the goal.

---

## 4. The emotional loop (non-negotiable)

> **I tried → I improved → I can see progress → I want to continue.**

Every gamification feature must be traceable to one of these four steps.

---

## 5. XP logic

### Earning XP

| Action | XP awarded | Notes |
|---|---|---|
| Correct answer (Quiz) | 10 | Per correct answer |
| Perfect quiz (no hints, no wrong answers) | +25 bonus | Applied at quiz end |
| Completing a quiz (any score) | +5 | Participation reward |
| Daily login with activity | +10 | Once per day, requires at least 1 quiz answer |
| Using Hint 1 | -2 | Deducted at hint use |
| Using Hint 2 | -4 | Deducted at hint use |
| Using Hint 3 | -6 | Deducted at hint use |

### XP flooring rule

XP from any single quiz session cannot go below 0. A child who uses hints for every question will earn 0 XP for the session, not negative XP.

### XP display rule

Always show XP as a positive signal:
- After quiz: "You earned XX XP."
- Running total on dashboard: "⭐ 1,240 pts"
- Never show a negative number or a "you lost X XP" message.
- Hint deductions are reflected in the final total but not surfaced as a penalty message.

### XP labels

Use "XP" in student-facing UI, "pts" for the running total, "points" in parent-facing explanations.

### Mastery levels (future implementation)

| XP Range | Level | Label |
|---|---|---|
| 0–499 | 1 | Starter |
| 500–1,499 | 2 | Explorer |
| 1,500–3,499 | 3 | Achiever |
| 3,500–7,499 | 4 | Champion |
| 7,500+ | 5 | Master |

---

## 6. Badge logic

### Badge trigger rules

Badges are awarded by the `POST /api/badges/check` endpoint, called after:
- Quiz submission
- Daily login streak milestone
- Guardian victory

All badge logic must be **idempotent** — the same trigger must never award the same badge twice to the same profile.

### MVP badge catalogue

| Badge | Trigger | Notes |
|---|---|---|
| Topic Star | First quiz completion on any topic | Any score |
| Perfect Score | Quiz completed with 10/10, no hints | Lightning tier preferred but not required |
| Subject Champion | All published topics in a subject completed | Year-group specific |
| Streak 7 | 7 consecutive login days | Using a Streak Shield does not break this |
| Guardian Slayer | Guardian quiz completed (any zone) | One per zone won |

### Badge naming principles

- Short, positive, achievement-framed names.
- Verb-noun or noun-qualifier structure: "Topic Star", "Guardian Slayer", "Perfect Score".
- Avoid rankings: no "Bronze", "Silver", "Gold" badge hierarchy that implies inadequacy.
- Avoid scarcity language: no "Elite" or "Only 1% earn this".

### Badge display rules

- Display badge name, icon, and short description in the `BadgePopup` component.
- Parent dashboard: show badge count only ("3 badges earned"). Do not enumerate badge names in the parent view — that belongs to the child.
- On the child's profile/collection page (future): display all earned badges with date earned.

---

## 7. Streak logic

### Definition

A streak is the number of **consecutive calendar days** (in UK local time) on which the user:
1. Logged in, AND
2. Completed at least one quiz answer.

### Streak increment

Incremented once per calendar day by `POST /api/streak/check`, called after the first answered quiz question of the day.

### Streak reset

Resets to 0 if the user does not satisfy both conditions on a calendar day — unless a Streak Shield is available (see §8).

### Streak display

```
🔥 {N} day streak
```

For N = 1 (first day): "🔥 Streak started!"
For N = 7: trigger Streak 7 badge check.

### Streak loss copy

If a streak resets and no shield was available, no explicit "you lost your streak" message is shown. The streak simply resets to the current day's count (0 before activity, 1 after). The user sees their new streak naturally.

### Streak calendar (future)

A visual streak calendar (heatmap or dots) can be added to the child dashboard without changing the underlying logic.

---

## 8. Streak Shields logic

### Definition

A Streak Shield is a one-use item that absorbs one missed day, preventing a streak reset.

### Earning shields

| Action | Shields earned |
|---|---|
| Completing a quiz (any score) | 1 per quiz, capped at 3 per week |
| First quiz attempt on a new topic | 1 |

Shields are stored in `streak_shields.quantity` (integer). Maximum storable: unlimited.

### Using shields

Shields are consumed automatically by the streak check logic when a missed day is detected:
1. Check if quantity > 0
2. If yes: decrement quantity by 1, maintain streak value
3. If no: reset streak

### Shield display

```
🛡️ {N} shield{s}
```

Show on child dashboard only when quantity > 0.

### Shield consumption feedback

After a shield is used:
```
Shield used — your streak is safe. 🛡️
```

---

## 9. Mastery logic

### Topic mastery threshold

A topic is considered **mastered** when:
- The most recent quiz attempt scored ≥ 70% (7/10 or higher).
- `topic_progress.status` is set to `'completed'`.

### Mastery display

On the topic card:
- Progress badge: "Mastered ✓" when status = 'completed'.
- CTA changes: "Start" → "Continue" → "Review" based on progress.

On the parent dashboard:
- "Topics mastered: {N}" stat.

### Mastery does not mean done

A mastered topic appears in the SM-2 spaced repetition schedule for future review. "Mastered" means "understood right now" — the SR system handles long-term retention.

---

## 10. Topic completion logic

### Completion gate

A topic is completed when:
- Quiz score ≥ 70% on any attempt (not just the first).

The **highest score** across all attempts determines the completion status.
First-attempt-only rules are not used — retrying is always valid.

### Completion effects

On completion:
1. `topic_progress.status = 'completed'`
2. `topic_progress.last_score` updated
3. SM-2 schedule set: `sr_next_review = today + 1 day`, `sr_interval_days = 1`, `sr_repetitions + 1`
4. Discovery Card drop triggered (see §12)
5. Badge check triggered
6. XP awarded

### Unlock logic

Topic nodes in the World Map unlock sequentially. Topic N+1 unlocks when Topic N has `status = 'completed'`. This is evaluated server-side — the World Map node state is derived from `topic_progress`.

---

## 11. Parent-visible milestone logic

Parents see only aggregated signals:

| Signal | Shown to parent | Notes |
|---|---|---|
| Total XP | Yes ("⭐ X pts") | Running total |
| Streak | Yes ("🔥 N day streak") | Current streak only |
| Topics started | Yes (count) | |
| Topics mastered | Yes (count) | status = 'completed' |
| Badge count | Yes (count only) | Not individual badge names |
| Card count | Yes (count only) | Not individual card names |
| Average accuracy | Yes (percentage) | Across all quiz attempts |
| Weak areas | Yes (topic + accuracy) | Max 2 topics, only if attempts ≥ 5 per topic |
| Recommended next lesson | Yes | Based on progress |

Parents are never shown:
- Individual quiz scores per attempt
- Which specific questions were wrong
- A comparison to peers or averages
- Any label of "behind" or "below average"

---

## 12. Discovery Card drop logic

### Trigger

A Discovery Card drops after every quiz that the student passes (score ≥ 70%).

### Rarity distribution

| Rarity | Drop chance |
|---|---|
| Common | 40% |
| Uncommon | 25% |
| Rare | 15% |
| Epic | 10% |
| Legendary | 10% (Zone Guardian only) |

Legendary cards are excluded from the standard drop pool. They can only be earned by defeating a Zone Guardian.

### Card quantity

If the student already owns the card drawn, `child_collection.quantity` is incremented. Cards are never "lost" or "duplicated" — the collection is cumulative.

### Card reveal UX

The `CardReveal` modal plays after the quiz result screen. It should:
- Reveal the card with a brief animation (from face-down to face-up).
- Show the rarity, title, and fact text.
- Not be skippable until the animation completes (max 2 seconds).
- Always be skippable after that.

---

## 13. Student celebration rules

### Do celebrate

- First correct answer in a session: subtle positive feedback.
- Quiz pass: score display + XP earned + card reveal.
- Badge unlock: `BadgePopup` overlay (cannot be dismissed immediately).
- Streak milestone (7, 14, 30 days): banner or inline message on dashboard.
- Guardian victory: full-page result with Legendary card reveal.

### Do not celebrate

- Signing in (no fanfare for opening the app).
- Completing a practise session (acknowledgement only, no big celebration — save it for the quiz).
- Hint use (neutral feedback only).

### Celebration tone

- Specific: "8 out of 10" not "Great job!"
- Calm: no screen shaking, flashing, or excessive animation.
- Brief: celebration should last ≤ 3 seconds before offering the next action.
- Optional: always offer a "Continue" option immediately.

---

## 14. No-shame states

Every state where a child could feel bad must be handled carefully:

| State | Required handling |
|---|---|
| Quiz fail (< 70%) | Show score, offer "Try again" prominently, no shame language |
| Heart lost | "One heart used" — neutral, not punitive |
| Zero hearts | "Try again when you're ready" — offer retry immediately |
| Streak broken | No explicit loss message — streak just shows new count |
| Low XP session | Never show negative total, floor at 0 |
| Locked topic | "Complete earlier topics first" — clear path forward |
| No cards/badges yet | Empty state with encouraging action, not empty silence |

The rule: **always offer a clear path forward**. Never leave a child in a dead end.

---

## 15. Suggested mastery level copy

Use these in future profile/level display:

| Level | Label | Display copy |
|---|---|---|
| 1 | Starter | "You're just getting started." |
| 2 | Explorer | "You're building real knowledge." |
| 3 | Achiever | "You're making strong progress." |
| 4 | Champion | "You're mastering the curriculum." |
| 5 | Master | "You've reached the highest level." |

These are aspirational labels, not gatekeeping. A child at Level 1 is not "beginner" in a dismissive sense — they are "just getting started", which is exciting.

---

## 16. Zone Guardian system

### Challenge requirements

- All topic quizzes in the zone must be completed (status = 'completed') to unlock the Guardian.
- The Guardian is a 15-question quiz drawn randomly from all published topics in the zone.
- No hints in the Guardian quiz — this is the challenge mode.

### Guardian victory

- Awards a Legendary Discovery Card (guaranteed).
- Awards the "Guardian Slayer" badge.
- Updates `zones.guardian_quiz_id` state for the profile.

### Guardian defeat

- No penalty. Immediate retry is always available.
- The World Map shows the Guardian as "Defeated" / "Waiting" based on profile state.

---

## 17. Daily Mystery Challenge

### Structure

- 3 questions, one per day, per year group.
- Questions drawn from the pool of published questions across all topics.
- Seeded at midnight UK time by `pg_cron`.

### Rewards

- Completion awards XP (same as a 3-question quiz segment).
- No badge for daily challenge (keep it lightweight).
- No penalty for missing a day.

### Display

- Shown as a card on the child dashboard when available.
- "Today's challenge: {topic hint}" — surface it as a teaser, not a demand.
