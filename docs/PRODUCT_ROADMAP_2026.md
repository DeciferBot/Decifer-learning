# Decifer Learning — Product Roadmap, September 2026 → Q1 2027

> Written 2026-08-18. Synthesises three market-research reports and two codebase
> audits produced the same day:
>
> - `docs/research/DUOLINGO_MECHANICS_2026-08.md`
> - `docs/research/COMPETITOR_LANDSCAPE_2026-08.md`
> - `docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md`
> - `docs/audits/CHILD_COPY_AUDIT_2026-08.md`
> - `docs/audits/CONTENT_READABILITY_AUDIT_2026-08.md`
>
> Supersedes the plan section (§5) of `docs/GAMIFICATION_BENCHMARK_PLAN.md`
> (whose Phases 1 and parts of 2–4 have shipped) as the forward plan. The
> diagnosis sections of that doc remain valid and are built on here.

---

## 1. Executive summary

Decifer has shipped a full product (five subjects, Y2–Y11, verified content,
parent dashboard, rewards, PWA) and has essentially no active users: six
children ever, ~99 quiz attempts, none recent. That is not a scaling problem —
it is a pre-product-market-fit problem. The job for the next two quarters is to
prove that a cohort of strangers' children **activates, returns for 30 days,
and refers**, then scale what did it.

The research says the market splits into products children love but that are
shallow (TTRS, Teach Your Monster, Khan Kids) and products that work but that
children hate (Sparx, IXL). The unoccupied position — **full UK curriculum that
children actually choose to open** — is Decifer's to take, and its existing
moats (code-verified answers, five subjects, parent dashboard, real-prize
Vault, closed family social) are the right ones. What is missing is the child
experience quality bar that Duolingo has set on the same iPads: instant
multi-sensory feedback, a character that talks, sessions that end in wins,
rewards you can see coming — and above all, **one product that serves a
6-year-old and a 15-year-old with the same screens today**, which serves
neither.

The audits found the exact debt: zero age-conditional copy or UI anywhere; no
reading-level control anywhere in the content pipeline (a Year 2 and a Year 10
prompt differ only by the year label); the KS1 scaffolding columns
(`foundation_images`, `foundation_audio_url`) written by nothing; practice
games silent; percentages leaking onto seven child surfaces that the quiz
result screen deliberately protects. They also found real strengths to protect:
the failure architecture (banked points, fix-up rounds, "This one is tricky"),
the screen-time stop screen, and a working offline TTS stack that can read
questions aloud with no new infrastructure.

The plan: a two-week **Back-to-School release + pilot cohort launch** (the
school year starting ~1 Sept is the best re-engagement window of the year),
then four releases in sequence — *Feel Like a Game* (activation), *Two
Experiences by Age* (the KS1/KS2 visual layer and the KS3 register), *Come Back
Tomorrow* (retention system), *Play Together* (social + exam-readiness lens).
Every release has a measurable gate. The pilot cohort, not internal opinion,
sequences everything after R1.

---

## 2. Where we are — the evidence

**Stage.** Free beta (no payment step anywhere — `app/pricing/page.tsx`).
Phase 1 of the product is complete per `CLAUDE.md §0`. Production usage as of
2026-07-29 (`docs/GAMIFICATION_BENCHMARK_PLAN.md §3`): 6 children ever, 99 quiz
attempts, 39.4% pass rate under the old scoring, best-ever streak 4 days, 0
push subscribers, 0 attempts in the prior 7 days. The July "session ends in a
win" fixes (PRs #65, #69, #70) and the quiz sound/haptics layer
(`lib/feedback.ts`) shipped after those numbers; their effect is unmeasured
because nobody has played since.

**What already works and must be protected** (copy audit §11):
- Failure architecture: banked points, fix-up rounds, no percentages on quiz
  results, "This one is tricky" at zero score (`components/quiz/QuizShell.tsx`).
- `ScreenTimeRestScreen` — a stop screen that celebrates instead of blocks.
- Verified answers (SymPy/Pint/ChemPy/LanguageTool) — the trust moat no
  competitor in our price band has.
- Admin engagement funnel (`app/dashboard/admin/engagement/page.tsx`):
  activation funnel, WAU, per-child status, automated activation/comeback
  emails already sending.

**The debt, in one paragraph each:**

