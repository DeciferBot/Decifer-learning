# Decifer Learning — Claude Code Project Bible (v2)

> Single source of truth for Claude Code. Read at the start of every session.
> Supersedes v1 and all sibling planning docs (`EduPlatform_Upgrade_Plan.md`, `EduPlatform_Benchmark_Analysis.md`, `EduPlatform_BuildGuide.md`).
> Where this file conflicts with those, **this file wins**.

---

## 1. Project identity

- **Product name:** Decifer Learning
- **Folder name:** `decifer-learning/`
- **Form factor:** Progressive Web App (PWA) — installable on iPhone / iPad via Safari "Add to Home Screen". No native app.
- **Curriculum:** UK National Curriculum.
- **MVP audience:** Two children — son (Year 3) and daughter (Year 7). Family pilot.
- **Post-pilot:** Community subscription rollout.

> Old names `edu-platform` and `sproutlearn` are deprecated. They must not appear in code, folders, manifests, copy, or commit messages.

---

## 2. North star

A child opens Safari on their iPad, taps "Add to Home Screen", and the next day taps the app icon, logs in, fights a Zone Guardian boss, earns a Discovery Card, and tells a friend about it.

---

## 3. MVP scope

**In scope (Phase 0–12):**
- Year 3 (KS2) and Year 7 (KS3) only.
- Subjects: **Maths first**, then English, then Science.
- Core child loop: Learn → Practise → Quiz, with points, hints, lives, streaks, Discovery Cards, simple world map, Zone Guardian.
- Parent dashboard with weak-area insight and screen-time controls.
- Fully automated content pipeline for the three MVP subjects.
- PWA install + offline Learn/Practise + IndexedDB quiz queue.
- Family-pilot monitoring with nightly anomaly detection.

**Explicitly out of MVP — Phase 2 or later (see §11):**
- Year 1–2 Foundation Mode
- Year 10–11 GCSE past paper engine
- Year 12–13 A-level long-answer mode
- Head-to-head live challenges (Supabase Realtime)
- Cross-subject Fusion Challenges + Fusion Cards
- Teacher accounts / classroom mode
- Public community rollout
- Stripe subscriptions
- Admin CMS UI (the pipeline IS the CMS)

---

## 4. Non-negotiable constraints

1. **No human moderation queue.** Content quality is enforced by the automated pipeline. The only allowed human step is a **one-time manual spot-check of the seed batch** before the family pilot starts; no ongoing review workflow is built.
2. **Computations verified by code, not LLM.** SymPy for maths, Pint for physics, ChemPy + local periodic-table lookup for chemistry, LanguageTool for English grammar. **LLMs generate, critique, and explain — they never produce the canonical answer.**
3. **Mobile-first.** Every screen is designed at 375 px (iPhone SE) first, then scales up. No horizontal scroll at 375 px.
4. **Minimum tap target 48 × 48 px.** No hover-only interactions. No right-click menus.
5. **PWA compliant.** Service worker, `manifest.json`, offline Learn/Practise. Lighthouse PWA score ≥ 90 on dashboard + quiz before pilot.
6. **No hardcoded content.** All topics, questions, hints, games, cards, and zones live in the database. Adding new content requires zero code changes.
7. **Only `status='published'` content is ever shown to children.** `staged`, `flagged`, and `regenerating` are admin/test only. See §8.

---

## 5. Tech stack (do not deviate)

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Database | Supabase PostgreSQL + pgvector |
| Auth | Supabase Auth (manages `auth.users` — **do not create a parallel custom users table**) |
| Storage | Supabase Storage |
| ORM | Prisma |
| Realtime (Phase 2) | Supabase Realtime |
| Scheduling | Supabase `pg_cron` |
| Frontend hosting | Vercel |
| Computation service | Python FastAPI microservice |
| Computation hosting | Google Cloud Run |
| Maths verifier | SymPy + safe-eval arithmetic |
| Physics verifier | Pint (units) + SymPy |
| Chemistry verifier | ChemPy + local periodic table |
| English grammar verifier | LanguageTool (`en-GB`) |
| Embeddings | OpenAI `text-embedding-ada-002` (or local `sentence-transformers`) |
| Content generation / critique | Anthropic Claude (latest Sonnet for generation; `temperature=0` for consensus; structured prompts for constitutional critique) |
| PWA | `next-pwa` |
| Offline queue | IndexedDB via `idb` |
| Fonts | Nunito (headings), Inter (body) — Google Fonts |
| Spaced repetition | SM-2 — custom implementation in `lib/sm2.ts` |

