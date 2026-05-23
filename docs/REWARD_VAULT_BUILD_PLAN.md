# Decifer Learning — Reward Vault Build Plan

> **Execution document.** This is the build plan, not an evaluation.
> Version 1.0 — 2026-05-24
> Cross-reference: `docs/REWARD_VAULT_ARCHITECTURE.md` (design rationale)
> Status: Approved for Sprint R1 implementation

---

## 1. Executive Build Decision

**Reward Vault will be built. The question is implementation path, not whether to proceed.**

Reward Vault is a product differentiator that combines Decifer's two strongest assets — verified learning quality and parent trust — into a concrete, recognisable feature. Parents gain a structured, transparent way to acknowledge their child's real progress. Children gain visible milestones that connect the app to life outside it.

The implementation path is four stages. Stage 1 builds the foundation: milestone tracking, family rewards, parent approval, child visibility. No Shopify. No payment. No catalogue. No delivery. Stage 1 proves that the system works and that parents trust it before physical commerce is introduced.

This document defines what to build, in what order, and to what spec. Every decision in it is made. Where architecture allows for extension, the extension point is defined. Where something must wait for a later stage, the exact wait reason is stated.

---

## 2. Product Definition

### What Reward Vault is

Reward Vault is a parent-controlled recognition system built into Decifer Learning. When a child reaches verified learning milestones — completing topics, accumulating XP, maintaining consistency — they become eligible to request a reward. The parent sees exactly what the child has achieved, decides what form the celebration takes, and approves it. The child receives acknowledgement of their progress. The parent remains in control from start to finish.

### Child promise

> "When you master your topics, Decifer keeps a record. When you've done enough, you can ask for a reward. Your parent decides what it is."

### Parent promise

> "You see exactly what your child earned and why. You choose what to celebrate and how. Nothing gets ordered or promised without your approval."

### Decifer business value

Reward Vault makes parent engagement structural, not optional. A parent who has configured family rewards and approved one request is meaningfully retained. The Vault creates a regular reason for parents to open the parent dashboard and for children to narrate their progress to their parents. It also provides a credible path to premium differentiation when physical prizes are introduced with Shopify in Stage 3.

---

## 3. Version Roadmap

### Stage 1 — Reward Vault Foundation

Family rewards only. Child earns milestone eligibility. Child requests a reward. Parent approves, rejects, defers, or suggests an alternative. Parent marks family rewards fulfilled. Admin sees all activity. No catalogue. No payment. No Shopify.

**Target:** Family pilot operational. ≥1 complete reward cycle per linked child.

### Stage 2 — Curated Physical Prize Catalogue

Admin creates a curated set of approved physical reward items. Parents can select from these items when approving a request. Children still do not shop — they see a reward category or parent-confirmed label at most. Fulfilment is still manual: parent orders and pays externally. Decifer tracks request status only.

**Target:** Physical reward requests resolved without Shopify complexity. Catalogue admin tooling built.

### Stage 3 — Shopify Fulfilment Layer

Approved physical reward choices generate Shopify draft orders through the pre-built commerce adapter interface. Parent confirms payment via a Shopify checkout link sent by admin — never in the Decifer app. Decifer stores only fulfilment status and a non-sensitive order reference. Child never sees Shopify. No Amazon in this path.

**Target:** Physical reward end-to-end without manual admin ordering.

### Stage 4 — Intelligent Reward Personalisation

Decifer surfaces personalised reward suggestions to parents based on the child's subject strengths, learning pace, and parent-configured preferences. Parent always approves. Recommendations are generated from learning data — no external profiling. No ad networks. No affiliate programmes.

**Target:** Reward suggestions increase approval conversion and reduce parent decision friction.

---

## 4. Stage 1 Exact Scope

### Included in Stage 1

- Prisma migration adding vault tables (milestones, child status, parent settings, requests)
- Milestone engine in `lib/vault.ts` — reads verified learning events, writes vault status
- Milestone check triggered non-blocking after every quiz submission
- Child vault page: current milestone band, progress to next, eligibility state, request flow
- Vault teaser card on child dashboard quick-links
- Parent vault section on parent dashboard: per-child summary, pending request with evidence block, response controls
- Parent vault settings page: family reward list (add/edit/remove), max monthly requests, physical rewards toggle (off and locked in Stage 1)
- Request approval flow: Approve (family reward), Defer, Suggest alternative, Reject with note
- Parent marks family reward as fulfilled
- Admin vault view: all requests across all children, status, evidence, basic CSV export
- Commerce adapter interface (`lib/vault/commerce-adapter.ts`) with `NullCommerceAdapter` implementation — no-op, marks manual
- Verify script with 20 safety checks
- Seed script for milestone bands
- Seed default family reward options for pilot family settings

### Excluded from Stage 1

- Physical rewards (toggle exists in settings but is disabled in Stage 1 code — `physical_rewards_enabled` is always treated as `false` regardless of setting)
- Reward catalogue table population
- Shopify adapter
- Email notifications (in-app dashboard indicator only)
- Budget enforcement (field exists in settings but is informational)
- Delivery address collection (zero fields in any Stage 1 form)
- Any child-facing pricing or catalogue browsing
- Amazon integration of any kind
- Public leaderboards or group reward comparisons
- Push notifications

### Why this is the correct first build

Stage 1 proves the entire non-commerce chain: milestone verification, credit logic, parent approval, child visibility, evidence integrity, and admin oversight. The commerce adapter interface means Stage 3 adds a new class file without touching routing or milestone logic. The physical rewards toggle exists in the settings schema from day one — Stage 2 simply unlocks it. Every extension point is designed now so Stage 2 and 3 are additions, not rewrites.

---

## 5. Child Experience

### Dashboard teaser card

Sits in the existing `grid grid-cols-2` quick-link area on `app/dashboard/child/page.tsx`:

```
┌─────────────────────────────────────────────────┐
│  🏆 Reward Vault                                  │
│  Bronze Explorer · 3 / 8 topics                  │  ← subtitle = current band + progress
└─────────────────────────────────────────────────┘
```

Empty state (no milestone yet):
```
┌─────────────────────────────────────────────────┐
│  🏆 Reward Vault                                  │
│  Keep going to unlock your first reward          │
└─────────────────────────────────────────────────┘
```

### Vault page — full layout

`app/(child)/vault/page.tsx`