*Experience debt.* One UI serves ages 6–16. No sentence, control, or register
changes by age anywhere (copy audit §0). The five practice games use Framer
Motion for transitions but never call `fireFeedback` — no sound, no haptics, no
tension. The child's chosen `study_buddy` is picked at signup and rendered
nowhere. Percentages appear on ~7 surfaces (map footer, collection, missions,
guardian victory, speed round, exam results) while QuizShell deliberately bans
them. The Vault shows a red "−XP hint penalty" that punishes the hint use every
other surface encourages.

*Content debt.* The pipeline has no reading-level control: prompts specify the
year only by label; no vocabulary/sentence-length/reading-age instruction
exists; no readability scoring exists anywhere in the repo; learn lessons are
300–500 words for every age and insert straight to `published`, bypassing all
gates; `foundation_images` and `foundation_audio_url` are dead columns
(readability audit, all sections).

*Measurement debt.* No cohort retention curves (D1/D7/D30 — derivable from
`point_events`/`quiz_attempts` timestamps, no new tracking needed), no
per-surface usage, no referral tracking. Stays within CLAUDE.md §15 (own-DB
queries only, no third-party analytics).

*Doc debt.* `CLAUDE.md §0/§11` still list head-to-head live multiplayer as
deferred; Decifer Blitz shipped in July (`app/blitz`, `app/live`,
`components/live/*`). Update on the next CLAUDE.md pass.

---

## 3. What the market taught us (distilled)

Full detail in the three research docs. The load-bearing findings:

