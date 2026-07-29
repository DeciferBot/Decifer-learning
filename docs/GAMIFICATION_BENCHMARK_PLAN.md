# Why Decifer feels boring next to Duolingo: a UX and feedback-loop review

*Written 2026-07-29. Screen-by-screen findings come from reading the actual component
code this session. Usage numbers come from the production database. Benchmark claims
about Duolingo are cited to their sources at the end and were not independently verified.*

---

## 1. Bottom line

The complaint is right, and the cause is not a missing feature. It is three habits of
design that run through every screen:

**We show the child a menu. Duolingo shows the child a path.**
Our home screen stacks up to 16 blocks and roughly 19 tappable destinations on a 375 px
phone. Duolingo opens on one path with one glowing button. A child who has to choose
what to do has already been given work to do before any learning starts.

**We show the child a report card. Duolingo never shows a mark.**
Every topic card in our curriculum map shows a percentage, a coloured status ring, and
below 70% a red border, a red warning triangle and the words "try again". That is a
school report rendered in pastel. Duolingo shows no score anywhere, ever. It shows how
far along the path you are.

**We give feedback during the session and then throw it away.**
This is the big one, and I had it wrong in my first pass. The quiz *does* already tick
points up live, flash "+8pts" above the counter, run a 3-in-a-row hintless combo worth a
bonus, mark a double-points Bonus Challenge and celebrate the halfway mark. That work is
all there. But none of it is banked until the child presses submit and clears 70%. Below
that mark they get a grey refresh icon and no card. Six times out of ten, on our real
data, every good moment in that session is deleted.

So the app is not short of game. It is short of **keeping** the game. A child gets a
lovely 4 minutes and then, more often than not, is told it did not count.

**What I would change first:** make the session end in a win almost every time, and make
the home screen open on one thing. Everything else is polish on top.

---

## 2. Walking the child journey, screen by screen

### 2.1 The home screen: a menu, not a destination

[app/dashboard/child/page.tsx](../app/dashboard/child/page.tsx) renders, top to bottom:

streak ping · new parent link notice · name and stats header · parent-assigned focus
topics · first-time welcome · "your card is waiting" hero · suggested next topic ·
time to revisit · daily mystery challenge · subject-breadth nudge · Explore ·
world map · my cards · missions · leaderboard · customise · reward vault ·
the full curriculum map · streak notification opt-in.

That is 14 labelled sections plus two notices, and inside the quick-links and activities
grids there are five more tiles. Every one is a reasonable idea. Together they are a
choose-your-own-adventure that a nine-year-old has to parse before doing anything.

Duolingo's home screen has one interactive element that matters: the next lesson bubble.
Everything else is a small icon in a bar.

**The cost:** decision load lands on the child at exactly the moment their motivation is
lowest, which is before they have started. And nothing on our screen looks obviously more
important than anything else, because eight of those blocks are gradient cards with an
arrow.

### 2.2 The curriculum map: a spreadsheet with scores

[components/child/ChildCurriculumMap.tsx](../components/child/ChildCurriculumMap.tsx)
gives every topic a card with:

- a percentage score, shown to the child
- a status ring: grey not started, blue in progress, gold "Excelled!", green "Passed",
  and **red border, red warning triangle, red "try again"** for anything under 70%
- **three buttons on every card**: Learn, Practise, Quiz

A child scrolling their year sees a grid of marks, some of them red. This is the single
most demotivating surface in the product, and it is the one that fills the most screen.

Duolingo's equivalent is a winding path of circles. Locked ones are grey, the current one
pulses, finished ones are gold. No number, no red, no judgement, one button.

**The three buttons matter too.** Learn, Practise, Quiz on every card means the child must
decide the right pedagogical order for themselves, on every topic, forever. That is a
teacher's decision that we have handed to a child.

### 2.3 Inside the quiz: better than I expected, but nothing sticks

Verified in [components/quiz/QuizShell.tsx](../components/quiz/QuizShell.tsx), this
already exists and is good:

