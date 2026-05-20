# Decipher Learning — Step-by-Step Build Guide
## Gated Phases with Verification Checks & Claude Code Prompts

**North star:** A PWA (Progressive Web App) that a child opens in Safari on iPhone or iPad, adds to their home screen, logs in, and uses as if it were a native app — with no App Store, no download, and full offline support for core learning.

---

## How to Use This Guide

Each phase has:
- **What gets built** — concrete deliverables
- **Gate** — the exact test that must pass before moving to the next phase
- **Verification steps** — how to confirm the gate is met
- **Claude Code prompt** — copy and paste this into Claude Code to start the phase

You do not build everything at once. You finish Phase N, run the verification, then start Phase N+1. Each phase produces something a real child can use.

---

## First-Time Setup (do this once before Phase 0)

### Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Create your project folder
```bash
mkdir decipher-learning
cd decipher-learning
```

### Copy the project bible into the folder
Copy `CLAUDE.md` into `decipher-learning/`. Claude Code reads this automatically every session.

### Start Claude Code
```bash
claude
```

From this point, every prompt below is typed or pasted into Claude Code.

---

## Phase 0 — Project Scaffold & Infrastructure

### What gets built
- Next.js 14 project with App Router, Tailwind, Framer Motion
- Supabase project connected (database, auth, storage, pgvector)
- Prisma schema matching the CLAUDE.md database spec
- Python FastAPI microservice folder structure (no logic yet, just scaffold)
- Environment variables wired up
- Deployed to Vercel with a real URL

### Claude Code prompt
```
Read CLAUDE.md first, then do the following:

1. Scaffold a Next.js 14 App Router project called "decipher-learning" with TypeScript, Tailwind CSS, and Framer Motion installed.

2. Install dependencies: @supabase/supabase-js @supabase/auth-helpers-nextjs prisma @prisma/client idb next-pwa

3. Create prisma/schema.prisma with every table defined in the CLAUDE.md database schema section. Use Supabase as the database provider.

4. Create a services/content-pipeline/ folder with a minimal FastAPI app (main.py with a /health endpoint only). Add a Dockerfile and requirements.txt listing: fastapi uvicorn sympy pint chempy language-tool-python

5. Create public/manifest.json for PWA with: name "Decipher Learning", short_name "Decipher Learning", display "standalone", background_color "#FAFBFF", theme_color "#6C9EFF", icons at 192px and 512px (placeholder icons for now).

6. Add next.config.js with next-pwa configured to cache /learn pages and /api/topics.

7. Create .env.local with placeholder values for all environment variables listed in CLAUDE.md.

8. Create a root layout (app/layout.tsx) that loads Nunito and Inter from Google Fonts and sets the background colour to #FAFBFF.

Do not build any pages or UI yet. Scaffold only.
```

### Gate ✅ — Phase 0 complete when:
- [ ] `npm run dev` starts without errors
- [ ] Prisma schema generates without type errors (`npx prisma generate`)
- [ ] `services/content-pipeline/main.py` runs and `/health` returns `{"status": "ok"}`
- [ ] `public/manifest.json` is valid JSON
- [ ] Vercel deployment URL is live (app shows the Next.js default page)

### Verification commands
```bash
npm run dev                          # should start on localhost:3000
npx prisma validate                  # should pass
cd services/content-pipeline && pip install -r requirements.txt && uvicorn main:app
# GET /health should return 200
```

---

## Phase 1 — Authentication & Year Group Selection

### What gets built
- Login page and register page (email + password)
- Child and parent role selection at registration
- Year group selection screen (child only)
- Parent can add child accounts
- Protected routes: child routes redirect to login if not authenticated
- Basic navigation shell (top bar + sidebar)

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 1: Auth.

Build the following using Supabase Auth and Next.js App Router:

1. app/(auth)/login/page.tsx — email + password form. On success, redirect to /dashboard.

2. app/(auth)/register/page.tsx — email + password + role selection (Child / Parent). For Child accounts, after registration show a year group selection screen (Year 1 through Year 11, displayed as large tap-friendly cards). Store year_group_id in the profiles table.

3. Middleware (middleware.ts) — redirect unauthenticated users to /login if they try to access any (child) or (parent) route.

4. app/(child)/dashboard/page.tsx — placeholder page showing "Welcome, [display_name]" and the three subject cards (Maths, English, Science) using the exact hex colours from CLAUDE.md. Cards are tappable but go to a "coming soon" placeholder for now.

5. A parent registration flow where the parent can enter a child's email to link accounts (writes to family_links table).

6. app/(parent)/dashboard/page.tsx — placeholder showing linked children's names.

7. Top navigation bar component (components/ui/TopBar.tsx) showing: logo "Decipher Learning" on left, streak count + points badge + avatar circle on right. Mobile-first — no items collapse off-screen at 375px.