---

## 6. Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Prisma / Postgres
DATABASE_URL                  # pooled connection
DIRECT_URL                    # direct connection — required by Prisma when Supabase pooler is in front

# LLM / embeddings
ANTHROPIC_API_KEY             # content generation, consensus, constitutional critique
OPENAI_API_KEY                # embeddings (RAG + dedup). Omit only if a local embedding model is used.

# App + microservice
PIPELINE_SERVICE_URL          # Python FastAPI URL on Cloud Run (worker platform)
NEXT_PUBLIC_APP_URL           # canonical site URL — used for PWA + share links
```

`.env.local` for dev; Vercel project env for prod; GCP Secret Manager for the pipeline service (Cloud Run). **Do not add new env vars without updating this section first.**

---

## 7. Database schema source of truth

The schema below is authoritative. Do not rename tables or fields. Names like `discovery_cards`, `child_cards`, or `practice_game` (singular) from older planning docs are wrong — use what is here.

```sql
-- Supabase Auth manages auth.users. No custom users table.

profiles (id, user_id, display_name, avatar_config JSONB, theme_name,
          year_group_id, role TEXT CHECK(role IN ('child','parent','admin')),
          total_points, streak_days, last_active,
          sr_easiness FLOAT DEFAULT 2.5, dashboard_widgets JSONB,
          study_buddy TEXT, accessibility_settings JSONB)

family_links (parent_user_id, child_user_id)
parent_controls (child_profile_id, daily_time_limit_minutes,
                 allowed_time_start, allowed_time_end,
                 leaderboard_visible, social_features_enabled)

-- Curriculum
year_groups (id, label, key_stage)
subjects (id, name, colour_token)
topics (id, subject_id, year_group_id, title, order_index, is_published, zone_id)
zones (id, year_group_id, subject_id, name, theme, illustration_url,
       guardian_quiz_id)
world_map_nodes (id, zone_id, topic_id, x_pos FLOAT, y_pos FLOAT,
                 unlocked_by_topic_id)

-- Content
learn_content (id, topic_id, body_html, examples_json, foundation_audio_url,
               status TEXT DEFAULT 'staged'
                 CHECK(status IN ('staged','published','flagged','regenerating')))
practice_games (id, topic_id, game_type, config_json)
quiz_questions (id, topic_id,
                tier TEXT CHECK(tier IN ('sprout','explorer','lightning')),
                question_text, question_type,
                correct_answer, distractors JSONB,
                hint_1, hint_2, hint_3, explanation,
                foundation_images JSONB,
                confidence_score FLOAT,
                status TEXT DEFAULT 'staged'
                  CHECK(status IN ('staged','published','flagged','regenerating')),
                source_chunk_ids JSONB, created_at)

-- Gamification
point_events (id, profile_id, amount, reason, created_at)
badges (id, name, icon_url, description, trigger_rule JSONB)
profile_badges (profile_id, badge_id, awarded_at)
streak_shields (profile_id, quantity)

-- Discovery Cards (NOT discovery_cards / child_cards)
card_catalog (id, subject_id, year_group_id, rarity TEXT, title, fact_text,
              illustration_url, source_url, is_seasonal, available_until,
              is_fusion, required_subject_ids JSONB,
              status TEXT DEFAULT 'staged'
                CHECK(status IN ('staged','published','flagged','regenerating')))
child_collection (profile_id, card_id, quantity, first_obtained_at)