```
────────────────────────────────────────────────────
 ← Back         🏆 Your Reward Vault
────────────────────────────────────────────────────

 ┌──────────────────────────────────────────────┐
 │  ★ BRONZE EXPLORER ★                          │
 │  Reached 3 days ago                           │
 │                                               │
 │  ███████░░░░░░░░  4 / 8 topics                │  ← progress towards Silver
 │  650 XP  ·  3 badges                         │
 └──────────────────────────────────────────────┘

 Next milestone: Silver                           ─── visible always
 Complete 4 more topics to unlock               ─── specific, not "work harder"

 ──────────────────────────────────────────────

 🎁 You've earned a reward!                       ─── section only visible when credit_balance ≥ 1
                                                    AND no pending request
 [ Ask for a reward → ]                           ─── large, 48px min height

 ──────────────────────────────────────────────

 📬 Your last request                             ─── section visible when any recent request exists

 STATE: pending
 ┌──────────────────────────────────────────────┐
 │  Waiting for Mum to decide...                │
 │  Sent 2 days ago                             │
 └──────────────────────────────────────────────┘

 STATE: approved
 ┌──────────────────────────────────────────────┐
 │  🎉 Your reward was approved!                │
 │  Your parent will sort it out.               │
 └──────────────────────────────────────────────┘

 STATE: rejected
 ┌──────────────────────────────────────────────┐
 │  Not this time — keep going!                 │
 │  [Next milestone: Silver →]                  │
 └──────────────────────────────────────────────┘

 STATE: deferred
 ┌──────────────────────────────────────────────┐
 │  Your parent is still deciding.              │
 │  Keep learning while you wait.               │
 └──────────────────────────────────────────────┘

 STATE: counter-offer from parent
 ┌──────────────────────────────────────────────┐
 │  Mum has a suggestion:                       │
 │  "How about a trip to the museum instead?"   │
 │  [That sounds great ✓]  [I'll ask again next │
 │                           time]              │
 └──────────────────────────────────────────────┘

 ──────────────────────────────────────────────

 How you earn rewards                            ─── always visible at bottom; education, not pressure

 ✓ Complete topics in Maths, English or Science
 ✓ Keep your streak going
 ✓ Earn XP by answering correctly
 ✗ Rewards are not for screen time

────────────────────────────────────────────────────
```

### Request modal

Triggered by "Ask for a reward →" tap:

```
────────────────────────────────────────────────────
                  ✕ (close)

 🎁 Tell Mum what you'd like to celebrate with

 [     Free text field, 120 char max            ]

 Or choose a suggestion:                         ─── only if parent has set family_reward_options
 ┌──────────────┐  ┌──────────────┐
 │ Movie night  │  │ Bookshop     │             ─── tap-target chips
 └──────────────┘  └──────────────┘

 [ Send to Mum → ]                               ─── large button, always present

────────────────────────────────────────────────────
```

Post-submit confirmation (replaces modal):
```
 Sent! Mum will decide.
 Keep learning while you wait. 📚

 [ Back to Vault ]
```

### Empty state — no milestone yet

```
────────────────────────────────────────────────────
 🏆 Your Reward Vault

 You're on your way!

 ┌──────────────────────────────────────────────┐
 │  First reward unlocks at Bronze              │
 │  Complete 3 topics to get started            │
 │  [Go to World Map →]                         │
 └──────────────────────────────────────────────┘

 How rewards work:
 ✓ Master topics  →  unlock milestones
 ✓ Reach a milestone  →  ask for a reward
 ✓ Parent decides  →  you celebrate together

────────────────────────────────────────────────────
```

### Rules for all child-facing copy

- Never mention prices, delivery, Shopify, or Amazon
- Never show a "credit balance" number — show eligibility state only
- Never compare this child's milestone to other children
- Never use countdown timers or urgency language ("expires soon!")
- Progress numbers are specific and honest: "4 more topics" not "almost there!"
- Rejected requests use positive reframes and a next-step action, never shame language

---

## 6. Parent Experience

### Parent dashboard — Vault section (per child card)

Added to `app/dashboard/parent/page.tsx`, after the weak areas section, before the link-another-child section. One Vault block per linked child.

```
 ┌──────────────────────────────────────────────────────┐
 │  🏆 Reward Vault — Anika                              │
 │                                                       │
 │  ★ Bronze Explorer  ·  3 topics mastered  ·  650 XP  │
 │                                                       │
 │  No pending requests.                                 │  ← default state
 │  [Vault settings →]                                   │
 └──────────────────────────────────────────────────────┘
```

When a request is pending, it expands to an action card:

```
 ┌──────────────────────────────────────────────────────┐
 │  🏆 Reward Vault — Anika                              │
 │  ★ Silver Explorer  ·  8 topics mastered  ·  780 XP  │
 │                                                       │
 │  ⚡ Anika has requested a reward                      │
 │  ─────────────────────────────────────────────────── │
 │  She says: "A new colouring book please"              │
 │                                                       │
 │  Why she earned it:                                   │
 │  ✓ Silver milestone reached (3 days ago)              │
 │  ✓ 8 topics mastered: 5 Maths, 2 English, 1 Science  │
 │  ✓ Perfect Score badge earned                         │
 │  ✓ 780 XP total                                       │
 │  ✓ No reward given in the last 30 days                │
 │                                                       │
 │  [✓ Approve]  [⟳ Suggest alternative]                │
 │  [… Save for later]  [✗ Not this time]                │
 └──────────────────────────────────────────────────────┘
```

### Approve flow — parent picks reward type

```
 ────────────────────────────────────────────────────
  Approving Anika's reward request

  What would you like to celebrate with?

  ○ A family reward (experience, activity, or outing)
  ○ Something else I'll handle myself              ← Stage 1 physical stand-in

  ──── Family reward options ────

  ● Movie night at home
  ○ Trip to a bookshop
  ○ Museum or science centre
  ○ Favourite meal of their choice
  ○ [Add a custom reward...]

  [ Confirm and notify Anika → ]
 ────────────────────────────────────────────────────
```

After approval:
- `reward_requests.status` → `'approved'`
- `reward_requests.reward_type` → `'family'` (or `'manual'` for "handle myself")
- `reward_requests.reward_label` → the chosen option text
- Child vault page updates immediately

### Suggest alternative flow

```
 ────────────────────────────────────────────────────
  Suggest an alternative to Anika

  [  Type your message...  ]
  e.g. "How about a trip to the science museum instead?"

  [ Send suggestion → ]        [ Cancel ]
 ────────────────────────────────────────────────────
```

Sets `parent_response_note` on the request. Status stays `'pending'`. Child sees the counter-offer on their Vault page and can accept ("That sounds great ✓") or dismiss ("I'll ask again next time" — triggers a credit refund and closes the request).

### Reject flow