Use the colour tokens from CLAUDE.md throughout. All forms must work with keyboard on desktop and tap on mobile. Minimum tap target 48px on all interactive elements.
```

### Gate ✅ — Phase 1 complete when:
- [ ] A new child account can register, select year group, and reach the dashboard
- [ ] A parent can register and link a child account
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Dashboard renders correctly at 375px width (no horizontal scroll)
- [ ] Subject cards show the correct colours (#6C9EFF, #FF8FAB, #52D9A0)

### Verification steps
1. Open Chrome DevTools → toggle device toolbar → set to iPhone SE (375×667)
2. Register a child account (Year 7), confirm redirect to dashboard
3. Register a parent account, link the child
4. Open an incognito tab, visit `/dashboard` — confirm redirect to `/login`
5. Run Lighthouse on the dashboard page — PWA section should show manifest detected

---

## Phase 2 — Content Pipeline (Automated, No Human Review)

### What gets built
- Python FastAPI microservice with all 6 pipeline stages
- SymPy maths verifier, Pint physics verifier, ChemPy chemistry verifier, LanguageTool English verifier
- pgvector knowledge base with initial curriculum documents ingested
- RAG generation (Stage 1) using Claude API
- Multi-model consensus (Stage 3), constitutional check (Stage 4), deduplication (Stage 5)
- Confidence scoring and auto-publish (Stage 6)
- API endpoint to trigger content generation for a topic
- Deployed to Railway

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 2: Content Pipeline.

Build the Python FastAPI microservice at services/content-pipeline/ with these components:

1. verifiers/maths.py
   - verify_arithmetic(expression: str, claimed_answer: str) -> dict
     Uses Python eval() with regex whitelist for safe arithmetic
   - verify_symbolic(question_text: str, claimed_answer: str) -> dict
     Uses SymPy to parse, solve, and confirm algebraic answers
   Both return {"verified": bool, "computed_answer": str, "error": str|None}

2. verifiers/physics.py
   - PHYSICS_FORMULAE dict with F=ma, V=IR, KE=½mv², wave speed, density, pressure, work, power, efficiency
   - verify_physics(formula_key: str, values: dict, claimed_answer: str, unit: str) -> dict
     Uses pint UnitRegistry for dimensional analysis

3. verifiers/chemistry.py
   - PERIODIC_TABLE dict (all 118 elements: symbol, atomic_number, mass, group, period)
   - verify_element_fact(element: str, property: str, claimed: str) -> dict — pure lookup
   - verify_equation_balance(reactants: dict, products: dict) -> dict — uses ChemPy

4. verifiers/english.py
   - verify_grammar(text: str) -> dict — uses language_tool_python (en-GB)
   - Returns {"verified": bool, "errors": list, "corrected": str}

5. pipeline.py — orchestrates all 6 stages:
   Stage 1: RAG generation — call Claude API with retrieved curriculum chunks injected as context. Output must be JSON: {question, correct_answer, distractors[3], hint_1, hint_2, hint_3, explanation, source_chunk_ids}
   Stage 2: Route to appropriate verifier(s) based on subject + question_type
   Stage 3: Consensus check — second Claude call at temperature=0.0
   Stage 4: Constitutional check — third Claude call against the 10 content rules in CLAUDE.md
   Stage 5: Semantic deduplication — embed question, cosine similarity vs existing questions in Supabase pgvector
   Stage 6: Confidence score (weights: stage2=60pts, stage3=25pts, stage4=10pts per violation, stage5=20pts)
   Circuit breaker: max 5 attempts per question, log and skip if all fail

6. main.py routes:
   POST /generate — accepts {topic_id, tier, count} — runs pipeline, saves passing questions to Supabase
   POST /ingest — accepts {source_name, text, subject, year_group} — chunks, embeds, stores in curriculum_chunks
   GET /health
   GET /stats — returns counts of published/staged/flagged questions per topic

Deploy with Dockerfile. Add PIPELINE_SERVICE_URL to Vercel environment.
```

### Gate ✅ — Phase 2 complete when:
- [ ] `POST /generate` with a Year 3 Maths topic produces at least 1 published question
- [ ] SymPy verifier correctly rejects a wrong maths answer (test: `2+2=5`)
- [ ] SymPy verifier correctly accepts a right answer (test: `2x=10 → x=5`)
- [ ] Periodic table lookup returns correct atomic number for Carbon (6)
- [ ] ChemPy correctly balances H₂ + O₂ → H₂O
- [ ] `/stats` shows questions with status "published"
- [ ] Pipeline logs show all 6 stages running per question

### Verification commands
```bash
# Test maths verifier
curl -X POST http://localhost:8000/verify/maths \
  -d '{"expression": "2*x=10", "claimed_answer": "5"}'
# Should return {"verified": true}

# Test wrong answer rejection
curl -X POST http://localhost:8000/verify/maths \
  -d '{"expression": "2+2", "claimed_answer": "5"}'
# Should return {"verified": false}

# Generate 5 questions for a Year 3 Maths topic
curl -X POST http://localhost:8000/generate \
  -d '{"topic_id": "<id>", "tier": "sprout", "count": 5}'
# Should return 5 questions, each with confidence_score >= 60
```