-- Progress
topic_progress (id, profile_id, topic_id, status TEXT,
                last_score FLOAT, completed_at,
                sr_repetitions INT DEFAULT 0,
                sr_interval_days INT DEFAULT 1,
                sr_next_review DATE)
quiz_attempts (id, profile_id, topic_id, score FLOAT,
               hints_used INT, time_taken_seconds INT,
               hearts_remaining INT, created_at)
quiz_answers (id, attempt_id, question_id, child_answer TEXT,
              was_correct BOOL, hint_number INT, time_seconds INT)
session_answers (id, profile_id, question_id, was_correct BOOL,
                 tier TEXT, created_at)  -- rolling adaptive window

-- Missions
child_missions (id, profile_id, mission_type, target_topic_id,
                target_tier, target_value, current_value,
                created_at, completed_at)

-- Past papers (Phase 2 only)
past_paper_questions (id, exam_board, subject, year, paper_number,
                      question_number, question_text, question_image_url,
                      marks_available, mark_scheme JSONB, topic_tag TEXT[])

-- RAG knowledge base
curriculum_chunks (id, subject, year_group, source_name,
                   chunk_text, embedding vector(1536))

-- Daily challenge cache
daily_challenges (id, date, year_group_id, question_ids JSONB, is_flare BOOL)
```

**RLS baseline (Phase 2 of the build, not Phase 2 of the product):**
- Profiles readable only by self, linked parent, or admin.
- Reads of `quiz_questions`, `card_catalog`, `learn_content` from child clients are filtered to `status='published'` — enforced both in app code and in RLS policy.
- Writes to gameplay tables (`quiz_attempts`, `quiz_answers`, `point_events`, `child_collection`, `topic_progress`) restricted to the owning profile.

---

## 8. Content status and publishing rules

Every content row (`quiz_questions`, `card_catalog`, `learn_content`) carries a `status`:

| Status | Visible to children? | Meaning |
|---|---|---|
| `staged` | **No** | Passed structure + verification but below the publish threshold, OR awaiting one-time pilot spot-check. Admin/test only. |
| `published` | **Yes** | Cleared all gates. The only state child-facing code may read. |
| `flagged` | **No** | Anomaly detection raised an issue (high error rate, high hint-3 rate, or post-spot-check rejection). |
| `regenerating` | **No** | In the pipeline regeneration loop. |

**Hard rules:**
- Every API route, SQL query, or RPC that returns content to children **MUST** filter `WHERE status = 'published'`. No exceptions.
- The Daily Mystery Challenge selector, world-map question pool, spaced-repetition review pool, and Discovery Card drop logic all read `published` only.
- For the family pilot, a **one-time manual spot-check** of the seed batch is permitted before children use it. The spot-check is performed by toggling `staged → published` (or `staged → flagged`) in admin tools. **No ongoing moderation queue is built.**

**Confidence thresholds — applied in Stage 6:**

| Content type | Publish threshold | Required code verification | Required RAG grounding |
|---|---|---|---|
| Maths (arithmetic, algebra, geometry) | ≥ 85 | SymPy / safe-eval `verified=true` | — |
| Science calculations (physics) | ≥ 85 | Pint + SymPy `verified=true` | — |
| Chemistry equations / element facts | ≥ 85 | ChemPy or periodic-table `verified=true` | — |
| English grammar | ≥ 85 | LanguageTool clean **and** consensus pass | — |
| English comprehension | ≥ 90 | — | `source_chunk_ids` non-empty |
| English literary analysis | ≥ 90 | — | `source_chunk_ids` non-empty |
| Biology factual | ≥ 90 | — | `source_chunk_ids` non-empty |
| Other open factual science | ≥ 90 | — | `source_chunk_ids` non-empty |

Anything below threshold stays `staged` or routes to `regenerating`. **Nothing auto-publishes that misses its threshold.**

---

## 9. Automated content pipeline

Lives at `services/content-pipeline/` (Python FastAPI on Google Cloud Run). Six stages per generated item, in order:

1. **RAG generation** — Retrieve top-5 chunks from `curriculum_chunks` filtered by `subject + year_group`, inject as the only allowed factual source. Claude returns strict JSON: `{question, correct_answer, distractors[3], hint_1..3, explanation, source_chunk_ids[]}`. Reject if `source_chunk_ids` is empty for content types that require grounding (see §8).
2. **Code verification** — Route by `question_type`:
   - `maths_arithmetic` → safe-eval whitelist
   - `maths_algebra` / `maths_geometry` → SymPy
   - `science_physics_calculation` → Pint + SymPy
   - `science_chemistry_equation` → ChemPy
   - `chemistry_element_fact` → local periodic-table lookup
   - `english_grammar` → LanguageTool (en-GB)
   - Open-ended types → skip this stage; the higher Stage-6 threshold compensates.
3. **Consensus check** — Second Claude call at `temperature=0.0` with no source context. Asks: is the answer correct, unambiguous, at the right tier? Structured JSON response.
4. **Constitutional critique** — Third Claude call against a written constitution: age-appropriateness, cultural sensitivity, distractor plausibility, hint progression (hint_3 closer to answer than hint_1), single defensible answer, tier alignment, no repetition.
5. **Semantic deduplication** — Embed `question_text`; pgvector cosine similarity against existing `published` questions in the same `topic_id`. Reject if similarity > 0.92.
6. **Confidence scoring & decision** — Weighted score (computation 60, consensus 25, constitutional −10 per violation, dedup −20, structure −30). Apply §8 thresholds. Decision: `published`, `staged`, or `regenerating`. **Circuit breaker:** max 5 full cycles per question; log and skip if all fail.

**Production anomaly detection (nightly `pg_cron`):**
- Flag any question with ≥ 20 first-attempt answers and error rate > 0.60 → `status='flagged'`.
- Flag any question with ≥ 15 attempts and hint-3 usage rate > 0.50 → `status='flagged'`.
- Flagged questions are queued for regeneration through the same pipeline.

---

## 10. Game mechanics for MVP

Build only what is listed here. Everything else is deferred to §11.

- **World map** with named zones per subject:
  - Year 3 — Number Jungle (Maths), Whispering Woods (English), Discovery Cave (Science)
  - Year 7 — Crystal Labyrinth (Maths), Library of Echoes (English), Elemental Forge (Science)
  - Topic nodes unlock sequentially within a zone.
- **Learn → Practise → Quiz** loop per topic.
- **Hints** (3 levels) with progressive point cost.
- **Lives** — 3 hearts per attempt; 3 consecutive wrong answers = lose a heart; 0 hearts = retry, no persistent penalty.
- **Points** — correct answer, perfect-attempt bonus, hint deduction.
- **Streaks** (daily login) and **Streak Shields** (earned, spendable to absorb one heart loss).
- **Discovery Cards** — five rarities (Common 40 / Uncommon 25 / Rare 15 / Epic 10 / Legendary 10). One drops after every passing quiz.
- **Badges** — Topic Star, Perfect Score, Subject Champion, Streak 7, Guardian Slayer.
- **Zone Guardian boss** — 15 questions randomised across the zone's topics; unique Legendary card on win; immediate retry on failure with no penalty.
- **Daily Mystery Challenge** — 3-question puzzle per year group, surfaced on dashboard, rotated by `pg_cron` at midnight UK time.
- **SM-2 spaced repetition** — automatic review scheduling after topic completion; "Time to revisit" cards on dashboard.
- **Customisation** — avatar (8 base characters × accent colour), theme (5 swatches), study buddy (4 options). Persists in `profiles`.
- **Adaptive difficulty within session** — `lib/adaptive.ts` reads `session_answers` rolling window of 10. Surfaces harder/easier questions without bypassing formal tier gates.

### SM-2 (`lib/sm2.ts`)

```typescript
export function sm2(quality: number, reps: number, easiness: number, interval: number) {
  if (quality < 3) return { reps: 0, easiness, interval: 1 }
  const e = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const r = reps + 1
  const i = r === 1 ? 1 : r === 2 ? 6 : Math.round(interval * e)
  return { reps: r, easiness: e, interval: i }
}
```

### Colour tokens (use these exact values everywhere)

```css
--background:     #FAFBFF;
--surface:        #FFFFFF;
--maths:          #6C9EFF;
--english:        #FF8FAB;
--science:        #52D9A0;
--sprout:         #A8E6CF;
--explorer:       #74C0FC;
--lightning:      #FFD43B;
--points-gold:    #FFC107;
--correct:        #40C057;
--incorrect:      #FF6B6B;
--text-primary:   #2D3748;
--text-muted:     #718096;
```

---

## 11. Deferred Phase 2 features

Designed-for in the schema or upgrade plan, but **must not** be built in the MVP:

- Foundation Mode (Year 1–2 audio-first UI; picture-based answers)
- GCSE past paper engine (Years 10–11)
- A-level long-answer mode (Years 12–13)
- Head-to-head live challenges (Supabase Realtime)
- Cross-subject Fusion Challenges + Fusion Cards
- Secret Bonus Room (nice-to-have; defer)
- Teacher accounts / classroom mode
- Stripe subscriptions
- Public community leaderboard outside the family group
- Full WCAG 2.1 AA audit (MVP does the basics: alt text, keyboard nav, `prefers-reduced-motion`; full audit later)

---

## 12. File and folder structure

```
decifer-learning/
├── CLAUDE.md                       ← this file
├── app/
│   ├── (auth)/login, register
│   ├── dashboard/                              ← role gateway + child/parent/admin role-scoped placeholders
│   ├── (child)/world-map, topics/[id]/learn|practise|quiz
│   ├── (child)/leaderboard, collection, missions, guardian/[zoneId],
│   │             daily-challenge, customise, settings
│   ├── (parent)/children/[id], settings/[childId], account
│   └── api/
│       ├── quiz/submit, topics/[id]/questions
│       ├── points, progress, leaderboard, cards
│       ├── badges/check
│       └── pipeline/  (proxy to PIPELINE_SERVICE_URL)
├── components/
│   ├── ui/          (Button, Card, Modal — mobile-first)
│   ├── quiz/        (QuizQuestion, HintButton, HeartsDisplay, LivesSystem)
│   ├── world-map/   (ZoneMap, TopicNode, GuardianBattle)
│   ├── games/       (DragDrop, FillBlank, SpeedRound, LabelDiagram)
│   ├── cards/       (DiscoveryCard, CardAlbum, CardReveal)
│   ├── customise/   (AvatarBuilder, ThemePicker, BuddySelector)
│   └── parent/      (ProgressSummary, WeakAreas, ScreenTimeControl)
├── lib/
│   ├── supabase/    (client.ts, server.ts, middleware.ts — @supabase/ssr split)
│   ├── auth/        (roles.ts — role/year-group types and helpers)
│   ├── prisma.ts
│   ├── sm2.ts
│   ├── points.ts
│   ├── adaptive.ts
│   └── offline.ts
├── services/
│   └── content-pipeline/
│       ├── main.py
│       ├── pipeline.py
│       ├── verifiers/ (maths.py, physics.py, chemistry.py, english.py)
│       ├── requirements.txt
│       └── Dockerfile
├── prisma/schema.prisma
├── public/manifest.json
├── scripts/
│   ├── seed-knowledge-base.ts
│   ├── seed-topics.ts
│   ├── seed-cards.ts
│   ├── seed-daily-challenges.ts
│   └── generate-content.ts
└── next.config.js                  ← next-pwa config
```

---

## 13. PWA and mobile requirements

- `public/manifest.json`: name "Decifer Learning", short_name "Decifer", display `standalone`, background `#FAFBFF`, theme `#6C9EFF`, icons at 192 px and 512 px.
- iOS meta tags in `app/layout.tsx`: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=default`.
- `next-pwa` service worker caches: all `/learn` pages, topic data, game assets, manifest, fonts.
- `lib/offline.ts`: IndexedDB `pending-answers` store. `submitAnswer` queues offline; `online` event drains the queue in order.
- Lighthouse PWA score ≥ 90 on dashboard + quiz before pilot.
- No horizontal scroll at 375 px on any page.
- Bottom tab bar on mobile (Home, World Map, Collection, Profile).
- Every tap target ≥ 48 × 48 px.

---

## 14. Build phases and gates

**Discipline — non-negotiable:**
- **One Claude Code session = one phase.**
- **Do not start Phase N+1 until Phase N's gate passes.**
- Every phase has: what gets built, what must NOT be built, verification commands, pass/fail gate, rollback condition.
- If verification fails, **stop and report**. Do not push forward.

### Phase 0 — Project scaffold and infrastructure
- **Build:** Next.js 14 + TS + Tailwind + Framer Motion; Supabase project connected; Prisma schema file (no migrations yet); FastAPI scaffold with `/health`; `public/manifest.json`; `next.config.js` with next-pwa; `.env.local` placeholders; root layout with Nunito + Inter.
- **Do not build:** any pages beyond default, auth, pipeline logic, seed scripts.
- **Verify:** `npm run dev` runs; `npx prisma validate` passes; `uvicorn main:app` returns 200 on `/health`; Vercel preview URL live; `manifest.json` valid JSON.
- **Gate:** all of the above green.
- **Rollback:** delete working tree and restart; no data yet.

### Phase 1 — Auth, profiles, role selection, year group selection
- **Build:** login, register, role choice (child/parent), year group cards (**Year 3 + Year 7 only**), parent→child linking, protected routes, top nav bar.
- **Do not build:** quiz, world map, content, points.
- **Verify:** child can register → pick year group → reach `/dashboard`; parent can register and link a child; logged-out access to `/dashboard` redirects to `/login`; no horizontal scroll at 375 px.
- **Gate:** all four flows work end-to-end at iPhone SE viewport.
- **Rollback:** revert Phase 1 commits; Phase 0 scaffold remains.

### Phase 2 — Database schema, seed basics, RLS baseline
- **Build:** Prisma migrations for the full §7 schema; enable pgvector; seed `year_groups`, `subjects`, baseline `zones` for Year 3 + Year 7; RLS policies enforcing `published`-only reads on content tables and self-only writes on gameplay tables.
- **Do not build:** content generation, child UI for new tables.
- **Verify:** every table exists; anon and child roles cannot read `staged` / `flagged` content (proven by test queries); pgvector index exists.
- **Gate:** RLS proven by automated test queries; migrations idempotent.
- **Rollback:** `prisma migrate reset` (pre-pilot, no real user data).

### Phase 3 — Maths content pipeline foundation
- **Build:** FastAPI `verifiers/maths.py` (SymPy + safe-eval); pipeline Stages 1–6 wired up; RAG ingestion endpoint; `/generate` endpoint; `curriculum_chunks` seeded with KS2 + KS3 Maths source material; confidence scoring + status write-back.
- **Do not build:** physics / chemistry / English verifiers; child UI.
- **Verify:** `/verify/maths` rejects `2+2=5`, accepts `2x=10 → x=5`; `/generate` for one Year 3 Maths topic returns ≥ 1 `published` row with `confidence_score ≥ 85`; pipeline log shows all 6 stages.
- **Gate:** ≥ 10 `published` Maths questions for one Year 3 topic.
- **Rollback:** delete the generated question rows; verifiers are deterministic so re-running is safe.

### Phase 4 — Core Learn / Practise / Quiz loop (one Year 3 Maths topic)
- **Build:** Learn page, Fill-in-the-blank Practise, Quiz with 10 questions, immediate feedback animations, basic hints. **All child-facing reads filter `status='published'`.**
- **Do not build:** points engine, lives, world map, cards.
- **Verify:** child completes Learn → Practise → Quiz end-to-end on a real Year 3 Maths topic; no `staged` content surfaces; animations play at 375 px.
- **Gate:** one full topic playable.
- **Rollback:** feature-flag the topic out of the dashboard.

### Phase 5 — Points, hints, hearts, attempts, progress
- **Build:** `lib/points.ts`; hint deduction; `HeartsDisplay` + `LivesSystem` (3 hearts, 3-consecutive-wrong rule); writes to `quiz_attempts` + `quiz_answers`; `topic_progress` updates; SM-2 schedule on pass; streak update on daily login.
- **Do not build:** Discovery Cards, badges, world map, parent dashboard.
- **Verify:** 10/10 no-hints quiz → 125 pts logged; 3 consecutive wrong → heart lost; pass at ≥ 70 % → `topic_progress.status='completed'` and `sr_next_review` set 1 day ahead; retry on fail does not penalise.
- **Gate:** points / hearts math reconciles against spec.
- **Rollback:** revert points commits; `topic_progress` rows can be deleted.

### Phase 6 — Year 7 Maths topic loop
- **Build:** generate content for one Year 7 Maths topic via the existing pipeline; expose it on the dashboard; verify the full Phase 4–5 loop also works for Year 7.
- **Do not build:** anything new — this phase proves the pipeline + UI generalise across year groups.
- **Verify:** Year 7 child plays a full Year 7 Maths topic end-to-end; pipeline produces ≥ 10 `published` Year 7 Maths questions.
- **Gate:** parity with Year 3 loop.
- **Rollback:** disable the Year 7 topic from the dashboard.

### Phase 7 — Discovery Cards, badges, streaks
- **Build:** seed `card_catalog` (≥ 30 cards across rarities for Maths Y3 + Y7); drop logic in `POST /api/quiz/submit`; `CardReveal` modal; `app/(child)/collection/page.tsx` with silhouettes for uncollected cards; badge engine + `BadgePopup`; streak shields.
- **Do not build:** Fusion Cards (Phase 2).
- **Verify:** 20 simulated quiz completions produce the documented rarity distribution within ±5 percentage points; uncollected cards render as silhouettes; Perfect Score badge fires correctly.
- **Gate:** rarity distribution within tolerance; collection page renders.
- **Rollback:** disable card drops via feature flag.

### Phase 8 — Simple world map and topic unlocks
- **Build:** SVG / absolute-positioned `ZoneMap` reading `zones` + `world_map_nodes`; node states (locked / available / completed); unlock animation; "Zone Guardian Awakens!" banner when zone complete; 15-question Guardian quiz reusing the existing engine.
- **Do not build:** Fusion Challenge nodes, cinematic boss music, full audio layer.
- **Verify:** Year 3 and Year 7 maps render at 375 px with no horizontal scroll; completing a topic unlocks the next node; completing all zone topics surfaces the Guardian and awards a Legendary card on win.
- **Gate:** both maps render + one Guardian victory.
- **Rollback:** revert to flat topic list on the dashboard.

### Phase 9 — Parent dashboard with weak areas
- **Build:** `(parent)/dashboard` per-child summary; `WeakAreas` component (queries `quiz_answers` for high hint-3 or high error rate, grouped by topic); recent activity feed; per-child detail page; screen-time controls in `parent_controls`; server-side enforcement in `POST /api/quiz/submit`.
- **Do not build:** Stripe, teacher accounts.
- **Verify:** parent sees weak areas with topic-specific data; daily limit blocks quiz access (but not Learn pages); GDPR delete endpoint wipes all child rows across every table.
- **Gate:** weak-areas view shows real data; screen-time block enforced server-side.
- **Rollback:** parent-side only; child experience unaffected.

### Phase 10 — PWA install, offline learn/practice, IndexedDB quiz queue
- **Build:** finalise `manifest.json`; service-worker caching list; iOS meta tags; `lib/offline.ts` IndexedDB queue; "Offline mode" banner; "Syncing…" indicator; Lighthouse audit.
- **Do not build:** offline leaderboard; offline card reveals (those queue).
- **Verify:** install to iPhone home screen via Safari; airplane-mode quiz completes → sync on reconnect → score appears in Supabase; Lighthouse PWA ≥ 90 on dashboard + quiz.
- **Gate:** install + offline sync verified on a real device (or instrumented simulator).
- **Rollback:** disable service-worker registration; rest of app still works online.

### Phase 11 — Expand to English and Science
- **Build:** `verifiers/english.py` (LanguageTool); `verifiers/physics.py` + `verifiers/chemistry.py`; ingest curriculum chunks for English + Science Year 3 + Year 7; generate content; surface topics on world map.
- **Do not build:** GCSE past papers, Foundation Mode.
- **Verify:** ≥ 10 `published` questions per topic per tier across English + Science MVP topics; verifiers reject seeded wrong answers in tests.
- **Gate:** both subjects playable end-to-end at Year 3 + Year 7.
- **Rollback:** hide non-Maths zones from the world map.

### Phase 12 — Family pilot monitoring, anomaly detection, flagged regeneration
- **Build:** nightly anomaly detection cron (error rate + hint-3 rate flags); `POST /pipeline/regenerate-flagged` endpoint + scheduled call; admin-only monitoring page (`(admin)/dashboard`) showing flagged counts and pipeline stats; "Report a problem" button on quiz questions.
- **Do not build:** community rollout, public leaderboard.
- **Verify:** 3 consecutive nights of clean cron logs; an intentionally-flagged question disappears from the child-facing pool within 24 h; regeneration loop replaces it.
- **Gate:** both children use the app independently for one full week; ≥ 50 quiz attempts with no pipeline errors; zero verified-wrong answers reach the children.
- **Rollback:** disable the cron; manual review of the flagged set before re-enabling.

---

## 15. Do not build (scope boundaries)

- Native iOS / Android apps
- Admin CMS UI (pipeline IS the CMS)
- Human moderation queue (one-time pilot spot-check only)
- Desktop-only patterns (hover dependencies, right-click menus)
- Third-party ad networks
- Analytics beyond Supabase built-ins
- Anything listed in §11 (Deferred Phase 2 features)

---

## 16. Claude Code operating rules

1. **Read this file first** at the start of every session. Treat it as the single source of truth. Where it conflicts with `EduPlatform_Upgrade_Plan.md`, `EduPlatform_Benchmark_Analysis.md`, or `EduPlatform_BuildGuide.md`, **this file wins**.
2. **One session = one phase.** Do not bundle phases. Do not skip gates.
3. **Filter content reads.** Every child-facing query on `quiz_questions`, `card_catalog`, `learn_content` must include `WHERE status = 'published'`. When adding a new content route, demonstrate this in the diff.
4. **Never let an LLM compute the canonical answer.** LLMs may generate, critique, explain, or rephrase. The authoritative answer for any verifiable question must come from a code verifier (SymPy / Pint / ChemPy / periodic-table / LanguageTool).
5. **Never hardcode topics, questions, hints, cards, or zones in code.** All such data lives in the database. Adding curriculum content must require zero code changes.
6. **Mobile-first.** Design every UI at 375 px first. Verify no horizontal scroll. Every tap target ≥ 48 px.
7. **Preserve schema names.** `card_catalog`, `child_collection`, `practice_games`, `quiz_questions.correct_answer`, `quiz_questions.distractors`. Do not rename.
8. **Use the env var names in §6 exactly.** Do not introduce new secrets silently — if a new one is needed, update §6 and stop for confirmation.
9. **Stop and report on gate failure.** Do not auto-advance to the next phase.
10. **Old-name purge.** `edu-platform` and `sproutlearn` must never appear in code, copy, manifest, README, or commit messages. The folder is `decifer-learning/` and the product is "Decifer Learning".

---

*v2 — supersedes CLAUDE.md v1 and all sibling planning documents.*