| Already built | Where |
|---|---|
| Live points counter that ticks up | line 967 |
| "+8pts" flashing up and fading | lines 953 to 964 |
| 3-in-a-row hintless combo, +5 bonus, banner | lines 357 to 363 |
| Bonus Challenge question at double points | lines 336 to 337 |
| Halfway celebration | line 369 |
| Per-question progress bar | lines 999 to 1010 |
| Automatic hints after a wrong try, plus a technique tip | lines 1050 to 1090 |
| Warm wrong-answer copy: "Not quite. Here's a hint. Try again!" | line 1105 |
| Question slide transitions | Framer Motion, line 1008 |

That is a genuinely well-made quiz screen. Which makes the ending worse, not better.

**What is missing, verified by grep across `app/`, `lib/` and `components/`:**

- **No sound.** No `new Audio`, no `AudioContext`, no `.mp3` or `.wav` anywhere in the
  child loop. The only audio in the product is the Explore narration player. Every correct
  answer in Decifer is silent. Duolingo's correct-answer chime is possibly the most
  recognisable sound in consumer education software.
- **No haptics.** No `navigator.vibrate` anywhere.

Sound and vibration are how a phone game says "yes, that was you, well done" without using
words. We say it only in text, and text is what school already looks like.

### 2.4 The ending: where the whole thing falls over

On a pass the child gets a trophy or star, points, a Discovery Card reveal, possibly a
badge popup, possibly an unlock celebration. That is a good moment.

On a fail, which our data says is 6 times in 10, the child gets:

- a grey `RefreshCw` icon
- "You got 4 right" or, at zero, "This one is tricky"
- "3 more and this topic is finished. Your points are saved and we have kept your progress."
- no card
- no badge
- and back on the map, that topic now shows a red ring and "try again"

The copy is kind and carefully written. It does not matter. A child reads the grey icon
and the red ring, not the sentence. And the combo they hit at question 3, the double-points
bonus question they nailed, the halfway celebration, all of it evaporates.

**This is the feedback loop that needs fixing before anything else.**

---

## 3. The numbers behind it

Read from production on 2026-07-29.

| Metric | Value |
|---|---|
| Quiz attempts, all time | 99 |
| **Pass rate (≥ 70%)** | **39.4%** |
| Average score | 59.3% |
| Average session length | 228 s (3.8 min) |
| Attempts that ran out of hearts | **0 of 99** |
| Best streak anyone ever reached | 4 days |
| Push notification subscribers | **0** |
| Attempts in the last 7 days | 0 |

Per child, with the retention column next to it:

| Child | Attempts | Pass rate | Lifespan |
|---|---|---|---|
| Aaina | 37 | 49% | 29 days |
| Arth | 29 | **24%** | 30 days |
| Zion | 17 | 29% | 8 days |
| Joanna | 12 | 67% | 2 days |
| Bilal | 3 | 33% | 5 days |
| Abir | 1 | 0% | 0 days |

Duolingo deliberately calibrates lessons to roughly an **80% success rate**, on the
principle that people are more motivated by experiencing success than failure. We are at
39%. Arth failed roughly three quarters of everything he ever tried here, then stopped.

Two more things the data settles:

**Hearts are decorative.** Zero of 99 attempts ever ran out of them. They add visible
threat and no actual stakes, and they take up header space on a 375 px screen.

**The pass mark is the wall, not the questions.** Average score 59% against a 70% bar.
Children are getting most of it right and still being shown red.

> **Caveat, stated honestly:** these scores were recorded under the older scoring logic.
> Commit `b146300` changed scoring to per-question rather than per-answer-row, which should
> raise scores. Nobody has played since it shipped, so the current pass rate is unmeasured.
> It moves the number the right way. It does not fix the all-or-nothing ending.

---

## 4. What Duolingo actually does differently

Not the feature list. The five design decisions underneath it.

1. **One next action, always.** The path has exactly one live node. No choosing.
2. **No marks, ever.** Progress is position on a path, not a percentage.
3. **The lesson is short and nearly always won.** About 2 minutes, calibrated to ~80%
   success, so the default emotional outcome is a win.
4. **A mistake is a detour inside the lesson, not a verdict at the end.** Get it wrong and
   the item comes back later in the same lesson. You still finish. You still win.
5. **Every activity pays.** XP comes from everything, not only the one real lesson.