---

## Phase 3 — Core Learning Loop

### What gets built
- Learn section (topic explanation + worked examples)
- Practice game (one game type: Fill-in-the-blank)
- Quiz with hints, lives (3 hearts), and points
- Points engine (correct answer, hint costs, perfect bonus)
- Streak tracking (daily login)
- Topic completion (pass at 70%)
- Spaced repetition scheduling (SM-2) after topic completion

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 3: Core Learning Loop.

Build the three-step topic flow at app/(child)/topics/[topicId]/:

1. app/(child)/topics/[topicId]/learn/page.tsx
   - Fetches learn_content for the topic from Supabase
   - Renders body_html safely (sanitised with DOMPurify)
   - Shows worked examples (from examples_json — array of {step, explanation} objects)
   - "Start Practising" button at bottom → navigates to /practise
   - On first visit, awards +5 points and updates topic_progress to "in_progress"

2. app/(child)/topics/[topicId]/practise/page.tsx
   - Renders a fill-in-the-blank game (game_type = "fill_blank" from practice_games table)
   - config_json contains: {sentences: [{text: "The capital of France is ___", answer: "Paris"}]}
   - Tap an underlined blank → keyboard appears → type answer → submit
   - Score 0–100 based on correct answers. Award points: Math.round(score / 2)
   - "Take the Quiz" button on completion

