# Child-Facing Copy Audit — 2026-08-18

> Every string a child reads, audited across `app/dashboard/child`, `app/(child)/**`,
> `components/{quiz,games,cards,world-map,child}/**`, nav, banners, empty/error/loading
> states. Ages served: Year 2–11 (6–16), one shared UI. Read-only audit; no files
> modified. Companion doc: `docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md`
> (the rubric this was scored against). Feeds `docs/PRODUCT_ROADMAP_2026.md`.
> File:line references are as of commit a67fbf3.

## 0. Headline findings

1. **There is no age-conditional copy anywhere in the child experience.** `year_group` / `key_stage` gate **content selection only** — which topics, lessons, quiz questions, exam options and Quiz Battle pools are fetched (`app/(child)/learn/page.tsx:13-16`, `app/(child)/world-map/page.tsx:44`, `components/live/PlayHome.tsx`, `components/explore/AskDecifer.tsx:69`). The only presentational uses are label display ("Year 3 · KS2" under the greeting, the year-group editor, lesson breadcrumbs). No sentence, button, tone, font size, or interaction changes for a 6-year-old vs a 16-year-old.
2. **Wrong-answer and fail-state copy is genuinely good** — warm, blame-free, deliberately engineered (see §2).
3. **The main debts:** percentages and XP shown to children on ~7 surfaces (while QuizShell deliberately bans them), latinate/ops jargon leaking into young-child surfaces ("pipeline", "quality checks", "penalty", "definition/slot"), static praise strings, and pts/points/XP + round/quiz terminology drift.

**Approximate distinct child-facing strings catalogued: ~320** (dashboard ~35, QuizShell ~45, quiz sub-components ~45, games ~35, vault ~25, consent/screen-time ~20, exam ~20, cards ~15, world-map ~15, daily challenge ~15, missions ~12, leaderboard ~10, collection ~15, nav/breadcrumb/loading ~20).

## 1. Home screen — `app/dashboard/child/page.tsx` + `components/child/*`

**Key strings:** `Hi {displayName}` (:270), `{streak} day streak` (:282), `{points} pts` (:287), shields tooltip `"Each shield keeps your streak alive if you miss a day"` (:297); next-action kickers `"Set by your parent"` (:74), `"Time to revisit"` (:84), `"Pick up where you left off"` (:99), `"Your first topic"` / `"Next up"` (:110); subtitles `"a quick replay locks it in"` (:86), `"a short round, about 2 minutes"` (:101); CTAs `Start →`, `Replay →`, `Carry on →`; Daily Mystery Challenge block (:329-357); Reward Vault teaser `"Real rewards for real progress"` (:375-380); empty state **"Topics appear here once they pass all quality checks. New content is added across all five subjects as it clears the pipeline."** (:461-462); `DailyGoalRing.tsx` `"One round keeps your streak alive. About 2 minutes."` (:44); `StreakPing.tsx` `"You showed up again today. Brilliant."` (:47-51).

**Reading level:** mostly Year 3–4. Kickers and CTAs are excellent (1–4 words). The empty-state body is Year 7+ ops vocabulary.
**Tone:** warm, second person, process-leaning. `"Real rewards for real progress"` is marketing-speak aimed over the child's head.
**Problems:** `pts` vs "points" drift; `"locks it in"`/"banked" idioms opaque to EAL/young readers; shield explanation lives in a `title` attribute — invisible on touch devices, i.e. the youngest users never learn what a shield does.

## 2. QuizShell — `components/quiz/QuizShell.tsx`

**Key strings:** hearts (boss only): `"Out of hearts!"` / `"Don't worry, no score saved. Give it another go!"` (:647-654); result headings `"First topic complete!"`, `"Great work!"`, `"You got every one!"`, `"Nearly there!"`, `"Round complete!"`, `"You got {n} right"`, **"This one is tricky"** for zero (:781-792, with the comment *"'You got 0 right' is a rough thing to say to a child"*); result bodies (:808-812) incl. `"Your points are banked. {n} questions gave you trouble, so let's just do those again."`; `"Exam technique: {x}/{y} questions answered in the right format"` (:820); `"+{n} points earned"` (:843) vs `"Total: {n} pts"` (:847); CTAs `"Fix that one →"` (:908), `"Go again for a clean run →"` (:916); in-quiz `"3-in-a-row! Bonus +5 pts!"` (:1022), `"Halfway there, keep going!"` (:1038), `"Bonus Challenge: double points!"` (:1139), `"Not quite. Here's a hint. Try again!"` (:1221), `"Correct! Full marks!"` (:1348), `"Incorrect. The answer is X"` (:1353), `"No points this time, you'll get it next time!"` (:1358).

