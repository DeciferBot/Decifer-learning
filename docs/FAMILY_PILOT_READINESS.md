# Family Pilot Readiness — Decifer Learning

**Commit:** `28e9da245914b0ae6d0e692f8d177701f6ed1560`  
**Date:** 2026-05-21  
**Verdict:** ✅ GO for family pilot (Maths-only, Year 3 + Year 7)

---

## 1. Pilot scope

| Dimension | In scope | Out of scope |
|---|---|---|
| Users | 1 parent + up to 2 children (Year 3 and/or Year 7) | Community, teachers, admin |
| Subjects | **Maths only** | English, Science (Phase 11) |
| Zones | Number Jungle (Y3), Crystal Labyrinth (Y7) | All other zones |
| Topics | Multiplication Tables (Y3), Algebra: Solving Linear Equations (Y7) | All other topics |
| Platform | Vercel (web) + Safari "Add to Home Screen" (PWA install) | Native iOS/Android app |
| Offline | PWA install only — no offline quiz sync | Phase 10 not built |
| Payments | None | Stripe is Phase 2 |
| Screen-time | Placeholder visible in parent dashboard; no enforcement | Phase 9 gate |

---

## 2. Production infrastructure

| Layer | Status | Notes |
|---|---|---|
| **Vercel (Next.js app)** | ✅ Active | All user-facing routes; `NEXT_PUBLIC_APP_URL` set |
| **Supabase (PostgreSQL + Auth)** | ✅ Active | System of record; all env vars present |
| **Cloudflare (DNS + edge)** | ✅ Active | Domain → Vercel |
| **Resend (transactional email)** | ✅ Active | Configured in Supabase; no separate env var in Next.js |
| **Google Cloud Run (pipeline)** | ⏭️ Not deployed | Not required for pilot; `PIPELINE_SERVICE_URL` empty is safe |
| **Google Cloud Tasks** | ⏭️ Not deployed | Not required for pilot |

**App runs without Cloud Run.** The pipeline service is needed only for Phase 11 content generation. All pilot content is pre-seeded.

### Env var checklist (local + Vercel project)

| Variable | Required for pilot | Present in `.env.local` |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | ✅ |
| `DATABASE_URL` | Yes | ✅ |
| `DIRECT_URL` | Yes | ✅ |
| `NEXT_PUBLIC_APP_URL` | Yes | ✅ |
| `PIPELINE_SERVICE_URL` | **No** — empty is safe | Set (empty value OK) |
| `ANTHROPIC_API_KEY` | No for pilot | Set (future pipeline use) |
| `OPENAI_API_KEY` | No for pilot | Set (future pipeline use) |

---

## 3. Verification results