3. app/(child)/topics/[topicId]/quiz/page.tsx — this is the most important component
   - Load 10 questions for the topic (mix of tiers based on the child's current tier)
   - HeartsDisplay component: 3 red heart icons at top. 3 consecutive wrong answers = lose 1 heart. 0 hearts = quiz ends, show retry screen.
   - For each question:
     a. Show question text
     b. Show 4 options (correct + 3 distractors, shuffled)
     c. On tap: immediate visual feedback (green flash + sound for correct, red shake for wrong)
     d. HintButton: shows hint_1 on first tap (−3 pts), hint_2 on second (−3 pts), hint_3 on third (−3 pts). Show hint in a slide-in card.
     e. StudyBuddy component (bottom right): small character that reacts to correct/wrong/hint events
   - On quiz complete: calculate score (correct/10). If ≥70%: topic passes. If <70%: show weak questions, offer retry.
   - On pass: award +25 bonus points. Update topic_progress (status=completed, last_score, completed_at). Run SM-2 algorithm from lib/sm2.ts to set sr_next_review.

4. lib/sm2.ts — implement the SM-2 function from CLAUDE.md verbatim.

5. lib/points.ts — pointsForAnswer(wasCorrect, hintsUsed, allHeartsIntact) → number

6. lib/adaptive.ts — getNextQuestionTier(rollingAccuracy, currentTier) from CLAUDE.md spec.

7. API routes:
   - POST /api/quiz/submit — saves quiz_attempt and individual quiz_answers, calculates and saves point_events, updates topic_progress, runs SM-2, returns result
   - GET /api/topics/[topicId]/questions — returns questions appropriate for the child's tier

All animations via Framer Motion. Correct answer: green scale-up + confetti burst. Wrong: red shake. Heart lost: heart turns grey with a crack animation. Quiz passed: full-screen celebration modal.
```

### Gate ✅ — Phase 3 complete when:
- [ ] A child can complete the full Learn → Practise → Quiz flow on one topic
- [ ] Correct answers award points; hints deduct points correctly
- [ ] Losing 3 consecutive wrong answers removes a heart
- [ ] Scoring ≥70% marks the topic complete and schedules an SM-2 review date
- [ ] Scoring <70% shows the retry screen
- [ ] All animations play on an iPhone SE viewport (test in Chrome DevTools)
- [ ] Points total updates on the dashboard after completing a quiz

### Verification steps
1. Complete a quiz with 10/10 correct, no hints → check points_events in Supabase (should be: 10×10 + 25 bonus = 125)
2. Complete a quiz using hint on every question → check points_events (should be lower)
3. Get 3 wrong answers in a row → confirm heart count drops to 2
4. Get 0/10 → confirm retry screen appears (topic_progress should still be "in_progress")
5. Check topic_progress in Supabase after passing → `sr_next_review` should be set 1 day ahead

---

## Phase 4 — World Map & Gamification

### What gets built
- World map with zone illustrations and topic nodes
- Topic nodes: locked / in-progress / completed states
- Zone unlock animation when all zone topics complete
- Discovery Cards: rarity logic, drop after quiz, card album
- Badge system: topic badge, perfect score badge, streak badge
- Streak Shields (earned items)

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 4: World Map & Gamification.

1. app/(child)/world-map/page.tsx
   - Fetch zones and world_map_nodes for the child's year group
   - Render an SVG or absolutely-positioned div layout (not a game engine) showing:
     a. A background illustration per zone (use Supabase Storage URLs)
     b. Topic nodes as circular buttons at x_pos/y_pos coordinates
     c. Connecting path lines between nodes
     d. Node states: locked (grey, padlock icon), available (subject colour, pulsing ring), completed (gold checkmark)
   - Tapping an available node navigates to /topics/[id]/learn
   - Tapping a locked node shows a tooltip: "Complete [previous topic] to unlock"
   - When all topics in a zone complete: play a zone-unlock Framer Motion animation (zone illustration glows, a "Zone Guardian awakens!" banner slides in)
   - Mobile-first: the map scrolls vertically on phones, fills the screen on iPad

2. components/cards/DiscoveryCard.tsx
   - Beautiful card component: illustration on top half, rarity badge, title, fact text
   - Rarity colours: Common=#C8E6C9, Uncommon=#B3E5FC, Rare=#E1BEE7, Epic=#FFE0B2, Legendary=#FFF9C4 with gold border

3. components/cards/CardReveal.tsx
   - Full-screen modal triggered after quiz completion
   - Animated card flip (Framer Motion rotateY 0→180→360)
   - "You found a [Rarity] card!" heading
   - Shows the card content after flip completes
   - "Add to Collection" button

4. Drop logic in POST /api/quiz/submit:
   - After a passing quiz, run: const roll = Math.random(); determine rarity by cumulative probability (Common 0.40, Uncommon 0.65, Rare 0.80, Epic 0.90, Legendary 1.0)
   - Pick a random card of that rarity for the topic's subject/year_group from card_catalog
   - Insert into child_collection. Return card data in the quiz submit response.
   - CardReveal modal is shown client-side when the response contains a card

5. app/(child)/collection/page.tsx
   - Grid of all cards in card_catalog for the child's year group
   - Collected cards: show full card. Uncollected: show silhouette + rarity badge + "???" title
   - Progress bar: "X / Y cards collected"
   - Filter tabs: All / Maths / English / Science / Legendary

6. Badge system:
   - badges table seeded with: Topic Star (complete any topic), Perfect Score (100% no hints), Subject Champion (all topics in one subject), Streak 7 (7-day streak), Guardian Slayer (defeat a Zone Guardian)
   - POST /api/badges/check — called after every quiz submit, evaluates all badge trigger_rules against the child's current stats. Awards any newly earned badges.
   - BadgePopup component: badge icon spins in from the top of the screen, stays 3 seconds, fades out

7. Streak Shields:
   - streak_shields table: profile_id, quantity
   - Awarded: +1 shield on 7-day streak, +1 on Daily Mystery Challenge completion
   - Spent: child can tap a heart about to be lost and spend a shield to save it (shown as a glowing shield option on the heart display)
```

### Gate ✅ — Phase 4 complete when:
- [ ] World map renders for Year 3 and Year 7 with correct zone layout
- [ ] Completing a topic unlocks the next node with an animation
- [ ] A Discovery Card appears after every completed quiz (correct rarity distribution over 20 tests)
- [ ] Card album shows silhouettes for uncollected cards
- [ ] At least 3 badge types trigger and display correctly
- [ ] Streak counter increments on consecutive-day logins

### Verification steps
1. Complete all topics in one zone → confirm zone-unlock animation plays
2. Run quiz completion 20 times via test script → check card rarity distribution (roughly 40% common, 10% legendary)
3. Log in on two consecutive days → confirm streak = 2
4. Achieve 100% quiz with no hints → confirm "Perfect Score" badge awarded

---

## Phase 5 — Boss Battle & Daily Challenge

### What gets built
- Zone Guardian boss battle (full cinematic quiz experience)
- Daily Mystery Challenge (cron job + dashboard card)
- Spaced repetition UI ("Time to revisit" dashboard cards)
- Secret Bonus Room (unlocked by 100% no-hint quiz)

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 5: Boss Battle & Daily Challenge.

1. app/(child)/guardian/[zoneId]/page.tsx — Zone Guardian battle
   - Cinematic intro: full-screen dark overlay, boss illustration slides in, boss name in dramatic font, "The Crystal Guardian awaits..." text, 3-second countdown then quiz starts
   - 15-question quiz drawing from all topics in the zone (random selection)
   - BossHealthBar component: horizontal bar that depletes by 1/15 on each correct answer (Framer Motion width animation)
   - Same hearts/hints system as normal quiz
   - On all 15 correct: Victory screen — boss shatters (CSS animation), "ZONE CLEARED!" banner, guaranteed Legendary card reveal
   - On hearts depleted: "The Guardian escapes..." screen with retry button (no penalty)
   - Guardian becomes available again if child wants to replay (for Legendary card farming)
   - Trigger: Guardian battle button appears on world map only when all zone topics are completed

2. Daily Mystery Challenge system:
   - Supabase pg_cron job runs at midnight UK time (Europe/London): selects 3 random questions from across the full question pool for the child's year group. 10% of days: selects harder cross-tier questions ("Knowledge Flare").
   - Stores in a daily_challenges table: {date, year_group_id, question_ids[3], is_flare}
   - DailyChallenge card on dashboard: "Today's Mystery Challenge" with a ? icon, countdown to midnight reset
   - app/(child)/daily-challenge/page.tsx: 3-question mini-quiz, no hints, 60-second total timer
   - On completion: award Streak Shield (normal) or Rare card + double points (Flare)
   - daily_challenge_completions table tracks which children completed today's challenge

3. Spaced repetition UI:
   - Dashboard section "Time to revisit" — queries topic_progress WHERE sr_next_review <= today AND status = 'completed'
   - Shows up to 3 cards, each with topic name, subject colour, "5 min review" label
   - Tapping starts a 5-question mini-quiz (random subset from the topic's question pool)
   - On completion, re-runs SM-2 algorithm and updates sr_next_review

4. Secret Bonus Room:
   - Triggered when quiz_attempt has score=1.0 AND hints_used=0
   - POST /api/quiz/submit returns {bonusRoomUnlocked: true} in this case
   - app/(child)/bonus-room/[topicId]/page.tsx: a single harder question (Lightning tier) presented as a "Hidden Chamber" with atmospheric styling
   - Correct answer: Epic card reward. Wrong answer: "The chamber closes" — no retry on the same attempt (available again next time they get 100% no-hint)

5. Production anomaly detection cron (Supabase pg_cron, runs nightly):
   - Query quiz_answers: flag questions where attempts >= 20 AND error_rate > 0.60 → set status='flagged' in quiz_questions
   - Query quiz_answers: flag questions where attempts >= 15 AND hint3_rate > 0.50 → set status='flagged'
   - Flagged questions are excluded from new quiz sessions and queued for pipeline regeneration (POST /pipeline/regenerate-flagged called by the cron)
```

### Gate ✅ — Phase 5 complete when:
- [ ] Guardian battle triggers after all zone topics complete
- [ ] Boss health bar depletes with each correct answer
- [ ] Legendary card is awarded on Guardian victory
- [ ] Daily challenge appears on dashboard every day (test by advancing the date in pg_cron)
- [ ] SM-2 review cards appear on dashboard 1 day after topic completion
- [ ] Bonus Room triggers on 100% no-hint quiz and awards an Epic card
- [ ] Anomaly detection cron runs without errors (check Supabase logs)

---

## Phase 6 — Customisation & Social

### What gets built
- Avatar builder (character + accessories + colour)
- Theme picker (5 colour themes)
- Study buddy selector
- Leaderboard (weekly + all-time, year-group filtered)
- My Mission board (player-led goals)
- Full collection with Fusion cards and silhouettes

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 6: Customisation & Social.

1. app/(child)/customise/page.tsx
   - AvatarBuilder: grid of base characters (8 options — fox, panda, robot, unicorn, dragon, rocket, butterfly, star). Once selected, show colour picker (8 Tailwind bg colours for the character accent). Store selection in profiles.avatar_config JSONB.
   - ThemePicker: 5 circular swatches (Sunshine #FFD43B, Ocean #74C0FC, Berry #CC5DE8, Forest #52D9A0, Midnight #748FFC). Selected theme stored in profiles.theme_name. Apply globally via CSS variable --theme-accent on the root element.
   - BuddySelector: 4 options (fox, owl, frog, dolphin). Store in profiles.study_buddy.
   - All changes save to Supabase in real time (no submit button — auto-save on selection).

2. app/(child)/leaderboard/page.tsx
   - Weekly tab (points earned this Mon–Sun) and All-Time tab
   - Toggle: "My Year Group" / "All Years"
   - Each row: rank, avatar emoji, display_name, year group tag, points
   - Highlight the current child's row (blue background)
   - Animated rank changes on page load (rows slide into position with staggered delay)
   - Under-13 privacy: display_name only, never email or real name

3. app/(child)/missions/page.tsx
   - "My Mission Board" — 3 mission slots
   - MissionPicker modal: child selects a mission type from a list:
     * "Master [topic] at Lightning tier"
     * "Reach leaderboard position [X]"
     * "Collect [X] Legendary cards"
     * "Complete [subject] zone"
     * "Maintain a [X]-day streak"
   - Progress bar per active mission (calculated from live data)
   - Completing a self-chosen mission: "Self-Starter" badge + 2× points bonus
   - Save to child_missions table

4. Fusion Cards (extend collection system):
   - Add 10 Fusion cards to card_catalog (is_fusion=true, required_subject_ids=['maths','science'] etc.)
   - Fusion cards can only drop after completing a quiz in a subject where the child has also completed at least one Lightning-tier topic in a second subject
   - Show fusion cards in collection with a special dual-subject badge icon
   - POST /api/badges/check also checks for "Lightning in 2+ subjects" → triggers fusion card eligibility

5. Update world map to show Fusion Challenge nodes (appear between zones once 2+ zones complete):
   - app/(child)/fusion-challenge/[challengeId]/page.tsx: single cross-subject question, no hints, unique Fusion card reward
   - fusion_challenges table seeded with 5 challenges per year group
```

### Gate ✅ — Phase 6 complete when:
- [ ] Theme change applies instantly across the entire app
- [ ] Avatar selection persists after logout and re-login
- [ ] Leaderboard correctly shows weekly vs all-time scores
- [ ] Mission progress bar updates after completing relevant actions
- [ ] Fusion challenge appears after completing 2 zones

---

## Phase 7 — PWA, Mobile Polish & Offline

### What gets built
- Full PWA compliance (Lighthouse ≥ 90)
- Offline quiz queue (IndexedDB)
- Foundation Mode for Year 1–2
- Accessibility settings (dyslexia font, colour-blind mode, reduce motion)
- Mobile and iPad layout polish pass

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 7: PWA, Mobile Polish & Offline.

1. Complete PWA setup:
   - Ensure public/manifest.json has all required fields for iOS/Android install
   - next-pwa service worker must cache: all /learn pages, all /practise pages, topic data from Supabase, game assets in /public
   - Add <meta name="apple-mobile-web-app-capable" content="yes"> and <meta name="apple-mobile-web-app-status-bar-style" content="default"> to layout.tsx for iOS home screen behaviour
   - Run Lighthouse PWA audit and fix any issues until score ≥ 90

2. Offline queue (lib/offline.ts):
   - openDB from idb: create "edu-offline" database with "pending-answers" store
   - submitAnswer(payload): if navigator.onLine → POST /api/quiz/submit directly. If offline → add to pending-answers store, return {queued: true}
   - window.addEventListener('online', syncQueue): drain pending-answers store, POST each to /api/quiz/submit in order, delete on success
   - Show an "Offline mode" banner (amber) when navigator.onLine is false
   - Show a "Syncing..." spinner briefly when coming back online

3. Foundation Mode (Year 1–2):
   - If child.year_group is Year 1 or Year 2, set isFoundationMode = true in a React context
   - In Foundation Mode:
     a. All question text is read aloud automatically using Web Speech API (en-GB, rate 0.85, pitch 1.1) when the question appears
     b. Quiz answer options render as large image cards (use foundation_images JSONB from quiz_questions — 4 image URLs) instead of text buttons. Images are 140×140px minimum.
     c. All tap targets are minimum 64×64px
     d. A speaker icon button on every text block lets child replay the audio
   - Foundation Mode toggle is also available in accessibility settings for older children with reading difficulties

4. Accessibility settings (add to customise page):
   - DyslexiaFont toggle: loads OpenDyslexic from CDN, applies to all body text via CSS variable --font-body
   - ColourBlind mode dropdown (None / Deuteranopia / Protanopia): swaps --color-correct and --color-incorrect to blue/orange
   - ReduceMotion toggle: sets prefers-reduced-motion: reduce on a wrapper div (Framer Motion respects this natively)
   - LargerText toggle: applies font-size: 1.25em to root
   - ExtendedTime toggle: multiplies all quiz timers by 2
   - Settings stored in profiles.accessibility_settings JSONB

5. Mobile layout audit — fix all of the following:
   - No element causes horizontal scroll at 375px (iPhone SE) or 768px (iPad)
   - World map is scrollable vertically at 375px, side-by-side layout at 768px+
   - Quiz options are always at least 48px tall and full-width on mobile
   - Bottom navigation bar on mobile (Home, World Map, Collection, Profile) — sticky at bottom
   - Top navigation bar hides the sidebar on mobile, shows hamburger menu instead
   - All modals are max-width 100% on mobile, max-width 480px centred on desktop
```

### Gate ✅ — Phase 7 complete when:
- [ ] Lighthouse PWA score ≥ 90 on both the dashboard and quiz pages
- [ ] App can be added to iPhone home screen via Safari ("Add to Home Screen" prompt)
- [ ] App installs to iPad home screen and launches in standalone mode (no browser chrome)
- [ ] Complete a quiz while offline → quiz completes → go online → score appears in Supabase
- [ ] No horizontal scroll at 375px on any page
- [ ] Foundation Mode reads questions aloud on Year 1/2 accounts
- [ ] Dyslexia font toggle applies across the whole app

### Verification steps (test on a real iPhone and iPad)
```
iPhone test:
1. Open Safari → navigate to your Vercel URL
2. Tap share button → "Add to Home Screen" → confirm it appears on home screen
3. Open from home screen → confirm it launches without browser address bar
4. Enable Airplane mode → complete a quiz → re-enable internet → confirm score syncs

iPad test:
1. Same install process in Safari
2. Rotate to landscape → confirm layout adapts (two-column topic grid)
3. Run Lighthouse in Chrome DevTools → PWA score ≥ 90
```

---

## Phase 8 — Content Population

### What gets built
- Year 3 and Year 7 full content: all topics across Maths, English, Science
- All 3 tiers (Sprout / Explorer / Lightning) for each topic
- Minimum 15 questions per topic per tier (45 questions per topic, ~450+ questions total per year group)
- Curriculum knowledge base fully ingested (National Curriculum docs, BBC Bitesize)
- Discovery Card catalog: 100+ cards with illustrations
- Zone Guardian quizzes seeded
- Daily challenge pool seeded (30 days of challenges pre-generated)

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 8: Content Population.

1. Create a seed script (scripts/seed-knowledge-base.ts) that:
   - Fetches these public URLs and chunks them into 500-token segments:
     * https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study
     * https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study
     * https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study
   - Embeds each chunk using OpenAI text-embedding-ada-002
   - Inserts into curriculum_chunks table with subject and year_group tags
   Run with: npx tsx scripts/seed-knowledge-base.ts

2. Create scripts/seed-topics.ts that inserts all topics for Year 3 and Year 7 from CLAUDE.md section 5 into the topics table, associated with the correct subject and year_group.

3. Create scripts/generate-content.ts that:
   - For each topic in Year 3 and Year 7
   - For each tier (sprout, explorer, lightning)
   - Calls POST /pipeline/generate with count=15
   - Logs pass rate per topic/tier
   - Target: ≥12 published questions per topic/tier (pipeline circuit breaker may reject some)
   Run with: npx tsx scripts/generate-content.ts
   This script will take approximately 2-3 hours to run. Run it overnight.

4. Create scripts/seed-cards.ts that inserts 120 Discovery Cards into card_catalog:
   - 40 Common, 25 Uncommon, 20 Rare, 20 Epic, 15 Legendary
   - Distributed across Maths, English, Science for Year 3 and Year 7
   - Each card has: title, fact_text (genuinely fascinating real fact), source_url, rarity
   - Use the pipeline /generate endpoint to generate cards with constitutional check for age-appropriateness and fact verification via RAG
   - Illustration URLs can be placeholder SVGs for now (real illustrations in Phase 2)

5. Create scripts/seed-daily-challenges.ts that pre-generates 30 days of daily challenges and inserts them into daily_challenges table.

6. Seed Zone Guardian quizzes (one per zone) in guardian_quizzes table.

After running all scripts, verify:
- SELECT COUNT(*) FROM quiz_questions WHERE status = 'published' GROUP BY topic_id, tier
  → Every topic/tier combination should have ≥ 12 published questions
- SELECT COUNT(*) FROM card_catalog → Should be ≥ 100
- SELECT COUNT(*) FROM daily_challenges → Should be ≥ 30
```

### Gate ✅ — Phase 8 complete when:
- [ ] Every Year 3 and Year 7 topic has ≥ 12 published questions at each tier
- [ ] 100+ Discovery Cards in the catalog
- [ ] 30 days of daily challenges pre-generated
- [ ] All Zone Guardians have quiz data
- [ ] A child can navigate the full world map without hitting any "no questions found" errors

---

## Phase 9 — Parent Dashboard & Safeguarding

### What gets built
- Parent progress dashboard (per child summary)
- Weak areas analysis
- Screen time controls
- GDPR / safeguarding controls

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 9: Parent Dashboard & Safeguarding.

1. app/(parent)/dashboard/page.tsx — upgrade from placeholder to:
   - Child switcher (tabs for each linked child)
   - Per child: total points, current streak, topics completed this week, subjects started
   - WeakAreas component: queries quiz_answers for this child, groups by topic, shows topics where hint3_rate > 0.3 or error_rate > 0.5. Displays as: "Layla may need more practice with: Angles in Parallel Lines (used hints on 4/5 attempts)"
   - Recent activity feed: last 5 topics attempted with scores

2. app/(parent)/children/[childId]/page.tsx — detailed view:
   - Full topic progress table (subject / topic / tier reached / last score / last attempt date)
   - Discovery card collection summary
   - Badge list
   - Screen time this week (chart: hours per day for last 7 days)

3. Parent controls (app/(parent)/settings/[childId]/page.tsx):
   - Daily time limit slider (15 min to 3 hours, in 15-min increments)
   - Allowed time window (start time + end time pickers)
   - Leaderboard visibility toggle
   - Social features toggle (head-to-head challenges — Phase 2 only)
   - Notification preferences

4. Screen time enforcement (middleware + client):
   - API route GET /api/child/time-today returns total active minutes today for the authenticated child
   - Client hook useScreenTime polls this every 60 seconds
   - At limit - 5 minutes: TopBar shows "5 minutes left today" amber badge
   - At limit: full-page "Great learning today! Come back tomorrow" screen. Learn sections remain accessible (no time limit on reading). Quiz and games are blocked.
   - Server-side check in POST /api/quiz/submit: if child is over limit, reject with 403.

5. GDPR / safeguarding:
   - app/(parent)/account/page.tsx: "Delete all my children's data" button → calls DELETE /api/parent/delete-child-data/[childId] → deletes all rows in profiles, topic_progress, quiz_attempts, quiz_answers, child_collection, profile_badges, point_events for that profile
   - Under-13 flag on profiles: if year_group is Year 1–7 (age < 13), set is_under_13=true. Under-13 children: display_name only on leaderboard, no head-to-head challenges without parent approval.
   - All passwords hashed by Supabase Auth (bcrypt). No plaintext credentials anywhere.
```

### Gate ✅ — Phase 9 complete when:
- [ ] Parent can see each child's weak areas with specific topic/hint data
- [ ] Screen time limit blocks quiz access when exceeded (Learn sections still accessible)
- [ ] Data deletion removes all child data from every table
- [ ] Under-13 children show display_name only on leaderboard (not real name or email)

---

## Phase 10 — Family Pilot & Monitoring

### What gets built
- Live deployment with real family accounts
- Anomaly detection running nightly
- Pipeline regeneration for flagged questions
- Feedback monitoring

### Claude Code prompt
```
Read CLAUDE.md. We are on Phase 10: Family Pilot.

1. Create a monitoring dashboard at app/(admin)/dashboard/page.tsx (admin role only):
   - Questions flagged by anomaly detection (status='flagged')
   - Pipeline success/failure rates per topic
   - Daily active children count
   - Questions in each status: published / staged / flagged / regenerating
   - "Regenerate all flagged" button → calls POST /pipeline/regenerate-flagged

2. Ensure the nightly cron jobs are active in Supabase:
   - Anomaly detection (flag high error rate + high hint-3 rate questions)
   - Spaced repetition reminder notifications (push notification or in-app badge) for children with sr_next_review = today
   - Daily challenge rotation at midnight UK time

3. Create app/(child)/settings/page.tsx with:
   - Display name edit
   - Avatar edit (links to /customise)
   - Accessibility settings
   - "Report a problem" button on any quiz question that sends question_id + child's description to a problems table for admin review (this is the only human-in-the-loop feature, but admin review is optional not mandatory)

4. Seed two real test accounts: one Year 3, one Year 7. Confirm:
   - Both can navigate the entire app
   - Both hit at least one Zone Guardian
   - Both receive daily challenges
   - Both trigger spaced repetition cards after 24 hours
```

### Gate ✅ — Phase 10 complete when:
- [ ] Both children can use the app independently for one full week
- [ ] At least 50 quiz attempts completed with no pipeline-related errors
- [ ] Anomaly detection has run at least 3 nights with clean logs
- [ ] No question with a verified-wrong answer has reached the children
- [ ] App installs correctly on both an iPhone and an iPad

---

## Summary: The Gate Chain

```
Phase 0: Scaffold & infra live     → Vercel URL exists
    ↓
Phase 1: Auth working              → Child can log in on mobile
    ↓
Phase 2: Pipeline verified         → Code engines reject wrong answers
    ↓
Phase 3: Core loop complete        → Child completes Learn → Practise → Quiz
    ↓
Phase 4: World map & gamification  → Child earns cards, badges, sees map
    ↓
Phase 5: Boss battle & daily hook  → Daily logins driven by challenge + guardian
    ↓
Phase 6: Customisation & social    → Child has identity; leaderboard live
    ↓
Phase 7: PWA & mobile ✅           → Installs on iPhone/iPad, works offline
    ↓
Phase 8: Content populated         → 900+ questions across Y3 and Y7
    ↓
Phase 9: Parent controls           → Screen time, GDPR, weak areas
    ↓
Phase 10: Family pilot             → Real children, real feedback, live monitoring
```

---

## Answer: Can You Just Drop the Document into Claude Code?

**Almost — but there is one extra step.** Here is exactly what to do:

1. Copy `CLAUDE.md` into the root of your project folder (e.g., `decipher-learning/CLAUDE.md`)
2. Open Terminal on your Mac
3. Run: `cd decipher-learning && claude`
4. Claude Code automatically reads `CLAUDE.md` on startup — it becomes Claude Code's permanent context for the project
5. Paste the Phase 0 prompt above and press Enter

You do **not** drop `EduPlatform_Plan.md`, `EduPlatform_Upgrade_Plan.md`, or this build guide into Claude Code. Those are for you. `CLAUDE.md` is the only file Claude Code needs — it is the compressed, actionable version of everything in the plan documents.

Each session with Claude Code starts by it re-reading `CLAUDE.md`, so you can close and reopen Claude Code at any time without losing context. When you finish a phase and move to the next, just paste the next phase's prompt.

**One session = one phase.** Do not try to do multiple phases in a single session. Each phase has a gate. Do not move on until the gate tests pass.

---

*Build guide v1.0, May 2026.*