**Assessment:** the **best fail-state copy in the product**. A miss banks points, offers a fix-up of only missed questions, and never shows a percentage (deliberate, documented at :797-803). `"This one is tricky"` externalises difficulty onto the question — textbook growth-mindset framing. **Protect this work.**
**Problems:** (a) praise is **static** — `"Correct! Full marks!"` fires identically up to 5× per round; (b) `"Incorrect."` is a cold latinate verdict next to otherwise warm copy — the register flips at the worst moment; (c) `"Full marks!"` on a single question is school-report vocabulary; (d) `pts` vs `points` within one screen; (e) `"banked"` idiom for 6–8s.

## 3. Other quiz components

- **DifficultyPicker.tsx** — `Mixed / Sprout / Explorer / Lightning` with one-line descriptions (:18-21). Good, short, process-framed. "Difficulty" is Y4+ vocabulary; tier names skew young for KS4 ("Sprout" for a GCSE student is a self-labelling cost).
- **HintButton.tsx** — `"Hint unlocks in {n}s. Give it a try first!"` (:52-53), `"That's all the hints for this one. You've got this!"` (:71). Warm; cheerleading reads patronising at Y8+.
- **GuardianVictoryScreen.tsx** — `"Guardian Defeated!"`, **`{pct}%` in a ring** (:232), `"Challenge a friend"` (:272). Problem: shows a percentage while QuizShell's result screen deliberately bans them.
- **BadgePopup.tsx** — dismiss button **"Awesome!"** (:99): babyish for Y8+, US register in an en-GB product.
- **ReflectionPrompt.tsx** — `"What's one thing you figured out in {topic}?"` (:71). Excellent: voluntary, open, process-oriented. Maths-specific placeholder appears on every subject (:76).
- **PreTestShell.tsx** — `"Have a go, don't worry if you're not sure yet!"` (:65), `"You got it! Great intuition."` (:112). Warm; "intuition/instincts" are Y6+ words, and the coaxing register is patronising at KS4.
- **StructuredAnswer.tsx** (KS4) — `"Mark my answer ✓"` (:130), `"Good answer!" / "Keep practising!"` (:197-198). Correctly teen-pitched — the one surface written for older users.
- **ExplainExample.tsx** — `"Both parts correct. Great exam technique!"` (:157). Good scaffolding; "exam technique" is school-report register.

## 4. Games — `components/games/**`

- **FillBlank.tsx** — **`"✗ Incorrect. The answer is {x}. Moving on…"` with 1.8s auto-advance** (:37, :148). A 6–7-year-old cannot read a 9-word correction in 1.8 seconds, and "Moving on…" removes agency at the moment of failure. Highest-severity young-child issue in the games.
- **NumberLine.tsx** (Year 3 audience) — `"Not quite. {label} is {target}"` (:184), `"You nailed the number line."` (:223-224). Good length; "nailed" idiom borderline for 7s.
- **DragDrop.tsx** — `"Tap a definition to select it, then tap a slot to place it."` (:122) — "definition"/"slot" are abstract latinate words on a surface served to Y2–3.
- **SpeedRound.tsx** — **`"{n} / {n} correct · {pct}%"`** (:89); timer turns red under 25%. Percentage again; red-timer pressure heavy for the youngest (opt-in per topic).
- **EquationBalancer.tsx** — Y7 audience; fine.

All game end screens funnel to `"Start the Quiz →"` — consistent, good.

## 5. World map, guardian, checkpoint

- `ZoneMap.tsx` — `"Zone Guardian Awakens!"` (:161-163), footer `"{x} / {y} topics complete"` **plus bold `{pct}%`** (:176-178); `"3 quick questions to check you're on track."` (:145-147) — school-report phrase.
- `GuardianBattleHeader.tsx` — `"15 questions: defeat them all to claim a Legendary card"` (:75) — misleading (pass mark is 70%); literal-minded children will believe one miss loses the card.
- `world-map/page.tsx` empty state `"Your world map is being built" / "Check back soon."` (:101-102) — one of the better-written empty states.

## 6. Collection, cards, missions, daily challenge, leaderboard, vault

- **CollectionGrid.tsx** — `"{x} / {y} cards discovered"` + **`{pct}%`** (:54-57); "filter" is Y5+ vocabulary.
- **CardReveal.tsx** — `"Legendary find!" / "Epic discovery!"` (:197) — good; uses "quiz" where home says "round".
- **missions** — mission titles from `app/api/missions/route.ts:10-15` include **`"Score {v}% or higher on a quiz"`** — a percentage-target mission served to Year 2; **`{pct}%`** chip per card (:154).
- **daily-challenge** — `"Perfect!" / "Great work!" / "Nice try!"` (:101) — the only surface with score-varied praise; shows `"{x} out of {y} correct"` **without** a percentage (good).
- **leaderboard** — `"{n} pts"` (:132) *and* `"You have {n} points total"` (:140) in one view.
- **vault** — **first and only appearance of "XP"**, a currency named nowhere else (:100); **red hint-penalty callout: `"−{n} XP hint penalty. You used {n} hints across your quizzes. Try answering without hints to reach rewards faster!"`** (:155-157) — punishes and shames hint use that every other surface encourages, in negative red framing, with the abstract word "penalty". **Worst tonal contradiction in the product.**