| Script | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm run build` | ✅ 27 routes compiled |
| `scripts/verify-phase8.mjs` | ✅ 24 / 24 passed |
| `scripts/verify-parent-dashboard-safety.mjs` | ✅ 16 / 16 passed |
| `scripts/verify-phase8a.mjs` | ✅ 18 passed, 2 skipped (LIVE — Cloud Run not deployed; expected) |
| `scripts/verify-lesson-store-safety.mjs` | ✅ 15 / 15 passed |

---

## 4. Seeded content inventory

### Zones and topics

| Zone | Year group | Subject | Topics | Published questions |
|---|---|---|---|---|
| Number Jungle | Year 3 (KS2) | Maths | Multiplication Tables | 15 |
| Crystal Labyrinth | Year 7 (KS3) | Maths | Algebra: Solving Linear Equations | 15 |
| Whispering Woods | Year 3 | English | 0 | 0 |
| Discovery Cave | Year 3 | Science | 0 | 0 |
| Library of Echoes | Year 7 | English | 0 | 0 |
| Elemental Forge | Year 7 | Science | 0 | 0 |

English and Science zones render on the world map with "More topics coming soon!" — correct empty-state behaviour, no content surfaced.

### Questions

- 15 published Maths questions for Multiplication Tables (Y3) — tiers: sprout / explorer / lightning
- 15 published Maths questions for Algebra (Y7) — tiers: sprout / explorer / lightning
- All verified via inline algebraic / arithmetic verification in seed scripts
- All carry `status = 'published'`; no `staged` or `flagged` rows in DB

### Learn content and practice games

| Topic | Learn content | Practice game |
|---|---|---|
| Multiplication Tables | ✅ Published (1 540 chars HTML) | ✅ fill_blank |
| Algebra: Solving Linear Equations | ✅ Published (1 409 chars HTML) | ✅ fill_blank |

### Lessons (Lesson Store)

| Lesson | Tier | Status |
|---|---|---|
| Multiplication Tables — Sprout | sprout | published + verified |
| Multiplication Tables — Explorer | explorer | published + verified |
| Multiplication Tables — Lightning | lightning | published + verified |

Algebra lessons are not in the Lesson Store yet; the topic is accessible via the `/topics/[id]/learn` route directly through the world map.

### Discovery Cards

| Rarity | Count |
|---|---|
| Common | 12 |
| Uncommon | 8 |
| Rare | 4 |
| Epic | 3 |
| Legendary | 3 |
| **Total** | **30** |

Cards are scoped to Maths (Y3, Y7, and shared). Drop probabilities: Common 40% / Uncommon 25% / Rare 15% / Epic 10% / Legendary 10%.

### Badges

Topic Star, Perfect Score, Subject Champion, Streak 7, Guardian Slayer — all seeded. Topic Star and Perfect Score are fully triggerable in the pilot. Guardian Slayer fires on a Zone Guardian win.

### Curriculum chunks

22 rows seeded in `curriculum_chunks` (KS2 + KS3 Maths source material for RAG when the pipeline activates).

### Guardian quiz

Both zones have 15 published questions. The guardian page draws from all published topic questions within the zone — the `guardian_quiz_id` column is not used. Guardian is accessible after all topics in a zone are completed.

---

## 5. Account setup steps

### 5a. Child account

1. Open the app URL in Safari.
2. Tap **Create account**.
3. Select **child** role.
4. Select **Year 3** (for your son) or **Year 7** (for your daughter).
5. Enter a display name, email, and password (≥ 8 chars).
6. Tap **Create account** → check email for the Supabase confirmation link.
7. Click the link → child lands at `/dashboard/child`.

### 5b. Parent account

1. Repeat the same registration flow but select **parent** role. No year group is shown.
2. Confirm via email. Parent lands at `/dashboard/parent`.

### 5c. FamilyLink (connects parent to child)

Use the in-app form on the parent dashboard:

1. Log in as the parent → `/dashboard/parent`
2. If no children are linked, the **Link your child's account** form is shown prominently
3. Enter the child's registered email address → tap **Link child account**
4. On success the child's progress card appears immediately

If you need to link a second child, an **Add another child** section appears at the bottom of the parent dashboard after the first link is made.

**Fallback (SQL editor):** If the in-app form fails for any reason:
```sql
INSERT INTO family_links (parent_user_id, child_user_id)
SELECT p.id, c.id
FROM auth.users p, auth.users c
WHERE p.email = 'parent@example.com'
  AND c.email = 'child@example.com';