1. **The engagement mechanics that matter are few and proven.** Streaks with
   freezes/repair (Duolingo's most-tested lever: 600+ experiments), one-path
   home screens, daily quest triads with chests, character coaches with
   personality (Chess's Oscar), post-game review as a *rewarded* activity
   (Chess Game Review), notification timing anchored to habitual play time
   (23.5h pattern), micro-cohort weekly leagues (tripled Duolingo's power
   users). Duolingo disables its entire social layer for under-13s — our
   parent-consented family social is an open flank.
2. **For young children, remove reading as the interface.** Khan Kids and
   Duolingo ABC are the reference implementations: every instruction narrated,
   picture/tap/trace answers, guardrail→freehand scaffolding, ≤5-minute
   lessons. Duolingo Math teaches concepts through manipulatives (shaded
   clocks, fraction blocks, drawn answers), not sentences.
3. **The hated-product failure modes are precisely documented.** Scores that go
   down (IXL SmartScore), answer-format pedantry (Sparx), upsell inside the
   child experience (Prodigy/FTC complaint), public-elimination-only
   competition (Kahoot anxiety), time-in-app metrics that fight learning
   (Prodigy). These become product principles (§4.4).
4. **The parent is a retention channel, not just a buyer.** Sparx's weekly
   parent emails lift completion ~15%; Doodle's "DoodleAge" age-equivalent
   metric gives parents a number they intuitively trust. Atom proves UAE/UK
   parents pay £40–70/month when positioned as a tutor substitute with exam
   outcomes.
5. **Copy is an engineering surface.** Reading ability per UK year is
   quantified; Spache (Y2–4) and Flesch-Kincaid (Y5+) gates run in code via
   `textstat`; per-band sentence caps and vocabulary rules exist (standards doc
   §6–7). Process praise beats person praise (~30% vs −20% on subsequent
   performance); inflated praise backfires for low-self-esteem children;
   loss-framed streak copy creates measurable anxiety and is restricted by the
   ICO Children's Code (Standard 13) — which a UK-targeted service is in scope
   of. NN/g: children reject content pitched even one school year off their
   level, in both directions.

---

## 4. Strategy

### 4.1 Users and segments

The buyer is the parent (outcomes, safety, visibility, price-vs-tutor); the
user is the child (fun, identity, autonomy). Both funnels must work. The child
side splits into four bands that want different products:

| Band | Ages | What wins them | Their alternative |
|---|---|---|---|
| KS1 / early KS2 (Y2–3) | 6–8 | Visual, audio, tap-first; reading must not be the interface | Duolingo (ABC/Math), Khan Kids, NumBots |
| Core KS2 (Y3–6) | 8–11 | The full game loop: path, buddy, cards, chests, battles | Duolingo Math, Prodigy, TTRS |
| KS3 (Y7–9) | 11–14 | Autonomy, identity, social play, not-babyish register | School tools (Sparx/CENTURY), their phone |
| KS4 (Y10–11) | 14–16 | Outcomes: grades, exam confidence, respect | Tutors, past papers, Sparx |

**One product, initially two experiences:** a *young* experience (KS1 + lower
KS2: visual answers, audio, 8–10-word sentences, playful register) and a
*standard* experience (upper KS2 + KS3: current loop, juiced, register cleaned)
with a KS4 overlay that already part-exists (`StructuredAnswer`, exam
surfaces). The experience a child gets keys off `profiles.year_group_id` —
presentation branching, not content branching (content already keys off year).

### 4.2 Beachhead

**UAE families in British-curriculum schools; core KS2 first, KS1 entry point,
KS3 fast-follow.** Rationale: the acquisition surface already targets them
(Dubai school-choice SEO, AED pricing plumbing, consent flows); KS2 children
respond most to game mechanics; the incumbents there are beatable (Duolingo
Math isn't curriculum-aligned; Prodigy is maths-only; Atom is exam-narrow and
expensive; school tools own homework time, not home time). Positioning: **the
whole-curriculum home complement children choose to open** — school tools drill
what the teacher assigns; Decifer covers all five subjects with verified
answers and real rewards, without homework dread.

### 4.3 Pricing posture

Stay free-beta through the pilot (it is the recruitment pitch). The research
brackets the post-beta decision: D2C engagement apps price at AED 40–60/month;
tutor-substitutes (Atom) sustain AED 190–330/month by selling outcomes and
exam-readiness to the parent. Decifer's listed AED 350/child is tutoring money
and requires tutoring-grade parent-side evidence (age-equivalent progress
metric, exam-readiness lens, weekly outcome emails) before it can hold.
Decision deferred to post-cohort data (§8, open decision 3).

### 4.4 Product principles (from the research; enforced in review)

1. **No persistent number a child owns ever goes down.** (IXL's SmartScore is
   the most-hated mechanic in the dataset. The Vault hint-penalty violates this
   in spirit and goes first.)
2. **No purchase surface, upsell, or gated tease inside the child experience.**
   All commerce parent-side, always. (Prodigy/FTC.)
3. **Verifiers accept every equivalent answer form.** Right answer in an
   unexpected format is right. (Sparx's top hate-driver.)
4. **Failure is a detour, never a verdict.** Protect and extend the existing
   fix-up architecture. Reviewing mistakes is itself rewarded (Chess pattern).
5. **Gain-frame everything; never loss-threaten a child.** Streak copy sells
   safety (shields/freezes), not dread. ICO Children's Code Standard 13
   compliance is a hard constraint on nudge design.
6. **Process praise, specific, never inflated; varied, never static.** (Dweck,
   Brummelman.)
7. **Write every shared surface for the youngest eligible reader; band-branch
   the rest.** Spache/FK gates in CI for child-facing strings and generated
   content.
8. **Reward effort, not just correctness.** Daily goals count work done
   (Doodle/Sparx Reader pattern) so weaker learners can always win the day.
9. **Sound, haptics, and motion on every meaningful tap — all mutable,
   reduced-motion honoured.** (Sesame: immediate audio feedback; existing
   `lib/feedback.ts` conventions.)
10. **Measure learning alongside engagement** (accuracy-weighted progress, not
    raw minutes) so we never optimise time-in-app against the child. (Prodigy's
    trap.)

### 4.5 North star and metric framework

**North star: weekly active learning days per child** (days with ≥1 completed
round — effort-based, gaming-resistant, parent-meaningful).

Supporting funnel (all computable from existing tables; instrumentation gap
closed in R0):

- **Activation:** % of new children whose first session ends in a win
  (completed round + card) within 48h of signup.
- **Retention:** D1/D7/D30 by signup cohort; % of children reaching a 7-day
  streak in their first month (nobody ever has).
- **Depth:** rounds/week; fix-up completion rate; game-vs-quiz usage ratio.
- **Parent:** weekly digest open rate; parent dashboard weekly visits.
- **Referral:** invited-by tracking on signups; Blitz "challenge a friend"
  link conversions.

---

## 5. The roadmap

Sizing is honest engineering guess (one developer + this agent), not a
commitment. Each release ships behind its gate; the cohort's behaviour can
re-order R2–R4.

### R0 — Back to School (Aug 18 – Sep 1, ~2 weeks) · *the window is fixed*

Goal: every returning and newly recruited child lands in a product that knows
the school year just changed, and we can measure what they do.

| # | Item | Detail | Evidence | Size |
|---|---|---|---|---|
| R0.1 | **Year-up moment** | September promotion flow: celebrated "new year, new world unlocked" moment (points/cards/streak explicitly carried; new year's map framed as unlocked, not reset); parent notified. Mechanism exists (`app/api/profile/year-group/route.ts`) but is framed as mistake-fixing; no September experience exists. | Code check 2026-08-18 | 2–3 d |
| R0.2 | **Content readiness audit** | Count published questions per subject × tier for every year; top up thin years via the pipeline before recruits arrive. | Pipeline/coverage tooling exists (`admin/coverage`) | 1 d + pipeline runs |
| R0.3 | **Cohort instrumentation** | D1/D7/D30 cohort queries, per-surface usage, referral attribution; extend `admin/engagement`. Own-DB only (CLAUDE.md §15). | Engagement page audit | 1–2 d |
| R0.4 | **High-severity copy fixes** | Copy debt register items 2–5, 7, 11, 13 + terminology pass (pts/points/XP → one word; round/quiz → one word; one "Home"): kill the Vault hint-penalty callout, fix FillBlank's 1.8s auto-advance, de-jargon the child empty state, gain-frame the consent banner, remove child-facing percentages behind a single presentation rule. | `docs/audits/CHILD_COPY_AUDIT_2026-08.md` §12 | 2–3 d |
| R0.5 | **Pilot recruitment** | 15–25 families via school WhatsApp groups/class parents/SEO traffic; free-beta invite one-pager; founder-run observation sessions with 2 design-partner children (one KS2, one KS3) using a watch-silently protocol. | Strategy §4.2 | founder time |

**Gate:** cohort recruited and instrumented; a promoted child sees the year-up
moment; no child-facing percentage or the hint-penalty remains; observation
notes from both design-partner sessions written up.

### R1 — Feel Like a Game (September, ~2–3 weeks)

Goal: the first session a cohort child plays feels like a game, not a
worksheet. Targets activation.

| # | Item | Detail | Evidence | Size |
|---|---|---|---|---|
| R1.1 | **Juice the five practice games** | Wire `fireFeedback` (sound+haptics) into DragDrop, FillBlank, SpeedRound, NumberLine, EquationBalancer; per-tap micro-animation; SpeedRound tension (ticking under 3s, pulsing timer); combo escalation reusing the existing `combo` cue. | Games audit: zero `fireFeedback` calls in `components/games/**`; Sesame immediate-feedback rule | 3–4 d |
| R1.2 | **Buddy in the loop v1** | Render the chosen `study_buddy` in quiz + games: reaction states (correct/incorrect/combo/idle), hints and technique tips delivered as its speech bubbles, **anticipation lines** ("2 more and this topic is done!") from existing progress state. `profiles.study_buddy` is currently rendered nowhere. | Duolingo character research; Chess coach pattern; copy audit §0 | 4–5 d |
| R1.3 | **Varied process praise** | Praise pools per band per moment (correct/streak-in-round/pass/fix-up-clear), rotating, process-framed, never inflated; replaces static "Correct! Full marks!". | Standards doc §3 (Dweck/Brummelman); copy audit §10 | 1–2 d |
| R1.4 | **Round highlights recap v1** | Result screen gains "your best moments" (longest combo, fastest correct, hardest question beaten — from existing per-answer timing data), shown on passes *and* fails; small points for viewing it (rewarded review, Chess pattern). | Duolingo Chess Game Review; quiz_answers/time data exists | 2–3 d |
| R1.5 | **Daily quest triad + chests** | Three light daily quests on existing missions plumbing (effort-framed, e.g. "finish 1 round / use a fix-up / play a practice game"), chest per quest + bonus chest for all three; replaces percentage-target missions. | Duolingo quests; competitor pattern 1 (effort-based); missions API exists | 3–4 d |

**Gate:** a five-question round at 375px plays end-to-end with sound, buddy
reactions, varied praise and a highlights recap; mute + reduced-motion fully
honoured; Lighthouse PWA ≥ 90 unchanged; cohort activation rate visibly moves
(directional — small n).

### R2 — Two Experiences by Age (October, ~3–4 weeks)

Goal: a 6-year-old can use Decifer unassisted; a 13-year-old isn't embarrassed
by it. The band split (§4.1) becomes real.

| # | Item | Detail | Evidence | Size |
|---|---|---|---|---|
| R2.1 | **KS1/lower-KS2 visual quiz mode** | Picture/symbol answer cards (populate + render `quiz_questions.foundation_images` as tappable options); big type; ≤8–10-word stems; `visual_pattern` question type (pie/bar/shape sequences — SymPy-verifiable, config-driven per CLAUDE.md §16.5); guardrail retry scaffolding (ABC pattern). | Readability audit §7 (dead columns, no picture answers); Duolingo Math/ABC research; standards §6 | 1.5–2 wk |
| R2.2 | **Read-aloud everywhere (young bands)** | Reuse the Explore Piper TTS (`main.py:123` `/tts`, `lib/explore/tts.ts` cache) to narrate question/hints/feedback in quiz + Learn for KS1–lower KS2; warm-walk published KS1 content; finally populate `foundation_audio_url`. No new infrastructure. | Readability audit §7; Khan Kids audio-first spec | 3–5 d |
| R2.3 | **Pipeline readability gates** | Add `textstat` to the pipeline: Spache ≤ band ceiling (Y2–4), FK (Y5+), per-band sentence caps and length ceilings on question/hints/explanation as deterministic Stage-2-adjacent gates (not LLM judgment — per gates.py's own doctrine); per-band language specs written into the generation prompts; bring learn-content generation under the same gates and band the lesson length (Y2 ≠ Y11 ≠ 300–500 words). | Readability audit gaps 1–4, 6–7; standards §1, §6 | 1 wk |
| R2.4 | **KS3+ register pass** | Apply the teen rubric: kill "Awesome!"/coaxing lines at Y7+; age-neutral tier names for older bands; understated data-led feedback; audit against "would a 14-year-old cringe?". | Copy audit worst-for-Y8 list; NN/g teens | 2–3 d |
| R2.5 | **Copy CI gate** | Extract child-facing strings by band; readability + banned-pattern checks (loss-framing, inflated praise, person praise) in CI so the debt never re-accumulates. | Standards §7 rubric | 2–3 d |

**Gate:** a Year 2 design-partner child completes a full visual round
unassisted (observed); generated Y2–3 content passes Spache gates ≥95% first
pass; zero rubric violations in CI on child surfaces; a Y8 walkthrough
produces no cringe flags from a real Y8.

### R3 — Come Back Tomorrow (November, ~3–4 weeks)

Goal: the habit system. Targets D7/D30 and the first-ever 7-day streaks.

| # | Item | Detail | Evidence | Size |
|---|---|---|---|---|
| R3.1 | **Path-as-home** | Child home becomes the winding path (built on `zones` + `world_map_nodes`): one glowing next node, mixed node types (learn/practice/quiz/boss), chest nodes visible ahead, buddy idling on the page, next zone teased-but-locked, daily challenge as a stamped corner slot; stat strip thin; everything else behind the tab bar. Resolves the two-Homes debt. | Duolingo path research; GAMIFICATION_BENCHMARK_PLAN §2.1–2.3; schema ready | 2–3 wk |
| R3.2 | **Streak system done properly** | True streak freezes (earned, equipped up to 2, auto-apply on a missed day — the existing "shield" only absorbs heart loss), 48h repair, gain-framed copy throughout, daily bar = one ~2-min round (already true — say it everywhere). | Duolingo streak research (600+ experiments); Children's Code framing rules | 3–4 d |
| R3.3 | **Notifications that arrive at the right time** | Push opt-in offered after the first *win* (not at streak ≥2 — the current trap: you need a streak to be offered streak protection); nudges anchored to each child's habitual play hour (23.5h pattern) via existing crons; verify end-to-end delivery on a real device (never done). | GAMIFICATION_BENCHMARK_PLAN §4.1–4.2; Duolingo timing research | 3–4 d |
| R3.4 | **Weekly parent email upgrade** | Specific, completion-framed weekly digest (what they did, what they mastered, one suggested focus) + an age-equivalent progress metric on the parent dashboard (DoodleAge pattern) — parents get a number they trust that is never shown to the child. | Sparx +15% completion; Doodle research | 4–5 d |

**Gate:** a real device receives a real push; a missed day with a freeze
equipped keeps the streak; ≥1 cohort child reaches a 7-day streak; parent
digest open rate measured.

### R4 — Play Together + Prove It (December – January, ~4 weeks)

Goal: referral loops and the parent-side outcome story. Sequenced last because
social and exam features are worthless without R1–R3 retention.

| # | Item | Detail | Evidence | Size |
|---|---|---|---|---|
| R4.1 | **Family & friends battles** | Team-vs-team over days (aggregate scores so every child's answers count — TTRS Battle of the Bands pattern) on the shipped Blitz/live plumbing; luck moments so the weakest player can win (Blooket); self-paced private mode always available (anti-Kahoot-anxiety). Closed/family-scoped — respects CLAUDE.md's deferred public leaderboard. | Competitor patterns 3, 5-trap; `app/live` exists | 2–3 wk |
| R4.2 | **Second game skin** | One new practice renderer over the existing question bank (e.g. tower-defence: correct answers place/power turrets — "answers as ammunition"), config-driven via `practice_games.config_json`, zero new content cost. | Blooket one-bank-many-skins; Prodigy ammunition pattern | 1.5–2 wk |
| R4.3 | **Guardian battles that feel like battles** | Answers visibly damage the Guardian (health bar, hit animations, buddy commentary) — same engine, staged presentation. | Prodigy pattern; GuardianBattle exists | 4–5 d |
| R4.4 | **Exam-readiness lens (Y4–6)** | Parent-side toggle assembling existing verified content into low-anxiety familiarisation sets (timed-optional), positioned against Atom at a fraction of £40–70/mo; VR/NVR question types are new content work — scope after cohort demand signal. | UAE 11+ research; exam surfaces exist | 1–2 wk (excl. VR/NVR) |

**Gate:** one full family-vs-family battle completes across ≥2 households; ≥1
organic referral attributed; parent-side exam lens used by ≥3 cohort families.

### Later / explicitly not now

Weekly micro-leagues across families (after cohort scale justifies cohorts of
30); Foundation Mode Y1 (full audio-first — R2 builds most of the spec);
Fusion Challenges; A-level; teacher/classroom accounts (a school channel is a
strategy decision, not a feature); home-screen widget parity (limited for
PWAs — approximate with push urgency states and badging).

---

## 6. What we will not do

- **No persistent score that decreases; no visible child-facing percentages.**
  Parent dashboard keeps every number.
- **No commerce, upsell, or member-gated tease in the child experience.**
- **No public leaderboards or open social.** Family/closed cohorts only
  (CLAUDE.md §11 deferred list stands).
- **No loss-framed or return-pressure messaging to children** (ICO Children's
  Code Standard 13).
- **No new badge/card/mission catalogue expansion as an engagement strategy** —
  the catalogue is not the constraint (GAMIFICATION_BENCHMARK_PLAN §6).
- **No third-party analytics** (CLAUDE.md §15) — all measurement from our own
  tables.
- **No lowering of the 70% pass bar** — R1/R2 raise real success instead.

---

## 7. Measurement plan

Weekly cohort review (1 hour, founder + builder): the §4.5 funnel plus
qualitative notes from the two design-partner children. Each review picks at
most one re-ordering of the next release's scope. Pilot pass/fail bar,
set in advance: **≥60% of cohort children active in week 2; ≥25% still active
at D30; ≥1 organic referral; ≥1 seven-day streak.** Miss the bar → the cohort's
drop-off points (instrumented in R0.3) decide what R2/R3 scope changes before
recruiting cohort two. Beat it → recruit cohort two at 3–5× size and start the
pricing test conversation.

---

## 8. Open decisions (founder)

1. **Beachhead confirmation** — UAE British-curriculum, KS2-first (this doc's
   recommendation). Alternative: KS3-first to chase the school-homework
   complement. Changes R2 ordering.
2. **Brand register for teens** — one brand with band-adaptive tone (this
   doc's recommendation) vs a separately-skinned teen mode. Affects R2.4 scope.
3. **Post-beta pricing** — engagement-app band (AED ~60–130/child) vs
   tutor-substitute band (AED 250–350/child, requires the R3.4/R4.4 parent
   outcome story to hold). Decide after cohort D30 data, not before.
4. **Pilot recruitment channel** — school-gate/WhatsApp (founder-led, this
   doc's recommendation for cohort one) vs paid acquisition on the existing SEO
   surface (defensible for cohort two).