```
 ────────────────────────────────────────────────────
  Declining Anika's request (optional note)

  [  Write a short note for Anika (optional)...  ]
  e.g. "Great effort — let's wait until your birthday"

  [ Decline request ]          [ Cancel ]
 ────────────────────────────────────────────────────
```

Note is shown to the child in a positive reframe. The credit is refunded — the child regains eligibility for the next valid request.

### Mark fulfilled flow (family rewards)

On the parent dashboard after approval:

```
 ┌──────────────────────────────────────────────────────┐
 │  🏆 Reward Vault — Anika                              │
 │  Reward approved: Movie night at home                 │
 │  Approved 2 days ago                                  │
 │                                                       │
 │  [Mark as done ✓]                                    │
 └──────────────────────────────────────────────────────┘
```

When the parent marks it done: `status → 'completed'`. Child sees a completion state on their Vault page with a small celebratory message.

### Vault settings page

`app/dashboard/parent/vault/[childId]/page.tsx`

```
 ────────────────────────────────────────────────────
  Reward Vault settings — Anika

  ── Family rewards                    always active
  Your reward ideas (Anika sees these as suggestions):
  • Movie night at home       [Remove]
  • Trip to a bookshop        [Remove]
  • Museum or science centre  [Remove]
  [+ Add reward idea]

  ── Monthly request limit
  Anika can ask for a reward:
  [  1  ] time per month
  (You always approve or decline — this limits
   how often she can ask.)

  ── Physical rewards                  Stage 2 / 3 only
  Coming soon. You'll be able to choose approved
  items from our curated catalogue.

  ── Request history
  [View all past rewards →]

 ────────────────────────────────────────────────────
```

The physical rewards section is visible as a "coming soon" teaser in Stage 1. The toggle and category checkboxes from the architecture doc are not shown — they appear in Stage 2 when the catalogue exists.

### Parent trust copy rules

- Never frame rewards as "prizes" or "incentives" — use "celebrating progress", "recognition", "together"
- Never suggest specific commercial products or prices
- Always show the evidence block before asking for a decision
- Always offer an easy "save for later" option — never pressure an immediate decision
- Never email parents about pending requests in Stage 1 (adds email provider dependency) — dashboard indicator only

---

## 7. Admin Experience

`app/dashboard/admin/vault/page.tsx`

### Stage 1 admin view

```
 ────────────────────────────────────────────────────
  Reward Vault — Activity Log

  [All] [Pending] [Approved] [Completed] [Rejected]

  ┌────────────────────────────────────────────────────────────────────┐
  │ Child    │ Milestone │ Request                │ Type    │ Status    │
  ├──────────┼───────────┼────────────────────────┼─────────┼───────────┤
  │ Anika C. │ Silver    │ "Colouring book"       │ Family  │ Approved  │
  │ Kiran C. │ Bronze    │ "Movie night"          │ Family  │ Completed │
  └────────────────────────────────────────────────────────────────────┘

  [Export CSV]

 ────────────────────────────────────────────────────
```

Clicking a row expands the evidence block (milestone name, topics, XP, streak, badges at time of request).

### Stage 1 admin actions

- View request detail and evidence block
- No fulfilment actions in Stage 1 (all rewards are family; parent marks them done)
- Export CSV for records

### Stage 2+ admin actions (not built in Stage 1)

- Mark physical request as processing / ordered / shipped / delivered
- Add tracking note
- Cancel or refund
- Create Shopify draft order (Stage 3)

### Admin safety monitoring

Admin vault view also exposes:
- Any child with `credit_balance < 0` (should be zero rows — highlight if not)
- Any child with two `pending` requests (should be impossible — unique index prevents it, but surface as alert if somehow occurs)
- Total requests this month per child (flag if a child has more than their monthly limit)

---

## 8. Reward Earning Logic

### Milestone bands — decided values

These are production values, not proposals. Adjust only via DB update to `vault_milestones`, not code changes.

| Band | Display name | XP required | Topics completed | Badges required | Guardian required |
|---|---|---|---|---|---|
| bronze | Bronze Explorer | 250 | 3 | 0 | No |
| silver | Silver Achiever | 750 | 8 | 1 | No |
| gold | Gold Champion | 1,600 | 15 | 2 | No |
| platinum | Platinum Master | 3,200 | 25 | 3 | Yes |

**Year-group safety rule:** If the number of `published` topics for a child's year group is less than the `topics_required` for a band, that band is treated as unreachable and `next_milestone` skips ahead or shows `null`. The milestone engine checks `published topics available for this year group` before applying topic gates. This prevents a child being stuck at "Complete 15 more topics" when only 12 exist.

**Anti-inflation rule:** Credits awarded on milestone band transition only — not on every qualifying event. Reaching Bronze awards 1 credit. Reaching Silver awards 1 credit. A child at Bronze who has already spent their credit and not yet reached Silver has `credit_balance = 0` and sees "Keep going to earn the next reward."

### What counts towards milestones

| Signal | Counts | Notes |
|---|---|---|
| `topic_progress.status = 'completed'` | Yes | Primary signal. Must be ≥70% quiz score. |
| `profiles.total_points` | Yes | XP accumulated from verified quiz activity. |
| `profile_badges` count | Yes | Any earned badge from the existing badge system. |
| Guardian win badge | Yes | For platinum only. |
| Streak days | No | Not a gate. Shown as context in evidence block only. |
| Session duration | No | Never. |
| Login count | No | Never. |
| Card collection | No | Never. |
| Practise sessions | No | Practise is not a milestone event. |

### What does not count

Screen time, login streaks, hint usage, practice session count, card count, or any metric not directly tied to quiz-verified topic mastery. The rationale: these can be gamed without learning. Topic completions require passing a quiz. XP requires answering questions correctly. These are the only reliable proxies for learning in the current system.

### Anti-repeat rules

1. A child can only have one `pending` request at a time (enforced by unique partial index).
2. A child can only earn one credit per milestone band. Reaching Bronze again (e.g., after a DB edge case) does not award a second credit.
3. `max_requests_per_month` in parent settings limits submission frequency independent of credits. Default: 1.
4. After a credit is spent (request submitted), it is not returned if the parent approves. It IS returned if the parent rejects or the child dismisses a counter-offer (so the child does not lose eligibility due to a rejection).
5. Credits do not expire. A child who accumulates credits at Bronze and Silver without requesting has `credit_balance = 2` and can submit requests for each.

### How mastery events become reward eligibility — step by step