```

### 5d. Admin role

Not required for the family pilot. If needed for internal testing, set the role via the Supabase service role API or SQL:

```sql
UPDATE profiles SET role = 'admin' WHERE user_id = '<admin-user-id>';
-- Also update auth metadata if needed:
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'
WHERE id = '<admin-user-id>';
```

The admin dashboard is at `/dashboard/admin` (read-only monitoring page).

---

## 6. Child journey checklist

Walk through this before handing the device to a child.

### Login
- [ ] Open app URL in Safari
- [ ] Enter email + password → tap **Sign in**
- [ ] Redirects to `/dashboard/child` — name and year group shown

### Child home (dashboard)
- [ ] Name greeting visible
- [ ] Points and streak shown if non-zero
- [ ] **World Map** link card visible and tappable (min 48 px)
- [ ] **My Collection** link card visible
- [ ] Topic card(s) for year group shown: Multiplication Tables (Y3) or Algebra (Y7)
- [ ] Each topic card has **Learn / Practise / Quiz** buttons — all ≥ 48 px tall

### World map
- [ ] Tap **World Map** → `/world-map`
- [ ] All 6 zones listed (3 per year group shown together — Year 3 sees Number Jungle, etc.)
- [ ] Number Jungle (Y3) or Crystal Labyrinth (Y7) shows 1 pulsing node
- [ ] Whispering Woods / Discovery Cave / Library of Echoes / Elemental Forge show "More topics coming soon!"
- [ ] Tap the pulsing node → navigates to `/topics/[id]/learn`

### Learn page
- [ ] Breadcrumb shows topic title
- [ ] **1 Learn / 2 Practise / 3 Quiz** step pills visible
- [ ] Body HTML content renders (no raw HTML tags visible)
- [ ] **Start Practising →** button tappable (min 48 px)

### Practise page (fill-blank game)
- [ ] Fill-blank problems render
- [ ] Inputs accept answers
- [ ] **Go to Quiz →** button tappable

### Quiz flow
- [ ] 10-question quiz loads
- [ ] Hearts HUD (❤️ ❤️ ❤️) visible
- [ ] Points display visible
- [ ] Each answer choice is ≥ 56 px tall
- [ ] Correct answer shows green feedback
- [ ] Wrong answer shows red feedback + correct answer
- [ ] Hints available (3 levels); each level has a cost displayed
- [ ] 3 consecutive wrong answers removes one heart (shield absorbs if shields > 0)
- [ ] Quiz completes → results screen with score, points earned, streaks
- [ ] **Discovery Card reveal** modal appears (one card per passing quiz)
- [ ] **Badge popup** fires if trigger condition met (Topic Star on first completion)

### Completion / progress
- [ ] Return to `/dashboard/child` → topic still shows; points updated
- [ ] Return to `/world-map` → completed topic node shows ✓
- [ ] If all zone topics are complete: **Zone Guardian Awakens!** banner visible

### Zone Guardian
- [ ] Tap **Battle Guardian →** → `/guardian/[zoneId]`
- [ ] 15-question quiz with zone questions (shuffled)
- [ ] Pass (≥ 70%) → Legendary Discovery Card revealed + Guardian Slayer badge fires
- [ ] Fail → retry with no penalty

---

## 7. Parent journey checklist

### Parent login
- [ ] Log in with parent credentials → redirects to `/dashboard/parent`
- [ ] If no children linked: **Link your child's account** form shown prominently
- [ ] Enter child's registered email → tap **Link child account** → child card appears
- [ ] If already linked: **Add another child** section at the bottom

### Parent dashboard (with linked child)
- [ ] Child name + year group displayed
- [ ] Points and streak shown if non-zero
- [ ] Progress snapshot: Topics started / Topics mastered / Quizzes taken (real data)
- [ ] Average accuracy strip shows if quizzes taken

### Recommended lesson
- [ ] "Start here" or "Next lesson" block shows lesson title + subject
- [ ] If no verified lessons for year group: "No lessons available yet" empty state

### Weak areas
- [ ] Appears only after ≥ 3 quiz answers with ≥ 50% error rate on a topic
- [ ] Before any quizzes: "Weak areas will appear after your child completes quizzes."
- [ ] After clean quizzes: "Great work — no struggle areas detected yet."

### Screen-time controls
- [ ] "Screen-time controls — coming in Phase 9" placeholder visible
- [ ] No enforcement UI present (correct; enforcement is deferred)

### Per-child detail page
- [ ] Tap **View full report →** → `/dashboard/parent/children/[childId]`
- [ ] Security: parent can only view their own linked children (403 if not linked)
- [ ] Recent activity feed, badge list, card collection count shown
- [ ] Curriculum coverage shows real data (never overclaims)
- [ ] Empty states correct for all sections when no data

---

## 8. Mobile usability checklist

Test at **375 px** (iPhone SE) and **390 px** (iPhone 14).

| Check | Status |
|---|---|
| Child dashboard — World Map + Collection link cards | ✅ `min-h-[48px]` |
| Child dashboard — Learn / Practise / Quiz topic buttons | ✅ Fixed to `min-h-[48px]` (was 44 px — now corrected) |
| Quiz answer choices | ✅ `min-h-[56px]` |
| QuizShell navigation buttons (Try Again, Next, Back) | ✅ `min-h-[48px]` |
| Guardian button in zone banner | ✅ `min-h-[48px]` |
| Topic node circles on world map | ✅ 64 × 64 px |
| ZoneMap container — no horizontal scroll | ✅ `overflow-hidden` |
| Child layout max-width | ✅ `max-w-screen-md px-4` — fits at 375 px |
| Auth pages (login, register) — all inputs and buttons | ✅ `h-12` = 48 px |
| Parent dashboard stat grid (`grid-cols-3`) | ✅ fits at 375 px with `px-5` padding |
| PWA icons | ⚠️ Placeholder files (70 bytes each) — install works but icon will show a blank |

**Known limitation:** The PWA icons (`public/icon-192.png`, `public/icon-512.png`) are placeholder files. Safari "Add to Home Screen" will work but the home-screen icon will be blank/generic. Real icons should be added before a wider rollout.

---

## 9. Safety confirmation

| Claim | Verified |
|---|---|
| No fake / fabricated progress data | ✅ All data from live DB queries |
| No unpublished content surfaced to children | ✅ All child-facing queries filter `status='published'` |
| No `staged` or `flagged` questions in DB | ✅ 0 rows confirmed |
| No unverified lessons surfaced | ✅ Lesson Store gates `verification_status='verified'` |
| No AI tutor in any child-facing route | ✅ No AI imports in child or parent runtime files |
| No payment flow | ✅ Stripe not present |
| No screen-time enforcement claim | ✅ "Coming in Phase 9" placeholder only |
| No full curriculum coverage claim | ✅ Coverage uses `isCurriculumComplete` field; never hard-codes "complete" |
| No active deployment instruction uses Railway vocabulary | ✅ All active docs use Cloud Run |
| FamilyLink security on per-child detail | ✅ Parent→child link verified before serving data |

---

## 10. Known limitations

| Item | Impact | Gating phase |
|---|---|---|
| ~~FamilyLink requires manual SQL~~ | In-app form built — parent enters child email on dashboard | ✅ Done |
| **1 topic per zone** | Sequential unlock chain cannot be shown; world map has single node per active zone | Phase 11 adds more topics |
| **English + Science zones empty** | Zones render with "More topics coming soon!" — correct but pilot is Maths-only | Phase 11 |
| **Offline quiz sync not built** | Phase 10 not started; no `pending-answers` IndexedDB queue | Phase 10 |
| **PWA icons are placeholders** | Blank icon on Safari home screen | Before wider rollout |
| **Guardian submit not idempotent** | Points can double-award on retry (low risk at pilot scale) | Before community rollout |
| **PgBouncer interactive transaction atomicity** | Each statement auto-commits; safe at pilot concurrency | Before community rollout |
| **Screen-time enforcement not built** | Parent sees placeholder only | Phase 9 |
| **Admin CMS not built** | Content management is via seed scripts + Supabase SQL editor | Phase 12 |
| **Cloud Run not deployed** | No new AI content generation; pilot uses seeded content only | Phase 11 |

---

## 11. Safe product claims

> "Decifer Learning is a Maths learning app for Year 3 and Year 7 children following the UK National Curriculum. Children can log in, explore their Maths zone on the world map, work through Learn → Practise → Quiz for their topic, earn points and Discovery Cards, and battle the Zone Guardian to unlock a Legendary card. Parents can view real quiz progress, accuracy, weak areas, and a recommended next lesson for their child."

---

## 12. Blocked product claims (do not make)

- "The app works offline" — Phase 10 not built
- "English and Science content is available" — Phase 11 not built
- "Screen-time limits are enforced" — deferred
- "Multiple topics are available" — only 1 per zone at pilot
- "The content pipeline is live" — Cloud Run not deployed
- "Guardian quiz is idempotent" — double-award gap exists
- "The app is ready for community rollout" — PgBouncer hardening + idempotency pending

---

## 13. Go / No-Go verdict

| Gate | Result |
|---|---|
| TypeScript clean | ✅ |
| ESLint clean | ✅ |
| Production build (27 routes) | ✅ |
| Phase 8 verify (24/24) | ✅ |
| Parent dashboard safety (16/16) | ✅ |
| Phase 8A verify (18/18 run, 2 skipped — expected) | ✅ |
| Lesson store safety (15/15) | ✅ |
| No staged/flagged content in DB | ✅ |
| No fake data paths | ✅ |
| All child-facing queries filter `status='published'` | ✅ |
| All child tap targets ≥ 48 px | ✅ (fixed in this sprint) |
| App runs without Cloud Run | ✅ |
| FamilyLink creation documented | ✅ (manual SQL, no UI) |
| PWA manifest valid | ✅ |
| iOS meta tags present | ✅ |

**Verdict: GO for family pilot.**  
Maths, Year 3 + Year 7, seeded content only. The operator must create the FamilyLink manually via Supabase SQL before the parent can see child data. PWA icons are placeholders — install works but shows a blank icon.