## 7. Gates, banners, system states

- **ConsentBanner.tsx** — `"Ask your parent or guardian to check their email. Quizzes pause in {n} days if they don't confirm."` (:69) — a deadline-threat sentence, 18 words, on screens read by 6-year-olds. Gated variant (:88-90) is good.
- **ScreenTimeRestScreen.tsx** — `"Great work today!"` / `"You've hit your learning time for today, a brilliant place to stop. Your streak and points are safe. Come back tomorrow for more."` (:17-33). **Model copy** — celebration instead of a block. Protect.
- **OfflineBanner.tsx** — `"Offline: quizzes will sync when you reconnect"` (:47). "Sync"/"reconnect" jargon for under-8s.
- **Exam surfaces** — bottom-nav tab "Exams" for all ages; result page leads with a **six-xl `{pct}%`** coloured red below 60 (result/page.tsx:118, :95-98) — the most school-report-like surface in the app, in the same nav a Year 2 child uses.

## 8. Ten worst offenders for a 6–7-year-old

1. `"Topics appear here once they pass all quality checks… as it clears the pipeline."` — `app/dashboard/child/page.tsx:462`
2. `"−{n} XP hint penalty… Try answering without hints to reach rewards faster!"` — `app/(child)/vault/page.tsx:155-157`
3. `"✗ Incorrect. The answer is {x}. Moving on…"` + 1.8s auto-advance — `components/games/FillBlank.tsx:37,148`
4. `"Ask your parent or guardian to check their email. Quizzes pause in {n} days if they don't confirm."` — `components/child/ConsentBanner.tsx:69`
5. `"Score 70%+ for a shot at the rare ones."` — `app/(child)/topics/[id]/quiz/page.tsx:234`
6. `"Exam technique: {x}/{y} questions answered in the right format"` — `components/quiz/QuizShell.tsx:820`
7. `"Tap a definition to select it, then tap a slot to place it."` — `components/games/DragDrop.tsx:122`
8. `"Score {v}% or higher on a quiz"` mission title — `app/api/missions/route.ts:11`
9. `"Every question, right in the end. A few took more than one go, so play it once more to finish the topic off."` (22 words) — `components/quiz/QuizShell.tsx:808`
10. `"15 questions: defeat them all to claim a Legendary card"` — `components/quiz/GuardianBattleHeader.tsx:75`

## Five worst for a Year 8

1. `"Awesome!"` dismiss button — `components/quiz/BadgePopup.tsx:99`
2. `"Have a go, don't worry if you're not sure yet!"` — `components/quiz/PreTestShell.tsx:65`
3. `"Sprout — Build your confidence"` tier naming — `components/quiz/DifficultyPicker.tsx:19`
4. School-report register inside a game: `"…check you're on track"` / `"Exam technique…"` — `ZoneMap.tsx:147`, `QuizShell.tsx:820`
5. `"Hint unlocks in {n}s. Give it a try first!"` — `components/quiz/HintButton.tsx:52-53`

## 9. Terminology inconsistencies

| Concept | Variants | Refs |
|---|---|---|
| Points unit | `pts` vs `points` | mixed within single screens (QuizShell :843 vs :847; home :287; leaderboard :132 vs :140) |
| Play unit | `round` vs `quiz` vs `challenge` vs `battle` | home :101; QuizShell :787; CardReveal :223; daily/guardian/live |
| Currency | `points` everywhere vs `XP` only in Vault | vault/page.tsx:100,137,155,184-188 — two currencies, no bridge |
| "Home" | nav `Home` → `/world-map` but QuizShell `Back to Home` → `/dashboard/child` (nav calls that `Progress`) | BottomNav.tsx:11-12; QuizShell.tsx:127 |
| Check button | `Check` / `Check Answer` / `Check Answers` / `Mark my answer ✓` | FillBlank / NumberLine / DragDrop / StructuredAnswer |
| Wrong verdict | `"Not quite."` mid-question vs `"Incorrect."` final | QuizShell :1221 vs :1353; FillBlank :148 |
| Capitalisation | `Try Again` vs `Try again`; `Practice Complete!` vs `complete!` | QuizShell :654 vs missions :76; FillBlank :48 vs NumberLine :223 |

