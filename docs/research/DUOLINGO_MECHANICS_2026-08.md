# Duolingo Ecosystem Research — Raw Input for the 2026 Product Roadmap

> Compiled 2026-08-18 from public sources (URLs at end). Raw research input for
> `docs/PRODUCT_ROADMAP_2026.md`. Claims verified across two sources where possible;
> single-source figures are marked. Some primary pages were blocked by the research
> environment's egress proxy; those claims were cross-checked via search-index
> summaries and are marked directional.

## 1. Main app engagement system

**Scale (for context):** Q2 2026: 58.7M DAU (+23% YoY), ~12.7M paid subscribers (+17% YoY), revenue $298.5M/quarter. DAU grew ~4.5x over the four years after 2018's growth turnaround (Jorge Mazal, ex-CPO, on Lenny's Newsletter).

**Path/home design.** In Nov 2022 Duolingo replaced its branching "tree" with a single linear path — one node at a time, no choice of what to do next. Von Ahn's stated reason: simplify, and make the "correct" next action unambiguous for new users. Trade-off acknowledged by community: less learner agency, more guided progression. Each unit ends in a review/boss-style node; "legendary" (see failure handling) sits on top of completed nodes. Relevance: Decifer's world-map with sequential unlocks is already this pattern.

**Streaks.** The core retention engine. Key mechanics:
- Daily streak counts any completed lesson (any subject — Math/Music/Chess lessons all keep one shared streak; a deliberate cross-sell design).
- **Streak Freeze:** 200 gems each; free users equip up to 2 at once; at 100 days you join "Streak Society" (perks incl. 3 bonus freezes, up to 5 equipped). Super subscribers get a free Monthly Streak Repair (restore a streak lost in the last 48h).
- **Stats:** 600+ experiments run on the streak system in ~4 years; a single copy change ("streak saver" reframing) drove ~10,000 incremental DAU (Jackson Shuttleworth, Group PM Retention, Lenny's Podcast). 9M+ users hold a 365+ day streak (Mazal); >50% of daily learners have a 7+ day streak (sqmagazine, single source). One teardown headline claims streaks drive ~2x daily retention (Deconstructor of Fun — directional).
- **Widget:** iOS home-screen streak widget (streak state + a Duo mood that escalates as the day runs out). Third-party summaries report ~60% increase in "user commitment" (secondary sources only — treat as approximate).
- **Milestone share cards** designed as premium social artifacts; trophy.so claims 5–10x organic sharing increase and ~6M daily streak shares (single source).

**Notifications.** Timing model: best send time is 23.5 hours after the last session (users learn at the same time daily; slightly earlier each day). Famous copy experiment: "Hi, it's Duo. These reminders don't seem to be working. We'll stop sending them for now." — a guilt/smart-pause message that measurably re-activates lapsed users and doubles as notification hygiene. Bandit algorithms pick per-user template/copy. Copy changes alone produced ~5% conversion lifts.

**Leagues.** 10 weekly tiers: Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Amethyst → Pearl → Obsidian → Diamond, plus a 15-person Diamond Tournament. Cohorts of 30 users matched by tier and by *when in the week they first earned XP* (keeps cohorts fair and active). Promotion bands shrink with tier; bottom ~24th–30th demoted. Impact when launched (Mazal): total learning time +17%; users doing 1h/day, 5 days/week **tripled**. DoF headline: +25% lesson completion (unverified against primary). Known pathology: leagues reward XP volume, not learning quality — grinding easy content wins.

**Economy: gems, energy/hearts.**
- **Gems** earned from chests/quests/level-ups; spent on Streak Freezes (200), Heart/Energy refills (~350–650 depending on version), timer boosts, outfit items. League Repair 2,000 gems (duoplanet, single source). Design principle: currency only matters if spending hurts.
- **Hearts → Energy (2025):** Hearts (5, lose 1 per mistake, regen ~1/5h) are being replaced by **Energy**: 25 units, 1 spent per *question answered* (right or wrong), refilled by correct-answer streaks in-lesson, ads, gems, practice, or waiting. Free users get roughly 2–3 lessons/day before the wall. Rationale: hearts punished mistakes (bad for learning psychology); energy meters *sessions* instead. **Important: Duolingo itself concluded punishing errors directly is the wrong lever for learners.**

**Quests and chests (variable rewards).** 3 Daily Quests/day (e.g. "earn 30 XP", "get 5 in a row correct"), each opening a chest; completing all three opens a bonus chest. Chests tier bronze/silver/gold (~5/10/15 gems, gold may contain an XP Boost — duoplanet, single source). Monthly quest with a badge. **Friend Quests**: co-op XP goal with one friend on a deadline. XP Boosts (1.5x/2x/3x, usually 10–15 min) are handed out with deliberately variable durations and timing — a classic variable-ratio reward schedule. "Early Bird / Night Owl" chest chains reward returning in a specific time window.

**Friend Streaks.** Launched Feb 2025: a separate shared streak with up to 5 friends; each person needs one lesson/day to keep it. Duolingo's stated motivation: 57% of users have ≥1 in-app friend; social accountability is the strongest habit anchor after the personal streak.

**Characters/mascot.** Duo (owl) plus a fixed human cast — Lily (deadpan teen, most popular), Zari, Oscar, Junior, Bea, Eddy, Lin, Falstaff, Lucy, Vikram — with consistent personalities, distinct TTS voices, and in-lesson reactions (characters animate/react to correct and wrong answers, appear in exercises and speech bubbles). Duo's "menacing/guilt-trip" persona is an official marketing asset. Characters give the app parasocial stickiness and make notifications feel personal rather than corporate.

**Sound design.** Reward sounds are short (analyses cite <1.5s), distinctive, and consistent: correct-answer chime, lesson-complete fanfare, gem pop. Treated as "punctuation" — instant feedback with no cognitive load. (Third-party analyses; no primary Duolingo audio-design writeup found.)

**Failure handling.** Every mistake is logged to a per-user mistakes inventory; missed questions are re-queued at the end of the same session (you must clear them to finish); Practice Hub offers Mistakes Review (Super feature) and personalized practice. **Legendary** level: an optional, harder, no-hints challenge layer per unit awarding a trophy — failure-tolerant prestige content. Combined with streak freezes and energy-not-hearts, the philosophy: protect the habit, never make failure feel terminal, sell recovery items.

**Difficulty/session calibration.** Birdbrain (logistic-regression, IRT-like learner-ability × exercise-difficulty model, second version) predicts per-exercise success probability; the session generator assembles lessons to keep learners in an "optimal challenge zone". (The oft-quoted "~80% target success rate" appears only in secondary teardowns — treat the number as folklore, the mechanism as confirmed.) Lessons are ~2–5 minutes, introduce only 5–7 new items each, embed new material in otherwise-familiar content, and use fading hints. Decifer's IRT calibration is the same family of machinery as Birdbrain.

## 2. The sub-apps

**Duolingo Math.** Standalone iOS app Oct 2022; merged into the main app Nov 30, 2023. Two tracks: Elementary (roughly ages 7–12; multiplication, fractions, measurement, time) and Advanced/"brain training" for adults. Interaction types are the interesting part: **finger-drawn answers with handwriting recognition**, drag-and-drop equation parts, matching pairs, a draggable virtual ruler, manipulable analog clocks that *shade elapsed time* to visually highlight the concept, fraction-block manipulatives, tap-to-count objects. Minimal reading load; answers are visual/gestural, not typed sentences. Von Ahn's stated motive: math-anxiety reduction; also that math has a much larger addressable market than any single language. Lesson design follows the "Duolingo Method" whitepaper (implicit learning through varied, sequenced interactive exercises with visual highlighting — no video lectures, no long text).

**Duolingo Music.** Launched Oct 2023, folded into the main app from launch window. Teaches note reading, rhythm, pitch, intervals via an on-screen touch keyboard: tap-along play-throughs of familiar songs, pitch matching, pairing notes to audio, completing sequences, staff-reading drills. Same gamified shell. Signal: performance-style skills can be taught with tap-based "play along" exercises and instant audio feedback rather than explanation.

**Duolingo Chess.** Beta April 2025 (iOS), full launch June 2025; a course inside the main app. Built explicitly for total beginners, goal "make chess as accessible as possible", targeting a path toward ~1500 Elo. Mix: ~75% puzzle-based lessons (bite-size tactical patterns, first-move guidance from the coach), "mini matches" of a couple of minutes, and full games vs **Oscar**, an existing cast member recast as a sarcastic chess coach whose strength adapts to the learner. **Game Review** (late 2025): automated post-game analysis highlighting up to 9 key moments across categories (brilliant moves, mistakes/blunders, "moves worth celebrating"), narrated by Oscar — and it awards XP for doing the review, i.e. reviewing your failures is itself a rewarded activity. Signals for Decifer: (a) a beloved character as subject-specific coach; (b) puzzle-first teaching of a "performance" skill; (c) making post-mortem review a first-class, rewarded loop — directly applicable to quiz review/Zone Guardian retries.

**Duolingo ABC.** Separate free app, ages 3–8 (PreK–Grade 2), 700+ lessons; phonics-centred curriculum (letter-sound pairs as the lesson unit), sight words, vocabulary, comprehension, original illustrated stories. UI differences vs main app: essentially **zero reading required to navigate**; audio instructions everywhere; answers are pictures, taps, traces, and speech, not text; large targets; lessons ≤5 minutes; 9 entry levels so parents can place a child; no ads, no IAP, no social features. Notable mechanics: **letter tracing with "guardrail" mode → "freehand" mode, auto-dropping back to guardrail after 2 failed freehand attempts** (a clean model for scaffolded failure); speech-recognition read-aloud exercises; drag-and-drop word building. Common Sense Media rates it highly for both learning and privacy.

## 3. How Duolingo handles age

- **Under-13 in the main app:** signup age-gate (self-declared); under-13 users must supply a **parent's email**; account becomes restricted: private profile, **no friends, no chat, no leaderboards/leagues, no ads**; the child is prompted not to use their real name; only the parent/guardian email is stored (COPPA data minimisation; 16 in some jurisdictions per GDPR-K).
- So a free-tier child on the main app loses the entire social layer (leagues, friend streaks, friend quests) — the habit loop for kids rests on streak + quests + path + characters only. **This is a competitive gap Decifer can exploit with its parent-consented, closed-family leaderboard.**
- **Why ABC is a separate app, not a mode:** (1) pre-readers can't operate a text UI at all — the interaction model (audio-first, tracing, picture answers) is incompatible with the main app shell, not a reskin; (2) COPPA is dramatically simpler if the whole app is child-directed; (3) different buyer: ABC is parent-selected, the main app is self-selected. Teens get the standard product — Duolingo's brand/meme marketing deliberately targets them.
- Math sits in between: kid-usable (rated 4+, aimed 7–12) inside the adult app, made safe by the under-13 account restrictions rather than a separate build.

## 4. Monetization

- **Free tier:** ads after lessons (removed for under-13s); Energy 25 units / 1 per question (or legacy 5 hearts / 1 per mistake), refill by waiting, ads, gems, or practice — in practice ~2–3 lessons (~15–20 min) per day; full course content otherwise available.
- **Super Duolingo:** ~US$12.99/mo, ~$60–96/yr (heavy regional pricing — ~$0.66–$8.63/mo equivalents by country). Unlimited energy/hearts, no ads, Mistakes Review/Practice Hub, monthly streak repair, unlimited legendary attempts. **Family Plan**: up to 6 members, ~$119.99/yr (same two-tier logic as Decifer's Per Child vs Family AED plans).
- **Duolingo Max:** $29.99/mo or ~$167.99/yr. Adds AI features: Video Call with Lily, Roleplay scenarios. "Explain My Answer" was moved from Max to free in early 2026.
- **UAE/AED:** no reliable published AED figure found; Duolingo geoprices, so verify in-app from a UAE store account.
- **Upsell mechanics:** "reverse trial" — new users get ~14 days of Super free, so downgrade feels like loss; paywall moments at out-of-energy, post-lesson interstitials, streak milestones, league moments; social-proof experiments ("47,000 people upgraded this week"); "most popular" badges; trial length stated inside the CTA button; efficacy-style claims on paywalls ("learners are X times more likely to stay on track with Super"). Onboarding-to-paid ~9% circulates from one teardown (single source). Company posture in 2026: prioritise DAU growth; conversion follows engagement (~9% of MAU pays).

## 5. Mechanics ranked by likely impact for a UK-curriculum kids app

1. **Streak + equipped Streak Freezes + repair** — Duolingo's single most-tested retention lever (600+ experiments, 9M year-long streaks); Decifer has streaks/shields, but freeze *equipping* and 48h repair as explicit, purchasable-with-points safety nets are missing polish.
2. **Home-screen streak widget** — cheapest high-leverage add for a PWA-on-iPad product (approximate with badge + push urgency states); reported ~60% commitment lift (secondary).
3. **Post-quiz review as a rewarded activity (Chess Game Review pattern)** — "up to 9 highlighted moments + coach commentary + points for reviewing" maps directly onto quiz results and Zone Guardian defeats; turns failure into content.
4. **Character coach with a personality per subject (Oscar pattern)** — Decifer's study buddies could speak, react to answers, and front notifications; characters are what makes Duo's nagging welcome.
5. **Daily quest triad + chest tiers + bonus chest for all three** — light to build on existing point_events/missions; the "complete all 3" bonus chest is the compounding hook.
6. **23.5-hour personalized notification timing + guilt/smart-pause copy** — timing alone beats content; Decifer's re-engagement emails/nudges should anchor to each child's habitual play time.
7. **Timed variable XP boosts (Early Bird / post-session 2x windows)** — creates a second daily session cheaply; fits Decifer's points economy without touching content.
8. **Micro-cohort leagues (30 users, weekly, matched by activation time)** — Duolingo tripled its power users with this; for under-13 comfort, run with pseudonymous avatars or family/school cohorts (Duolingo disables it for kids — an open flank).
9. **Energy-not-hearts session metering** — if Decifer ever meters free play, meter *volume* not *mistakes*; Duolingo's own retreat from hearts is the evidence; aligns with parent screen-time controls.
10. **Guardrail→freehand scaffolded input (ABC tracing) + drawn/dragged answers (Math)** — for KS1/Foundation Mode: picture answers, tracing with auto-fallback after 2 fails, manipulatives with visual highlighting — the proven template for pre-/early readers.

## Sources

- https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- https://investors.duolingo.com/news-releases/news-release-details/duolingo-reports-second-quarter-2026-results
- https://investors.duolingo.com/news-releases/news-release-details/duolingo-unveils-major-product-updates-turn-learning-real-world
- https://blog.duolingo.com/chess-course · https://blog.duolingo.com/chess-game-review/
- https://blog.duolingo.com/product-lessons-friend-streak/ · https://blog.duolingo.com/friend-streak/
- https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/
- https://blog.duolingo.com/right-level-of-difficulty
- https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/ · https://spectrum.ieee.org/duolingo
- https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_duolingo_method_2023.pdf
- https://investors.duolingo.com/news-releases/news-release-details/duolingo-launches-music-and-math-its-flagship-app
- https://techcrunch.com/2021/08/05/duolingo-is-working-on-a-math-app-for-kids/ · https://www.forbes.com/sites/emmawhitford/2022/08/26/language-app-duolingo-wants-to-be-your-kids-math-tutor/
- https://duolingo.fandom.com/wiki/Duolingo_Math · /League · /Energy · /Chest · /Streak
- https://duoplanet.com/duolingo-energy-system/ · /duolingo-chests/ · /duolingo-streak-freeze/ · /duolingo-leagues-the-essential-guide-everything-you-need-to-know/
- https://apps.apple.com/us/app/learn-to-read-duolingo-abc/id1440502568 · https://www.commonsense.org/education/reviews/duolingo-abc-learn-to-read · https://lit-lessons-cdn.duolingo.com/resources/duolingo_abc_scope_and_sequence_english.pdf
- https://privacy.commonsense.org/evaluation/Duolingo-ABC---Learn-to-Read · https://www.internetmatters.org/advice/apps-and-platforms/skills-building/duolingo/ · https://www.bark.us/app-reviews/apps/duolingo-app-review/
- https://uxdesign.cc/how-duolingo-drives-subscription-conversion-89c7415e8fef · https://relaunch.ai/blog/duolingo-onboarding-teardown-7-b-tests-behind-their-9-conver.html · https://geopriced.com/cost/duolingo-super · https://languageappguide.com/pricing/duolingo-cost/
- https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth · https://duolingo.deconstructoroffun.com/
- https://trophy.so/blog/duolingo-gamification-case-study · https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo · https://sqmagazine.co.uk/duolingo-statistics/

**Caveats:** the "~80% success rate" figure and the widget "+60%" number could not be traced to primary Duolingo publications (mechanism confirmed, exact numbers secondary); gem prices/chest contents are fan-wiki sourced; UAE AED pricing needs in-app verification from a UAE store account.