```
1. Child completes quiz (POST /api/quiz/submit)
2. Transaction writes: quiz_attempt, quiz_answers, point_events, topic_progress
3. After transaction completes: void triggerMilestoneCheck(profileId)
4. triggerMilestoneCheck calls POST /api/vault/check-milestone (non-blocking)
5. Milestone engine:
   a. Reads: profiles.total_points, COUNT(topic_progress WHERE status='completed'),
             COUNT(profile_badges), any guardian badge
   b. Reads: vault_milestones for all active bands
   c. Reads: child_vault_status.current_band
   d. Determines highest band the child qualifies for
   e. If higher than current_band:
      - Update child_vault_status.current_band
      - Update child_vault_status.current_band_reached_at
      - Increment child_vault_status.credit_balance by credits_awarded for new band
      - Insert into vault_milestone_events (audit log)
   f. If same or lower: no-op
6. Next time child opens vault page: GET /api/vault/status returns new band state
```

The milestone check never fails the quiz submission. If it errors, the quiz result is unaffected. The check will re-run on the next vault page load via `GET /api/vault/status`.

---

## 9. Data Model

### Stage 1 tables

#### `vault_milestones`

Seeded by admin. 4 rows (bronze, silver, gold, platinum).

```sql
vault_milestones (
  id                UUID PK default gen_random_uuid()
  band              TEXT UNIQUE NOT NULL        -- 'bronze' | 'silver' | 'gold' | 'platinum'
  display_name      TEXT NOT NULL               -- "Bronze Explorer"
  xp_required       INT NOT NULL DEFAULT 0
  topics_required   INT NOT NULL DEFAULT 0
  badges_required   INT NOT NULL DEFAULT 0
  guardian_required BOOLEAN NOT NULL DEFAULT FALSE
  credits_awarded   INT NOT NULL DEFAULT 1
  order_index       INT NOT NULL                -- 1, 2, 3, 4
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
)
```

No FK dependencies. Read by milestone engine and child vault status page.

#### `child_vault_status`

One row per child profile. Created on first vault status check.

```sql
child_vault_status (
  profile_id              UUID PK FK → profiles.id ON DELETE CASCADE
  current_band            TEXT NOT NULL DEFAULT 'none'
                          CHECK (current_band IN ('none','bronze','silver','gold','platinum'))
  current_band_reached_at TIMESTAMPTZ
  credit_balance          INT NOT NULL DEFAULT 0 CHECK (credit_balance >= 0)
  credits_earned_total    INT NOT NULL DEFAULT 0
  last_milestone_check    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

`credit_balance` is the only mutable numeric field that can decrease (when a request is submitted). `credits_earned_total` never decreases — it is the audit total.

#### `vault_parent_settings`

One row per (parent_profile, child_profile) pair. Created with defaults on first access.

```sql
vault_parent_settings (
  id                        UUID PK default gen_random_uuid()
  parent_profile_id         UUID NOT NULL FK → profiles.id ON DELETE CASCADE
  child_profile_id          UUID NOT NULL FK → profiles.id ON DELETE CASCADE
  physical_rewards_enabled  BOOLEAN NOT NULL DEFAULT FALSE   -- locked FALSE in Stage 1
  monthly_budget_pence      INT NOT NULL DEFAULT 0           -- informational only
  allowed_categories        TEXT[] NOT NULL DEFAULT '{}'
  family_reward_options     JSONB NOT NULL DEFAULT '[]'      -- [{label: "Movie night"}]
  max_requests_per_month    INT NOT NULL DEFAULT 1 CHECK (max_requests_per_month BETWEEN 0 AND 12)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()

  UNIQUE (parent_profile_id, child_profile_id)
)
```

Default `family_reward_options` value seeded at row creation (not hardcoded in schema):
```json
[
  {"label": "Movie night at home"},
  {"label": "Trip to a bookshop"},
  {"label": "Museum or science centre visit"},
  {"label": "Favourite meal of their choice"},
  {"label": "Extra reading time together"}
]
```

#### `reward_requests`

The core request flow table. One row per request. Immutable after creation except `status`, `parent_response_note`, `reward_type`, `reward_label`, `responded_at`, `responded_by_profile_id`.

```sql
reward_requests (
  id                      UUID PK default gen_random_uuid()
  child_profile_id        UUID NOT NULL FK → profiles.id ON DELETE CASCADE
  parent_profile_id       UUID NOT NULL FK → profiles.id  -- primary notification target
  responded_by_profile_id UUID FK → profiles.id           -- which parent responded
  milestone_band          TEXT NOT NULL                    -- snapshot: band at request time
  xp_at_request           INT NOT NULL                    -- snapshot: immutable
  topics_at_request       INT NOT NULL                    -- snapshot: immutable
  badges_at_request       INT NOT NULL                    -- snapshot: immutable
  streak_at_request       INT NOT NULL DEFAULT 0          -- snapshot: immutable
  child_message           TEXT CHECK (char_length(child_message) <= 120)
  credits_used            INT NOT NULL DEFAULT 1
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending','approved','rejected','deferred',
                            'counter_offered','completed','cancelled'
                          ))
  parent_response_note    TEXT CHECK (char_length(parent_response_note) <= 280)
  reward_type             TEXT CHECK (reward_type IN ('family','manual',NULL))
  reward_label            TEXT                            -- e.g. "Movie night at home"
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  responded_at            TIMESTAMPTZ
)

-- Prevent concurrent pending requests per child
CREATE UNIQUE INDEX reward_requests_one_pending_per_child
  ON reward_requests (child_profile_id)
  WHERE status = 'pending';