And around the loop: streaks with **two freezes** (their own testing found freezes raise
retention rather than softening it, because they remove the dread without removing the
stake), and weekly leagues, which raised lesson completion by **25%** when introduced.
Users with 7-day-plus streaks retain at **2.4x** the rate of those who never build one.

Where we are genuinely ahead: 54 Discovery Cards with five rarities, a Reward Vault with
real prizes a parent approves, 329 curriculum topics with code-verified answers, and IRT
difficulty calibration. Duolingo has nothing like the Vault. We should be leaning on it far
harder than we do, and instead it is the fourteenth block down the home screen.

---

## 5. The plan

Four phases, in order. Phase 1 is the one that matters. Each has a gate you can check.

### Phase 1: make the session end in a win (the core fix)

**1.1 Bank points as they are earned.**
The live counter already exists. Make it real by writing each correct answer to the server
as it happens, so a child who stops at question 6 keeps what they earned. Today it is a
number on screen that disappears.
*Files:* [app/api/quiz/submit/route.ts](../app/api/quiz/submit/route.ts),
[components/quiz/QuizShell.tsx](../components/quiz/QuizShell.tsx), plus a per-answer
checkpoint write. A `checkpoint` route already exists at
[app/api/quiz/checkpoint/](../app/api/quiz/checkpoint/) and can carry this.

**1.2 Two rounds of 5 instead of one block of 10.**
Round one ends with a real result, points banked and a "keep going" button. This halves the
distance to the first payoff, doubles the number of win moments per topic, and brings
session length toward the two-minute benchmark. `selectQuizQuestions` already takes a
`count` option, so the selection side is a parameter change.
*Files:* QuizShell, [lib/adaptive.ts](../lib/adaptive.ts)

**1.3 Turn a fail into a fix-up round.**
Below 70%, do not show the grey retry screen. Re-serve only the missed questions as a short
round. Clear those and the topic completes. This is Duolingo's mistake handling, and the
mistake-selection code path already exists at [lib/adaptive.ts:500](../lib/adaptive.ts).
*Files:* QuizShell, quiz submit

**1.4 Never let a child leave empty-handed.**
A Common Discovery Card for finishing a round, with the rare ladder still earned by
passing. This is the smallest change on the list and probably the most felt.
*Files:* [lib/cards.ts](../lib/cards.ts), quiz submit

**1.5 Remove hearts from ordinary quizzes.**
Zero of 99 attempts ever ran out. Keep them for Zone Guardian boss fights where the threat
is the point, and give the header space back.
*Files:* QuizShell, [components/quiz/HeartsDisplay.tsx](../components/quiz/HeartsDisplay.tsx)

**Gate:** replay the 99 historical attempts through the new logic. Pass rate at or above
70%, and every attempt with at least one correct answer ends with points banked and a card.

---

### Phase 2: one path, no marks

**2.1 Rebuild the home screen around a single next action.**
One hero: the next thing to do, with the child's name on it and one button. Streak, points
and cards become a thin stat strip at the top. Everything else, which is currently eight
gradient cards, moves behind the existing bottom tab bar (Home, Map, Collection, Profile).
Daily Challenge and Explore become tabs or a single rotating slot, not permanent blocks.

**2.2 Take the percentages and the red off the child's map.**
Replace the score, the red ring and the "try again" triangle with path states: locked,
current, done, mastered. Keep every number for the parent dashboard, where it belongs and
where it is genuinely useful.
*Files:* [components/child/ChildCurriculumMap.tsx](../components/child/ChildCurriculumMap.tsx)

**2.3 One button per topic, not three.**
The app should decide whether this child needs Learn, Practise or Quiz next, and offer that.
Keep the other two behind a small "more" affordance. We already have the progress data to
make that call.

**Gate:** a child lands on Home and the single most important action is unmistakable within
two seconds at 375 px. No percentage and no red appears anywhere in the child UI.

---

### Phase 3: make it feel like a game, not a form

**3.1 Sound.** Correct, incorrect, combo, round complete, card reveal. Short and warm.
Mute toggle stored in `profiles.accessibility_settings`, which already exists, and honour
`prefers-reduced-motion`.