## 10. Praise: static vs varied

- **Static:** `"Correct! Full marks!"` every first-try correct (QuizShell :1348); `"Great work!"` every pass forever after the first (:783); `"Awesome!"` (BadgePopup). A child completing one round hears identical praise up to 5×.
- **Varied:** daily challenge 3-way by score; StreakPing 3-way by milestone; PreTest 2-way. No randomised praise pools anywhere.
- **Process praise that exists is excellent:** `"You showed up again today. Brilliant."` (StreakPing:51), `"You worked through all {n} questions."` (FillBlank:49), ReflectionPrompt entirely.

## 11. Surfaces with no real copy problems (good work to protect)

ScreenTimeRestScreen; QuizShell fail states (banked points, fix-up, "This one is tricky", the documented no-percentage rule); ReflectionPrompt; world-map/learn/practise/daily-challenge empty states; StructuredAnswer (teen-pitched); TopicNode/HeartsDisplay/DiscoveryCard (minimal, strong aria labelling).

## 12. Copy debt register

| # | Issue | Example | File:line | Band | Severity |
|---|---|---|---|---|---|
| 1 | No age-conditional copy at all; one register serves 6–16 | — | entire child surface | all | **High** |
| 2 | Ops jargon in child empty state | "…as it clears the pipeline." | app/dashboard/child/page.tsx:462 | Y2–6 | High |
| 3 | Punitive red hint-penalty contradicting hint-friendly UX | "−{n} XP hint penalty…" | app/(child)/vault/page.tsx:155-157 | all | High |
| 4 | Timed auto-advance on failure text | "Incorrect… Moving on…" (1.8s) | components/games/FillBlank.tsx:37,148 | Y2–4 | High |
| 5 | Percentages on ~7 surfaces while QuizShell bans them | "{pct}%" | ZoneMap:178; CollectionGrid:57; GuardianVictory:232; SpeedRound:89; missions:154; exam result:118; quiz/page.tsx:234 | Y2–6 | High |
| 6 | "XP" currency exists only in Vault, unexplained | "earns you XP" | vault/page.tsx:100 | all | Med |
| 7 | Deadline-threat consent copy | "Quizzes pause in {n} days…" | ConsentBanner.tsx:69 | Y2–6 | Med |
| 8 | pts/points drift | "Total: {n} pts" vs "+{n} points earned" | QuizShell:843,847 et al. | all | Med |
| 9 | round/quiz/challenge/battle drift | — | quiz/page.tsx:232; CardReveal:223 | all | Med |
| 10 | Two "Home"s in navigation | — | BottomNav:11-12; QuizShell:127 | all | Med |
| 11 | Guardian promise overstates requirement | "defeat them all…" | GuardianBattleHeader.tsx:75 | Y2–6 | Med |
| 12 | Static praise repeats within one round | "Correct! Full marks!" | QuizShell.tsx:1348 | all | Med |
| 13 | "Incorrect." register vs "Not quite." | — | QuizShell:1353; FillBlank:148 | Y2–6 | Med |
| 14 | Babyish artefacts for teens | "Awesome!"; "Sprout"; "Have a go…" | BadgePopup:99; DifficultyPicker:19; PreTestShell:65 | Y7–11 | Med |
| 15 | School-report register inside game loop | "Exam technique…"; "on track" | QuizShell:820; ZoneMap:147 | Y2–6 | Med |
| 16 | Abstract instruction vocabulary in KS1/2 game | "definition… slot" | DragDrop.tsx:122 | Y2–4 | Med |
| 17 | Percentage-target mission titles | "Score {v}% or higher…" | app/api/missions/route.ts:11 | Y2–6 | Med |
| 18 | Shield explanation only in touch-invisible tooltip | — | dashboard/child/page.tsx:297 | all | Low |
| 19 | Idioms opaque to young/EAL readers | "banked", "locks it in", "nailed", "a shot at" | QuizShell:810; page.tsx:86; NumberLine:224; quiz/page.tsx:234 | Y2–5 | Low |
| 20 | Maths-specific placeholder on all subjects | "e.g. …multiplying by 10…" | ReflectionPrompt.tsx:76 | all | Low |
| 21 | Capitalisation drift | Try Again/Try again | multiple | all | Low |
| 22 | "Sync"/"reconnect" jargon in offline banner | — | components/ui/OfflineBanner.tsx:47 | Y2–4 | Low |

**Bottom line:** the product's emotional architecture around failure is unusually good and worth protecting; the debt is concentrated in (1) the total absence of age branching, (2) percentages/XP leaking onto surfaces the quiz result screen deliberately protects, (3) a handful of ops/school-register strings on young-child paths, and (4) unit/name drift that a single terminology pass could clear.