```

#### `vault_milestone_events`

Append-only audit log. One row per milestone band transition per child.

```sql
vault_milestone_events (
  id          UUID PK default gen_random_uuid()
  profile_id  UUID NOT NULL FK → profiles.id ON DELETE CASCADE
  band        TEXT NOT NULL
  credits_awarded INT NOT NULL DEFAULT 1
  xp_snapshot    INT NOT NULL
  topics_snapshot INT NOT NULL
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

CREATE INDEX ON vault_milestone_events (profile_id, occurred_at DESC);
```

### Tables deferred to later stages

| Table | Stage | Reason |
|---|---|---|
| `reward_catalog` | Stage 2 | Curated physical items. Empty table created in migration but not populated. |
| `reward_fulfilments` | Stage 2 | Physical order tracking. Table created but no rows until Stage 2. |
| `vault_commerce_events` | Stage 3 | Shopify webhook log. |

The migration creates these tables in Stage 1 with their full schemas so Stage 2 adds zero schema changes beyond data. Only the `is_active` column on `reward_catalog` and the `physical_rewards_enabled` toggle in settings need to change from locked values.

### RLS rules for Stage 1

| Table | Child (own) | Child (other) | Parent (own children) | Parent (other) | Admin |
|---|---|---|---|---|---|
| `vault_milestones` | SELECT | No | SELECT | No | Full |
| `child_vault_status` | SELECT (own row) | No | SELECT (linked children) | No | Full |
| `vault_parent_settings` | No | No | SELECT + UPDATE | No | Full |
| `reward_requests` | SELECT + INSERT (own, one pending) | No | SELECT + UPDATE (status fields) | No | Full |
| `vault_milestone_events` | SELECT (own) | No | SELECT (linked children) | No | Full |
| `reward_catalog` | No | No | No | No | Full |
| `reward_fulfilments` | No | No | No | No | Full |

Key RLS policies to enforce explicitly:
- Child cannot read `vault_parent_settings` — no budget, no category list, no options list
- Child cannot update `reward_requests` (only INSERT new pending, and only one at a time)
- Parent can only UPDATE `reward_requests.status`, `parent_response_note`, `reward_type`, `reward_label`, `responded_at`, `responded_by_profile_id` — not the snapshot fields
- Parent UPDATE on `reward_requests` is restricted to rows where `child_profile_id` matches a linked child

---

## 10. Service Boundaries

### Dependency rule (non-negotiable)

```
Learning modules:  lib/points.ts  lib/sm2.ts  lib/cards.ts  lib/adaptive.ts
                         ↑
               NO IMPORT from these ←── lib/vault/  (vault reads DB directly)
```

`lib/vault/` reads from learning tables (`profiles`, `topic_progress`, `profile_badges`, `point_events`) directly via Prisma. It never imports learning lib modules and never writes to learning tables.

### Service modules

#### `lib/vault/milestone-engine.ts`

Pure functions. No Supabase client. No side effects. Takes DB-query results as input, returns milestone computation output. Testable without network.

```typescript
interface LearningSnapshot {
  totalPoints: number
  topicsCompleted: number
  badgeCount: number
  guardianWin: boolean
  publishedTopicsForYearGroup: number  // for year-group safety rule
}

interface MilestoneResult {
  currentBand: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'
  creditsToAward: number
  nextMilestone: MilestoneConfig | null
  progressToNext: MilestoneProgress
}

function computeMilestone(
  snapshot: LearningSnapshot,
  milestones: MilestoneConfig[]
): MilestoneResult
```

#### `lib/vault/status.ts`

Reads DB, calls `computeMilestone`, writes `child_vault_status` if milestone changed. Called by:
- `POST /api/vault/check-milestone`
- `GET /api/vault/status` (for display, no write on read-only path)

```typescript
async function getVaultStatus(profileId: string): Promise<VaultStatus>
async function checkAndUpdateMilestone(profileId: string): Promise<MilestoneResult>
```

#### `lib/vault/requests.ts`

Request creation, parent response, credit management. Validates all business rules. Runs in Prisma transactions.

```typescript
async function createRewardRequest(childProfileId: string, message: string): Promise<RewardRequest>
async function respondToRequest(requestId: string, parentProfileId: string, response: ParentResponse): Promise<RewardRequest>
async function markFulfilled(requestId: string, parentProfileId: string): Promise<RewardRequest>
```

#### `lib/vault/settings.ts`

Parent settings CRUD. Handles default creation.

```typescript
async function getOrCreateParentSettings(parentProfileId: string, childProfileId: string): Promise<VaultParentSettings>
async function updateParentSettings(id: string, updates: Partial<VaultParentSettings>): Promise<VaultParentSettings>
```

#### `lib/vault/commerce-adapter.ts`

The extension point for Stage 3. Stage 1 ships with `NullCommerceAdapter` only.

```typescript
export interface CommerceAdapter {
  createOrder(request: ApprovedRequest, parentSettings: VaultParentSettings): Promise<CommerceOrderResult>
  getOrderStatus(externalOrderId: string): Promise<CommerceOrderStatus>
}

export interface CommerceOrderResult {
  externalOrderId: string | null
  status: 'manual' | 'pending' | 'created'
  message: string
}

// Stage 1 — no-op. Stage 3 replaces with ShopifyAdapter.
export class NullCommerceAdapter implements CommerceAdapter {
  async createOrder(): Promise<CommerceOrderResult> {
    return { externalOrderId: null, status: 'manual', message: 'Manual fulfilment' }
  }
  async getOrderStatus(): Promise<CommerceOrderStatus> {
    return { status: 'unknown' }
  }
}
```

`ShopifyAdapter` in Stage 3 implements the same interface. The routing code does not change.

#### `lib/vault/admin.ts`

Admin-facing query functions. Returns all requests with joined child data for the admin view.

```typescript
async function getAllRequests(filter?: RequestFilter): Promise<AdminRequestRow[]>
async function updateFulfilmentStatus(fulfilmentId: string, status: FulfilmentStatus): Promise<void>
```

---

## 11. API Routes

All routes in `app/api/vault/`. Follow existing project pattern: Supabase auth → profile lookup → business logic via lib/vault/ → Prisma → JSON response.

### `GET /api/vault/status`

**Caller:** Child vault page, child dashboard teaser
**Auth:** Child session
**Action:** Calls `getVaultStatus(profileId)`. Also triggers `checkAndUpdateMilestone` in the background if `last_milestone_check` is > 5 min stale.
**Returns:** `VaultStatus` — current band, credit balance, pending request summary, next milestone targets, current XP / topics / badges
**Fail-closed rule:** If profile not found → 404. If year group not set → return `currentBand: 'none'` with message to complete year group setup.

### `POST /api/vault/check-milestone`

**Caller:** `POST /api/quiz/submit` (non-blocking `void` call after transaction)
**Auth:** Child session OR server role key (for background calls)
**Action:** Calls `checkAndUpdateMilestone`. Idempotent.
**Returns:** `{ changed: boolean, newBand?: string }` — result not shown to child; only used for logging.
**Fail-closed rule:** Any error is logged and ignored — quiz submission is unaffected.

### `POST /api/vault/request`

**Caller:** Child vault page (request form)
**Auth:** Child session
**Validates:**
1. `credit_balance >= 1`
2. No pending request exists (DB enforces; API returns 409 with clear message)
3. `child_message` ≤ 120 chars after trim
4. At least one parent linked (`family_links` check)
5. Monthly request count < `max_requests_per_month`
**Action:** Calls `createRewardRequest`. Decrements `credit_balance` by 1.
**Returns:** Created request row (status only — no parent data leaked to child)
**Fail-closed rule:** Any validation failure → 400 with user-readable message. Never auto-approve.

### `GET /api/vault/parent/requests`

**Caller:** Parent dashboard, parent vault settings page
**Auth:** Parent session
**Returns:** All requests for all linked children. Ordered by `created_at DESC`. Includes evidence block data.
**Fail-closed rule:** Parent can only see requests for children they are linked to (enforced both in query and RLS).

### `POST /api/vault/parent/respond`

**Caller:** Parent dashboard (approve/reject/defer/suggest/mark-fulfilled)
**Auth:** Parent session
**Validates:**
1. Request exists and `child_profile_id` is a linked child of authenticated parent
2. `action` is one of: `approve`, `reject`, `defer`, `counter_offer`, `mark_fulfilled`
3. For `approve`: `reward_type` is `'family'` or `'manual'` (physical blocked in Stage 1)
4. For `reject`: `parent_response_note` is present (required — parent must give a short reason)
5. For `counter_offer`: `parent_response_note` ≤ 280 chars
**Action:** Calls `respondToRequest`. On `reject` or `counter_offer` dismissal: refunds 1 credit to `credit_balance`.
**Returns:** Updated request row
**Fail-closed rule:** Unknown action → 400. Unauthenticated → 401. Wrong parent → 403.

### `GET /api/vault/parent/settings/[childId]`

**Caller:** Parent vault settings page
**Auth:** Parent session
**Action:** Calls `getOrCreateParentSettings`. Creates default row if none exists.
**Returns:** Settings row. `physical_rewards_enabled` is always `false` in Stage 1 even if the DB row says otherwise.

### `PATCH /api/vault/parent/settings/[childId]`

**Caller:** Parent vault settings page
**Auth:** Parent session
**Validates:**
- `family_reward_options`: array ≤ 20 items, each label ≤ 60 chars, sanitised
- `max_requests_per_month`: 0–12
- `physical_rewards_enabled`: ignored and forced to `false` in Stage 1
**Action:** Calls `updateParentSettings`.

### `GET /api/admin/vault/requests`

**Caller:** Admin dashboard vault page
**Auth:** Admin session
**Returns:** All requests across all children with evidence blocks. Supports `status` filter query param.

### `PATCH /api/admin/vault/requests/[id]`

**Caller:** Admin dashboard (Stage 2: fulfilment status updates)
**Auth:** Admin session
**Stage 1 scope:** Only `status → 'cancelled'` with admin note is permitted.
**Stage 2+:** Full fulfilment status machine.

---

## 12. Implementation Sequence

Build in this exact order. Do not skip steps.

### Step 1 — Prisma migration

Write `prisma/migrations/YYYYMMDDHHMMSS_reward_vault_stage1/migration.sql`.

Creates: `vault_milestones`, `child_vault_status`, `vault_parent_settings`, `reward_requests`, `vault_milestone_events`, `reward_catalog` (empty), `reward_fulfilments` (empty).

Adds RLS policies for all new tables.

Run `npx prisma migrate dev` locally and `npx prisma validate`.

Gate: `npx prisma validate` passes. All tables exist. All RLS policies created.

### Step 2 — Seed milestone bands

Write `scripts/seed-vault-milestones.mjs`.

Inserts the 4 milestone rows (bronze/silver/gold/platinum) from §9 values. Idempotent (upsert by `band`). Inserts default `family_reward_options` for existing pilot family parent profiles.

Gate: 4 rows in `vault_milestones`. Each has correct `order_index`, `credits_awarded`, and gate values.

### Step 3 — `lib/vault/milestone-engine.ts`

Pure functions only. No DB calls.

Write unit-testable `computeMilestone` function. Test cases:
- `{ totalPoints: 249, topicsCompleted: 3 }` → band: `'none'` (XP gate fails)
- `{ totalPoints: 250, topicsCompleted: 2 }` → band: `'none'` (topics gate fails)
- `{ totalPoints: 250, topicsCompleted: 3 }` → band: `'bronze'`
- `{ totalPoints: 750, topicsCompleted: 8, badgeCount: 1 }` → band: `'silver'`
- `{ totalPoints: 750, topicsCompleted: 8, badgeCount: 0 }` → band: `'bronze'` (badge gate)
- Year-group safety: `{ topicsCompleted: 3, publishedTopicsForYearGroup: 4 }` with silver requiring 8 → silver unreachable, shows bronze as ceiling

Gate: All test cases pass without any DB connection.

### Step 4 — `lib/vault/status.ts`, `lib/vault/requests.ts`, `lib/vault/settings.ts`, `lib/vault/commerce-adapter.ts`

DB-connected service functions. Follow `lib/parent-dashboard.ts` pattern.

Write in this order:
1. `status.ts` — `getVaultStatus`, `checkAndUpdateMilestone`
2. `requests.ts` — `createRewardRequest`, `respondToRequest`, `markFulfilled`
3. `settings.ts` — `getOrCreateParentSettings`, `updateParentSettings`
4. `commerce-adapter.ts` — interface + `NullCommerceAdapter`

Gate: All functions importable. TypeScript compiles. No circular imports.

### Step 5 — API routes

Write in this order (each route can be done independently):
1. `GET /api/vault/status`
2. `POST /api/vault/check-milestone`
3. `POST /api/vault/request`
4. `GET /api/vault/parent/requests`
5. `POST /api/vault/parent/respond`
6. `GET /api/vault/parent/settings/[childId]`
7. `PATCH /api/vault/parent/settings/[childId]`
8. `GET /api/admin/vault/requests`

Gate: All routes return correct HTTP status for unauthenticated requests (401). All routes return correct HTTP status for wrong-role requests (403).

### Step 6 — Trigger milestone check from quiz submit

In `app/api/quiz/submit/route.ts`, after the Prisma transaction completes:

```typescript
// Non-blocking — never awaited, never throws to client
void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vault/check-milestone`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ profileId: profile.id }),
}).catch((err) => console.error('[vault-milestone-check]', err))
```

Gate: Existing quiz submit tests still pass. New call does not block response.

### Step 7 — Child vault page

Write `app/(child)/vault/page.tsx`.

Server component. Calls `GET /api/vault/status` (or directly calls `getVaultStatus` from lib). Renders milestone band, progress indicators, eligibility state, pending request summary.

Add `app/(child)/vault/RequestModal.tsx` — client component for the request form modal.

Add vault teaser card to `app/dashboard/child/page.tsx` quick-links grid.

Add "Vault" to bottom tab bar in `app/(child)/layout.tsx`.

Gate: Child at Bronze sees "Ask for a reward" button. Child with no milestone sees empty state. Child with pending request sees status. All renders at 375px with no horizontal scroll.

### Step 8 — Parent vault section

Add Vault section to `app/dashboard/parent/page.tsx`. One Vault block per linked child card.

When a request is pending: shows evidence block + response buttons inline.

Add `app/dashboard/parent/vault/[childId]/page.tsx` for settings.

Add `getChildVaultSummary` and `getPendingVaultRequests` to `lib/parent-dashboard.ts` (keeps data layer consistent with existing pattern).

Gate: Parent sees pending request with evidence block. All response actions work. Settings page saves and persists.

### Step 9 — Admin vault view

Add `app/dashboard/admin/vault/page.tsx`.

Calls `GET /api/admin/vault/requests`. Renders sortable table with status filter. Expand row shows evidence block.

Gate: Admin sees all requests across all children. CSV export works.

### Step 10 — Verify script

Write `scripts/verify-reward-vault-safety.mjs`.

20 checks (see §17). Run against staging DB.

Gate: All 20 checks pass on a clean staging environment with pilot data seeded.

---

## 13. Files to Change

### New files

| File | Purpose |
|---|---|
| `prisma/migrations/.../migration.sql` | All new vault tables and RLS policies |
| `lib/vault/milestone-engine.ts` | Pure milestone computation functions |
| `lib/vault/status.ts` | DB-connected milestone status and check |
| `lib/vault/requests.ts` | Request creation and parent response logic |
| `lib/vault/settings.ts` | Parent settings CRUD |
| `lib/vault/commerce-adapter.ts` | Commerce adapter interface + NullCommerceAdapter |
| `lib/vault/admin.ts` | Admin query functions |
| `app/api/vault/status/route.ts` | Child vault status |
| `app/api/vault/check-milestone/route.ts` | Background milestone trigger |
| `app/api/vault/request/route.ts` | Child request submission |
| `app/api/vault/parent/requests/route.ts` | Parent request list |
| `app/api/vault/parent/respond/route.ts` | Parent approval/rejection |
| `app/api/vault/parent/settings/[childId]/route.ts` | Parent vault settings |
| `app/api/admin/vault/requests/route.ts` | Admin request list |
| `app/(child)/vault/page.tsx` | Child vault page |
| `app/(child)/vault/RequestModal.tsx` | Child request form modal (client component) |
| `app/dashboard/parent/vault/[childId]/page.tsx` | Parent vault settings page |
| `app/dashboard/admin/vault/page.tsx` | Admin vault view |
| `scripts/seed-vault-milestones.mjs` | Seed milestone band rows + default settings |
| `scripts/verify-reward-vault-safety.mjs` | Safety verify script (20 checks) |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 7 new models |
| `app/api/quiz/submit/route.ts` | Add non-blocking `void` milestone check call after transaction |
| `app/(child)/layout.tsx` | Add "Vault" entry to bottom tab bar |
| `app/dashboard/child/page.tsx` | Add Vault teaser card to quick-links grid |
| `app/dashboard/parent/page.tsx` | Add Vault section per linked child |
| `lib/parent-dashboard.ts` | Add `getChildVaultSummary`, `getPendingVaultRequests` |
| `app/dashboard/admin/page.tsx` | Add link to `/dashboard/admin/vault` |
| `CLAUDE.md` | Add vault tables to §7, add vault stage docs to §14 |

### Files that must NOT change

| File | Reason |
|---|---|
| `lib/points.ts` | Vault reads XP from DB. Never imports this. |
| `lib/sm2.ts` | Spaced repetition is not a reward signal. |
| `lib/cards.ts` | Card drops are learning system, not vault system. |
| `lib/adaptive.ts` | Content selection is unrelated to vault. |
| `services/content-pipeline/` | Entirely separate system. |
| Any existing migration | Only additive migrations allowed. |

---

## 14. Stage 2 Physical Prize Readiness

Stage 1 schema already creates `reward_catalog` and `reward_fulfilments` tables. They are empty. Stage 2 only requires:

1. Seed `reward_catalog` with admin-curated items
2. Update `app/dashboard/parent/vault/[childId]/page.tsx` to show categories and allow category filtering when approving
3. Unlock `physical_rewards_enabled` toggle in settings (remove the Stage 1 override that forces it to `false`)
4. Update `POST /api/vault/parent/respond` to allow `reward_type: 'physical'` when `physical_rewards_enabled: true`
5. Create `app/dashboard/admin/vault/catalogue/page.tsx` for admin catalogue management
6. Add admin seed script for initial catalogue items

**Stage 1 avoids rework by:**
- Creating `reward_catalog` and `reward_fulfilments` tables in Stage 1 migration
- Keeping `physical_rewards_enabled` as a proper boolean field (not removed) — Stage 2 just unlocks it
- The `NullCommerceAdapter` in `lib/vault/commerce-adapter.ts` is already the right abstraction — Stage 2 uses it for manual fulfilment tracking (no Shopify yet)
- `reward_type: 'physical'` is already a valid value in the `CHECK` constraint — Stage 2 just allows it

---

## 15. Stage 3 Shopify Readiness

### Commerce adapter pattern

The entire Shopify integration fits inside `lib/vault/shopify-adapter.ts` implementing `CommerceAdapter`. No other file changes required.

```typescript
// lib/vault/shopify-adapter.ts
import type { CommerceAdapter, CommerceOrderResult, ApprovedRequest } from './commerce-adapter'

export class ShopifyAdapter implements CommerceAdapter {
  constructor(private readonly shopifyClient: ShopifyAdminClient) {}

  async createOrder(request: ApprovedRequest): Promise<CommerceOrderResult> {
    // POST to Shopify Admin API /draft_orders.json
    // Returns draft order ID
    // Admin activates and sends invoice to parent email via Shopify
  }

  async getOrderStatus(externalOrderId: string): Promise<CommerceOrderStatus> {
    // GET /orders/{id}.json
  }
}
```

At Stage 3, `POST /api/vault/parent/respond` switches from `NullCommerceAdapter` to `ShopifyAdapter` for `reward_type: 'physical'` requests. The route code does not change — only which adapter is injected.

### What data goes to Shopify

| Data | Sent to Shopify? | Reason |
|---|---|---|
| Child name | No | Child is not a commerce participant |
| Child profile ID | As order note only | For admin cross-reference |
| Parent name | Yes (for invoice) | Needed for Shopify draft order |
| Parent email | Yes (for invoice) | Shopify sends invoice to parent |
| Delivery address | No — parent enters in Shopify checkout | Decifer never stores delivery addresses |
| Reward item / variant ID | Yes | Needed to create line item |
| Order value | No — Shopify calculates | |

### Parent-only checkout

The Shopify draft order flow:
1. Admin activates draft order in Shopify admin
2. Shopify sends invoice email to parent (parent email from Decifer auth)
3. Parent follows email link to Shopify checkout (opens in browser, outside app)
4. Parent pays and enters delivery address in Shopify — never in Decifer
5. Shopify fulfils and sends dispatch confirmation to parent email
6. Shopify webhook → `POST /api/shopify/webhook` → updates `reward_fulfilments.status`

The child never sees a Shopify URL. The child never sees a delivery status. The parent sees a one-line status: "Your order is on its way" or "Delivered" — sourced from the `reward_fulfilments` table, not the Shopify webhook raw data.

### New env vars needed in Stage 3 (not needed before)

```
SHOPIFY_ADMIN_API_KEY
SHOPIFY_ADMIN_API_SECRET
SHOPIFY_STORE_DOMAIN        # e.g. decifer-rewards.myshopify.com
SHOPIFY_WEBHOOK_SECRET
```

These should be listed as placeholders in `CLAUDE.md §6` now, with a comment `# Stage 3 only — do not add until Shopify store is live`.

---

## 16. Safety and Trust Rules

These are non-negotiable and must survive every future sprint.

### Child safety

- Children never see prices, payment forms, delivery addresses, or order tracking
- Children never see Shopify, Amazon, or any third-party commerce brand
- Children see only: their milestone status, their request status, parent's message after approval
- No affiliate links anywhere in the child experience
- No targeted advertising based on reward requests or milestone data
- `child_message` is plain text, max 120 chars, sanitised server-side
- Children cannot submit more than `max_requests_per_month` requests per calendar month

### Parent control

- Physical rewards are `disabled by default`. The parent must explicitly enable them in Stage 2.
- Every individual request requires parent review. No auto-approval. No timeouts.
- Parent can reject any request at any time, even after deferring it
- When physical rewards are enabled (Stage 2+), the parent still approves each item individually — budget is a guidance field, not an enforced cap
- Parents can disable the entire Vault for a child by setting `max_requests_per_month: 0`

### Privacy

- `reward_requests` snapshot fields (XP, topics, badges, streak) are immutable after creation
- Delivery addresses are never stored in Decifer at any stage
- Parent email is used only for Shopify invoice (Stage 3) — covered by existing account consent
- GDPR erasure: deleting a child profile cascades to `child_vault_status`, `reward_requests`, `vault_milestone_events`
- `reward_fulfilments` rows for physical orders are retained for financial record-keeping per UK legal requirement (7 years) but child identifiers within them are anonymised after profile deletion

### No manipulation mechanics

- No countdown timers on reward eligibility
- No "you're so close, don't miss out!" urgency copy
- No notifications pushed to children about reward eligibility or expiry
- No peer comparison ("Anika has earned 3 rewards this month")
- No rewards for opening the app, login streaks alone, or card collection
- Rejected requests use positive, forward-looking copy — never shame language

### Commerce isolation

- `lib/vault/` never imports from `lib/points.ts`, `lib/sm2.ts`, `lib/cards.ts`, or `lib/adaptive.ts`
- `lib/vault/commerce-adapter.ts` is never imported by any learning module
- `services/content-pipeline/` is never modified by the Vault implementation
- Shopify adapter (`lib/vault/shopify-adapter.ts`) is only imported by admin vault API routes

---

## 17. Verification Plan

### `scripts/verify-reward-vault-safety.mjs`

20 checks. Run against staging DB before pilot goes live.

**Schema checks (1–5)**
1. `vault_milestones` has exactly 4 active rows with bands: bronze, silver, gold, platinum
2. Each milestone row has `xp_required > 0`, `topics_required > 0`, `credits_awarded >= 1`
3. Milestone `order_index` values are 1, 2, 3, 4 with no duplicates
4. `child_vault_status` has a `credit_balance >= 0` constraint (query `pg_constraint`)
5. Unique partial index exists: `reward_requests_one_pending_per_child`

**RLS checks (6–9)**
6. A child auth session cannot SELECT from `vault_parent_settings`
7. A child auth session cannot SELECT another child's `reward_requests`
8. A child auth session cannot SELECT from `reward_catalog`
9. A child auth session cannot SELECT from `reward_fulfilments`

**Milestone engine checks (10–13)**
10. Profile with 249 XP + 3 topics → `current_band: 'none'` (XP gate fails)
11. Profile with 250 XP + 2 topics → `current_band: 'none'` (topics gate fails)
12. Profile with 250 XP + 3 topics → `current_band: 'bronze'`
13. Profile with 750 XP + 8 topics + 0 badges → `current_band: 'bronze'` (silver requires 1 badge)

**Request flow checks (14–17)**
14. `POST /api/vault/request` with `credit_balance = 0` returns 400
15. `POST /api/vault/request` with `child_message` over 120 chars returns 400
16. `POST /api/vault/request` when pending request already exists returns 409
17. `POST /api/vault/parent/respond` with a non-linked parent's session returns 403

**Credit integrity checks (18–20)**
18. `child_vault_status.credits_earned_total` is ≥ `credits_earned_total - credit_balance` for all rows (no impossible states)
19. No child profile has `credit_balance < 0`
20. No child profile has two `reward_requests` rows with `status = 'pending'` simultaneously

**Gate:** All 20 pass before pilot launch.

---

## 18. Final Implementation Recommendation

### GO

Reward Vault Stage 1 is ready to build. The architecture is sound. The implementation path is defined. The file list is specific. The data model is complete.

### Recommended next sprint

**Sprint name: "Reward Vault Foundation (Stage 1)"**

**Sprint goal:** A linked parent can enable family rewards for their child, the child can reach a milestone and request a reward, the parent can approve it and mark it done, and the admin can see the full activity log.

**Sprint scope exactly:**
- Prisma migration + seed (Steps 1–2)
- Service layer in `lib/vault/` (Steps 3–4)
- All 8 API routes (Step 5)
- Quiz submit trigger (Step 6)
- Child vault page + teaser card + tab bar (Step 7)
- Parent dashboard vault section + settings page (Step 8)
- Admin vault view (Step 9)
- Verify script (Step 10)

**Sprint gate:** `scripts/verify-reward-vault-safety.mjs` passes all 20 checks. At least one complete reward cycle (request → approval → fulfilled) demonstrated with pilot family accounts. No horizontal scroll at 375px on any new page.

**Sprint does not include:** Shopify. Amazon. Email notifications. Physical rewards catalogue. Any deployment configuration changes.

---

*End of Reward Vault Build Plan v1.0*
*Cross-reference: `docs/REWARD_VAULT_ARCHITECTURE.md` for design rationale and safety analysis.*
*Next document to write (at sprint start): implementation sprint task list.*