**3.2 Haptics.** `navigator.vibrate` on correct and on card reveal. Works on Android and
installed PWAs; iOS Safari ignores it harmlessly.

**3.3 Make the win bigger.** The combo, the halfway moment and the bonus question already
exist but are all small text banners. Give the pass screen a real celebration: card burst,
confetti, the counter racing up.

**3.4 Promote the Reward Vault.** This is our best asset and Duolingo has no answer to it.
Real prizes a parent approves should be visible progress in the child's header, not the
fourteenth block down the page.

**Gate:** a five-question round is playable end to end with sound, haptics and a real win
animation at 375 px, with mute and reduced-motion fully honoured and the Lighthouse PWA
score unchanged.

---

### Phase 4: make coming back automatic

**4.1 Fix the push opt-in trap.** The notification prompt currently only appears at
`streak >= 2` ([app/dashboard/child/page.tsx:547](../app/dashboard/child/page.tsx)). You
need a streak to be offered the thing that protects your streak. There are **0 rows** in
`push_subscriptions`, so the nightly 18:00 streak-nudge cron has never had anyone to notify.
Offer it after the first completed round instead.

**4.2 Prove the nudge actually delivers.** Send one to a real device. It has never been
confirmed end to end.
*File:* [app/api/cron/streak-nudge/route.ts](../app/api/cron/streak-nudge/route.ts)

**4.3 Build a real streak freeze.** "Streak Shield" is a misnomer today: it absorbs a heart
loss inside a quiz and does nothing for the streak. Add a genuine freeze, two held at a
time, auto-applied on a missed day, earned by playing.

**4.4 Lower the daily bar.** One five-question round, about 90 seconds, keeps the streak
alive. The implicit bar today is a whole topic quiz, and the best streak anyone has managed
is 4 days.

**4.5 Ship Decifer Blitz.** The live head-to-head quiz is built and sitting on PR #23,
undeployed. Playing against a sibling in real time is the closest thing we have to what
makes Kahoot and Blooket fun, and it is finished work on a shelf.

**Gate:** a test child gets a real push on a real device, a missed day with a freeze in hand
keeps the streak, and one child reaches a 7-day streak. Nobody ever has.

---

## 6. What I would not do

**Do not add more badges, cards or mission types.** Five badges and 54 cards exist and the
children have collected 47 cards and 10 badges between them over a year. The catalogue is
not the constraint.

**Do not add another home screen block.** Every new idea has been solved by adding a card
to the child's home, and that is precisely the problem.

**Do not just lower the 70% pass mark.** It fakes success without changing the experience.
Phase 1 raises real success by paying for real work and by bringing missed questions back
inside the session.

---

## 7. Sizing

| Phase | Rough size | Why this order |
|---|---|---|
| 1, session ends in a win | 3 to 5 days | The root cause. Everything compounds off it |
| 2, one path no marks | 4 to 6 days | Biggest visible change; needs design decisions |
| 3, feel | 2 to 3 days | Cheap, and it is what "like Duolingo" actually means |
| 4, come back | 3 to 4 days | Worth little until 1 to 3 make returning worth it |

Relative sizes from reading the code, not estimates validated by building anything.

---

## 8. The caveat that matters

All of this assumes children open the app. Right now they are not: zero attempts in the
last 7 days, one in the last 30, and the last session on record was 20 July. Better UX will
hold onto a child who arrives. It will not by itself bring one back after five weeks away.
Phase 4 is the closest thing here to a re-engagement answer, and even that needs a child who
has opted in. Getting children back through their parents is a separate piece of work.

---

**Sources for the benchmark section:**
[Duolingo gamification case study (trophy.so)](https://trophy.so/blog/duolingo-gamification-case-study) ·
[Duolingo gamification explained (StriveCloud)](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo) ·
[Behind the product: Duolingo streaks, Jackson Shuttleworth](https://www.getrecall.ai/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team) ·
[Streaks and daily retention (Deconstructor of Fun)](https://duolingo.deconstructoroffun.com/mechanics/streaks) ·
[Lessons from Duolingo, success rate and motivation](https://fleadbeater.wordpress.com/2025/07/10/lessons-from-duolingo/) ·
[Duolingo efficacy studies](https://www.duolingo.com/efficacy/studies)
