# Decifer Learning — Reward Vault Architecture

> **Planning document.** No code changes in this sprint.
> Version 1.0 — 2026-05-24
> Author: Claude Code architecture review
> Status: Draft for review and approval before implementation sprint

---

## 1. Executive Recommendation

**Build the Reward Vault. Proceed cautiously and in phases.**

The Reward Vault is a strong product differentiator, but only if it is built parent-first and learning-first. The core mechanics — verified milestones, parent approval, credit currency separated from XP, family rewards as the default — are sound and achievable within the existing Supabase/Next.js stack.

The MVP (Phase R1) does not require Shopify, Amazon, or any commerce infrastructure. It requires a handful of new database tables, isolated API routes, a lightweight child-facing status panel, and an extended parent dashboard section. All of this is greenfield with no risk to the existing learning loop.

The recommendation is:
- **R0:** Policy and design finalisation (this document + stakeholder review). ~1 week.
- **R1:** Manual pilot, internal family only, family rewards only, no physical commerce. ~3 weeks engineering.
- **R2:** Shopify integration for curated physical catalogue. After R1 has operated for ≥4 weeks cleanly.
- **R3:** Personalised milestone recommendations. Post-community launch.

**Do not rush R1 to R2.** The fulfilment complexity of physical prizes is significant. The family pilot should prove the milestone logic and parent approval flow before introducing commerce.

---

## 2. Product Principle

> **The Reward Vault is a parent-controlled recognition system, not a children's prize shop.**

Every design decision must be traceable to this principle. The test question for any proposed feature is:

> *"Does this put the parent in control of recognition, or does it put the child in control of commerce?"*

If the answer is the latter, reject or redesign.

The child's job is to learn. The Vault's job is to let parents celebrate that learning in a structured, parent-led way. The parent decides what celebration looks like. The child earns eligibility — nothing more.

### Sub-principles

1. **Verified learning events only.** Reward credits accrue from verified topic completions, mastery milestones, and consistent engagement — never from time spent in the app, never from a single data point.

2. **XP and credits are permanently separate.** XP is a motivational signal that must never be "spent." Credits are a separate, milestone-gated unit. Spending credits cannot diminish the child's XP total.

3. **Parent approval is fail-closed.** If the system cannot confirm parent approval, no physical reward can proceed. There is no timeout-to-auto-approve, no grace period.

4. **Family rewards are the primary track.** Physical prizes exist as an optional add-on after explicit parent opt-in. The default Vault experience uses family rewards (experiences, activities, parent-created options).

5. **No child-facing commerce.** No catalogue browsing. No pricing. No delivery addresses. No payment flows. Ever, in any phase.

6. **No gambling mechanics.** No random prize odds. No spin wheels. No mystery boxes. No drop rates for prizes. The child earns a milestone, they become eligible for a parent-configured reward — that's it.

7. **Celebration, not bribery.** The Vault celebrates what the child has already done. It never dangles a prize as motivation before the work is done. Copy, UI, and mechanics must all reinforce this.

---

## 3. Current Repo Findings

### Gamification models

The existing schema has the following relevant models (from `prisma/schema.prisma`):

| Model | Relevance |
|---|---|
| `profiles` | `total_points`, `streak_days`, `last_active` — all key milestone inputs |
| `point_events` | Append-only ledger of XP events with `reason` strings. Clean audit trail. |
| `badge` / `profile_badges` | Badge system with `trigger_rule` JSON. Already idempotent. |
| `topic_progress` | `status='completed'` is the primary mastery signal. Clean and reliable. |
| `quiz_attempts` | `score`, `hearts_remaining`, `created_at` — usable for consistency metrics. |
| `child_missions` | `mission_type`, `target_value`, `current_value` — closest existing pattern to milestone tracking. |
| `streak_shields` | Shows precedent for a separate numeric "currency" distinct from points. |
| `family_links` | Parent-child relationship. Already in place. |
| `parent_controls` | Per-child parent settings. The natural home for Vault settings. |

### XP and points logic

- **Source:** `lib/points.ts`
- **Per-correct-answer:** 10 XP
- **Perfect bonus:** 25 XP (all correct, no hints)
- **Hint deductions:** 2/5/10 from that question's XP
- **Floor:** 0 (never negative from a session)
- **Running total:** `profiles.total_points` updated in the `quiz/submit` transaction

The `point_events` table is an append-only ledger. The `reason` field uses structured strings (`quiz:{topicId}:pass`, etc.). This is a clean audit trail from which milestone computations can be derived.

### Mastery levels (defined in docs/DECIFER_GAMIFICATION_SYSTEM.md §5)

| XP Range | Level | Label |
|---|---|---|
| 0–499 | 1 | Starter |
| 500–1,499 | 2 | Explorer |
| 1,500–3,499 | 3 | Achiever |
| 3,500–7,499 | 4 | Champion |
| 7,500+ | 5 | Master |

These labels are already defined but not yet fully implemented in the UI. The Reward Vault milestone bands should map cleanly to this existing level system.

### Parent dashboard structure

- **Source:** `app/dashboard/parent/page.tsx`, `lib/parent-dashboard.ts`
- Shows linked children, progress summary, weak areas, recommended next lesson.
- Data layer is cleanly separated into `lib/parent-dashboard.ts`.
- Adding a Vault section follows the exact same pattern: new function in `lib/parent-dashboard.ts`, new section in `app/dashboard/parent/page.tsx`.

### Child dashboard structure

- **Source:** `app/dashboard/child/page.tsx`
- Shows XP total, streak, topic list, world map and collection quick links.
- A "Vault" quick-link card fits naturally into the `grid grid-cols-2` quick links section.
- Full Vault panel at `app/(child)/vault/page.tsx` in the child layout.

### Admin dashboard

- **Source:** `app/dashboard/admin/page.tsx`
- Currently a Phase 1 placeholder: "Monitoring tools arrive in Phase 12."
- Phase 12 is the content anomaly detection and pipeline monitoring phase.
- The Reward Vault fulfilment admin panel fits here alongside the Phase 12 monitoring work.

### API route patterns

Existing routes follow a clean pattern: Supabase auth check → profile lookup → Prisma transaction → JSON response. Routes: `POST /api/quiz/submit`, `GET /api/topics/[id]/questions`, `POST /api/streak/check`, `POST /api/family/link`.

The Vault API routes will follow this exact pattern with the same guards.

### Existing verification patterns

`scripts/verify-*.mjs` verify safety constraints against the live DB (content filters, XP math, RLS). New Vault verification scripts will follow the same approach.

---

## 4. Proposed Reward Vault Architecture

### System overview

```
Child completes learning → learning events accumulate →
milestone engine checks gates (server-side, async) →
milestone reached → credits granted to child_vault_status →
child sees "You've reached Silver!" on Vault page →
child optionally submits a reward request (free text or from parent menu) →
request goes to parent →
parent sees evidence block + response options →
parent approves (physical or family reward) →
admin (for physical) or parent (for family) fulfils →
done
```

### Separation of concerns

```
Learning loop (unchanged)         Vault layer (new, isolated)
─────────────────────────         ─────────────────────────────
quiz_attempts                     vault_milestones (static config)
quiz_answers              →  →    child_vault_status (per child)
topic_progress            →  →    vault_credits_ledger
point_events              →  →    reward_requests
profile_badges                    reward_fulfilments
streak_days                       vault_parent_settings
                                  reward_catalog
```

The vault layer only reads from the learning layer. It never writes to it. No vault logic is imported into `lib/points.ts`, `lib/sm2.ts`, `lib/cards.ts`, or `app/api/quiz/submit`.

### Milestone engine

The milestone engine is a pure read function. It reads the current state of the learning tables and determines which milestone bands the child has reached. It is called:
- On dashboard load (child and parent, cached for 5 minutes)
- After `POST /api/quiz/submit` completes (background, non-blocking)
- On demand from `GET /api/vault/status`

The engine does not write to learning tables. It only writes to `child_vault_status` and `vault_credits_ledger`.

---

## 5. Child Journey

### Where the Vault lives

- **Dashboard teaser:** One card in the `grid grid-cols-2` quick-link section: "🏆 My Vault" with current milestone band as subtitle.
- **Full page:** `app/(child)/vault/page.tsx` — reachable from the bottom tab bar and dashboard card.

### What the child sees on the Vault page

```
┌─────────────────────────────────────────────────────┐
│  🏆 Your Reward Vault                                │
│                                                      │
│  You've reached:  ★ Silver Explorer ★                │
│  ╔═══════════════════════════════════════╗           │
│  ║  ████████████████░░░░░░  12 / 20 topics │         │
│  ║  2,150 XP  ·  4-day streak  ·  2 badges │        │
│  ╚═══════════════════════════════════════╝           │
│                                                      │
│  Next milestone: Gold Achiever                       │
│  Complete 8 more topics to unlock →                  │
│                                                      │
│  ─────────────────────────────────────────────       │
│  🎁 Ready to celebrate?                              │
│                                                      │
│  You've earned a reward!                             │
│  [Ask for a reward →]          (button, visible       │
│                                 only if eligible)    │
│                                                      │
│  ─────────────────────────────────────────────       │
│  📬 Recent request                                   │
│  Waiting for Mum to decide...   (status badge)       │
│  Sent 2 days ago                                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Key child-facing rules

- The child **never sees prices**, catalogue items, or shopping UI.
- The child never sees their parent's budget.
- The child's request is a **message to the parent**, not a store transaction.
- If a request is pending, the "Ask for a reward" button is replaced by the status of the pending request.
- If the parent has rejected, the child sees: "Not this time — keep going!" with their next milestone target.
- If approved: "Your reward was approved! [Parent] will sort it out." No tracking number, no shipping ETA shown to child.
- The request form shows a prompt: **"What would you like to celebrate with? Tell [Mum/Dad/Parent]."** — free text, 120 char max. If the parent has pre-configured options, those appear as large tap-target suggestion chips, but the free-text option is always available.
- No hint about what the options are before the parent configures them (avoids pre-seeding desire for specific prizes).

### Request flow (child side)

1. Tap "Ask for a reward →"
2. Simple modal: "Tell [Parent] what you'd like to celebrate." — text field + optional suggestion chips.
3. Confirm button: "Send to [Parent]" — large, no countdown.
4. Confirmation screen: "Sent! [Parent] will decide. Keep learning while you wait."
5. Return to Vault page — button replaced by pending status.

### What the child is NOT shown

- Pricing of any kind
- Category labels (books, toys, etc.) — the parent chooses categories
- Delivery timescales
- Any error or failure from Shopify/fulfilment layer
- Any comparison to other children's vault progress

---

## 6. Parent Journey

### Where Vault settings live

- **Parent dashboard home:** A new "Reward Vault" section card below weak areas, above the link-another-child section.
- **Detailed settings:** `app/dashboard/parent/vault/[childId]/page.tsx`

### Vault section on parent dashboard home

```
┌─────────────────────────────────────────────────────┐
│  🏆 Reward Vault — Anika                             │
│                                                      │
│  Anika has reached: Silver Explorer                  │
│  12 topics mastered · 2,150 XP · 4-day streak       │
│                                                      │
│  ⚡ Pending request                                  │
│  ┌─────────────────────────────────────────────┐    │
│  │  Anika says: "A new colouring book please"  │    │
│  │                                             │    │
│  │  Why she earned it:                         │    │
│  │  ✓ Silver milestone reached (2 days ago)    │    │
│  │  ✓ 12 topics mastered in Maths + English    │    │
│  │  ✓ 4-day streak maintained                  │    │
│  │  ✓ Perfect Score badge earned               │    │
│  │                                             │    │
│  │  [Approve] [Defer] [Suggest alternative]    │    │
│  │  [Not this time]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Vault settings →]                                  │
└─────────────────────────────────────────────────────┘
```

### Approval response options

| Option | What happens |
|---|---|
| **Approve — family reward** | Parent selects a family reward from a pre-set or custom list. No fulfilment needed. Child is notified. |
| **Approve — physical reward** | Only available if physical rewards are enabled. Opens fulfilment flow (MVP: parent manually handles; R2: Shopify draft order). |
| **Suggest an alternative** | Parent types a counter-suggestion ("How about a trip to the science museum instead?"). Sends back to child as a counter-offer. |
| **Defer** | Marks as "saving for later." Child sees "Your parent is deciding." No timeout. |
| **Not this time** | Request is declined. Parent must provide a short reason (1–2 sentences). Child sees a positive reframe. |

### Vault settings page (per child)

```
┌─────────────────────────────────────────────────────┐
│  Reward Vault settings — Anika                       │
│                                                      │
│  ── Physical rewards                                 │
│  [  ] Enable physical rewards                        │
│       (Off by default — family rewards work          │
│        without this setting)                         │
│                                                      │
│  ── Monthly budget (when physical rewards on)        │
│  £ [___] per month                                   │
│  Note: this is your guide — you approve each         │
│  request individually before anything is ordered.   │
│                                                      │
│  ── Allowed categories (when physical rewards on)   │
│  [✓] Books and reading                               │
│  [✓] Art and craft supplies                          │
│  [✓] STEM toys and kits                              │
│  [ ] Sports equipment                                │
│  [✓] Stationery                                      │
│  [ ] Electronics                                     │
│                                                      │
│  ── Family rewards (always available)                │
│  Your family reward ideas:                           │
│  • Movie night (tap to remove)                       │
│  • Bookshop visit (tap to remove)                    │
│  [+ Add your own reward idea]                        │
│                                                      │
│  ── Request limits                                   │
│  Max requests per month: [1] (you can always         │
│  approve or reject — this limits how often           │
│  Anika can ask)                                      │
│                                                      │
│  ── History                                          │
│  [View past rewards →]                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Parent-facing evidence block

Every reward request shown to the parent must include a **verified evidence block** drawn from actual DB data. This is not a narrative generated by the child — it is computed from `topic_progress`, `point_events`, `profile_badges`, and `quiz_attempts`.

Fields shown:
- Topics mastered (count + list by subject)
- XP total when milestone was reached
- Streak at time of request
- Badges earned
- Milestone name and when it was reached
- Days since last reward (if previous rewards exist)

This block cannot be manipulated by the child. It is generated server-side from verified learning events only.

### What parents are NOT shown

- The child's individual quiz question answers
- Comparison to other children
- Any pricing information unless they actively enabled physical rewards
- Shopify order details beyond confirmation status
- Delivery address of other linked parents

---

## 7. Admin Fulfilment Journey

### Where it lives

- `app/dashboard/admin/vault/page.tsx` — within the existing admin dashboard section (Phase 12 area).

### MVP admin fulfilment table

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Reward Vault — Fulfilment Queue                                              │
│                                                                              │
│  Filter: [All] [Approved] [Processing] [Shipped] [Delivered] [Cancelled]    │
│                                                                              │
│  #  │ Child name │ Milestone  │ Request text          │ Type    │ Status     │
│  ───┼────────────┼────────────┼───────────────────────┼─────────┼──────────  │
│  1  │ Anika C.   │ Silver     │ "Colouring book"      │ Physical│ Approved   │
│  2  │ Kiran C.   │ Gold       │ "STEM robotics kit"   │ Physical│ Processing │
│  3  │ Anika C.   │ Bronze     │ "Movie night"         │ Family  │ Completed  │
│                                                                              │
│  [Export CSV]                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Fulfilment status machine

```
approved → processing → ordered → shipped → delivered → completed
    ↓
cancelled  (at any stage before shipped)
    ↓
refunded   (at delivered if dispute)
```

### Admin actions per request

- View full evidence block (same data shown to parent, plus DB IDs for audit)
- Mark as processing / ordered / shipped / delivered
- Add a tracking note (admin-internal, not shown to child or parent)
- Cancel with reason
- Export for accounting

### MVP manual process

During R1 (family pilot), there are no physical rewards. Admin sees only family reward completions, which require no fulfilment action — they are self-closing when the parent marks them done.

During R2 (when Shopify is live), approved physical requests create Shopify draft orders. Admin reviews and activates draft orders in the Shopify admin panel. The Decifer admin panel tracks order status via webhook callbacks from Shopify.

---

## 8. Data Model Proposal

### New tables

#### `vault_milestones` — static configuration, admin-managed

```sql
vault_milestones (
  id                UUID PK
  band              TEXT UNIQUE           -- 'bronze' | 'silver' | 'gold' | 'platinum'
  display_name      TEXT                  -- "Bronze Explorer" etc.
  xp_required       INT                   -- minimum total_points
  topics_required   INT                   -- minimum topic_progress.status='completed' count
  streak_required   INT DEFAULT 0         -- minimum streak_days (0 = not required)
  badges_required   INT DEFAULT 0         -- minimum badge count (0 = not required)
  guardian_required BOOLEAN DEFAULT FALSE -- must have beaten at least one Guardian
  credits_awarded   INT DEFAULT 1         -- credits granted on reaching this milestone
  order_index       INT                   -- 1=bronze, 2=silver, 3=gold, 4=platinum
  is_active         BOOLEAN DEFAULT TRUE
)
```

**Initial data:**

| Band | XP | Topics | Streak | Badges | Guardian | Credits |
|---|---|---|---|---|---|---|
| bronze | 500 | 5 | 3 | 0 | false | 1 |
| silver | 1500 | 12 | 0 | 1 | false | 1 |
| gold | 3500 | 22 | 0 | 2 | true | 1 |
| platinum | 7500 | 40 | 7 | 3 | true | 2 |

Credits are intentionally low (1–2). There should not be a complex credit economy. Each milestone gives a child one opportunity to request a reward. Credits are conceptual — the child never sees a "credit balance" number. They see "You've earned a reward!" or "You haven't reached the next milestone yet."

#### `child_vault_status` — one row per child profile

```sql
child_vault_status (
  profile_id             UUID PK FK → profiles.id
  current_band           TEXT       -- 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'
  current_band_reached_at TIMESTAMPTZ
  credit_balance         INT DEFAULT 0  -- available credits for requesting a reward
  credits_earned_total   INT DEFAULT 0  -- all-time total (audit, never decreases)
  last_milestone_check   TIMESTAMPTZ    -- when the engine last ran
)
```

The `credit_balance` is the only deductable field. When a reward request is approved by the parent, 1 credit is deducted. This means the child can only have one approved request per earned credit. Credits accumulate across milestones, but never at a rate that creates a stockpile — the milestone gates ensure earning rate ≤ 2 per month under realistic conditions.

#### `vault_parent_settings` — one row per (parent, child) pair

```sql
vault_parent_settings (
  id                     UUID PK
  parent_profile_id      UUID FK → profiles.id
  child_profile_id       UUID FK → profiles.id
  physical_rewards_enabled BOOLEAN DEFAULT FALSE
  monthly_budget_pence   INT DEFAULT 0        -- 0 = not set; only guidance, not enforced programmatically
  allowed_categories     TEXT[]               -- e.g. ['books','art','stationery','stem_toys','sport']
  family_reward_options  JSONB DEFAULT '[]'   -- [{label: "Movie night"}, {label: "Bookshop visit"}] etc.
  max_requests_per_month INT DEFAULT 1
  created_at             TIMESTAMPTZ DEFAULT NOW()
  updated_at             TIMESTAMPTZ DEFAULT NOW()

  UNIQUE (parent_profile_id, child_profile_id)
)
```

Default family reward options seeded at creation:
```json
[
  {"label": "Movie night at home"},
  {"label": "Trip to a bookshop"},
  {"label": "Museum or science centre"},
  {"label": "Favourite meal of their choice"},
  {"label": "Extra screen time (30 min)"}
]
```

Parents can add, edit, or remove any of these. Physical rewards require explicit opt-in.

#### `reward_catalog` — admin-curated physical reward options (Phase R2 only)

```sql
reward_catalog (
  id              UUID PK
  name            TEXT
  description     TEXT
  category        TEXT      -- matches allowed_categories values
  min_milestone   TEXT      -- 'bronze' | 'silver' | 'gold' | 'platinum'
  price_pence     INT
  image_url       TEXT
  shopify_variant_id TEXT   -- Phase R2
  is_active       BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

During R1, this table is empty. It is created in the migration but not populated.

#### `reward_requests` — child → parent flow

```sql
reward_requests (
  id                UUID PK
  child_profile_id  UUID FK → profiles.id
  parent_profile_id UUID FK → profiles.id   -- which parent to notify
  milestone_band    TEXT                     -- band at time of request
  xp_at_request    INT                      -- snapshot of total_points
  topics_at_request INT                     -- snapshot of completed topic count
  badges_at_request INT                     -- snapshot of badge count
  streak_at_request INT                     -- snapshot of streak_days
  child_message     TEXT                    -- child's free-text request (max 120 chars)
  credits_used      INT DEFAULT 1
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','deferred','completed','cancelled'))
  parent_response_note TEXT                  -- parent's reply to child (shown child-facing)
  reward_type       TEXT                     -- 'family' | 'physical' | null (set on approval)
  reward_label      TEXT                     -- family: "Movie night"; physical: catalog item name or null
  catalog_item_id   UUID FK → reward_catalog -- Phase R2, null in R1
  created_at        TIMESTAMPTZ DEFAULT NOW()
  responded_at      TIMESTAMPTZ
)
```

**Safety constraints:**
- A child may only have one `status='pending'` request at a time (enforced by unique partial index).
- `child_message` is max 120 characters (enforced at API layer).
- `credits_used` is always 1. The column exists to support future multi-credit options without schema change.
- The snapshot fields (`xp_at_request`, `topics_at_request`, `badges_at_request`, `streak_at_request`) are written at request creation time and are immutable. They form the evidence block the parent sees and cannot be altered by the child after submission.

```sql
CREATE UNIQUE INDEX reward_requests_one_pending_per_child
  ON reward_requests (child_profile_id)
  WHERE status = 'pending';
```

#### `reward_fulfilments` — admin tracking for physical rewards (R2+)

```sql
reward_fulfilments (
  id                UUID PK
  request_id        UUID FK → reward_requests.id UNIQUE
  status            TEXT DEFAULT 'approved'
    CHECK (status IN ('approved','processing','ordered','shipped','delivered','completed','cancelled','refunded'))
  shopify_order_id  TEXT    -- Phase R2
  shopify_order_url TEXT    -- Phase R2, admin-only
  tracking_number   TEXT
  admin_notes       TEXT
  created_at        TIMESTAMPTZ DEFAULT NOW()
  updated_at        TIMESTAMPTZ DEFAULT NOW()
)
```

### Schema integration notes

- All new tables use UUID PKs with `gen_random_uuid()` (matching existing pattern).
- All FKs reference `profiles.id`, not `auth.users` (matching existing pattern).
- `vault_parent_settings` is the Vault equivalent of `parent_controls` — one row per parent-child pair.
- `reward_requests` carries immutable snapshots of learning data at request time. This is intentional: the evidence block must not drift if the child continues learning after making a request.
- `reward_fulfilments` is completely optional in R1 (no physical rewards). The migration creates the table but it remains empty.

### RLS baseline for new tables

| Table | Child read | Child write | Parent read | Parent write | Admin |
|---|---|---|---|---|---|
| `vault_milestones` | Yes (own band only) | No | Yes | No | Full |
| `child_vault_status` | Own row only | No | Own children only | No | Full |
| `vault_parent_settings` | No | No | Own rows only | Own rows only | Full |
| `reward_requests` | Own rows (child_profile_id) | Create only (pending) | Own children's rows | Update status only | Full |
| `reward_catalog` | No (Phase R2: read active items) | No | Read active items | No | Full |
| `reward_fulfilments` | No | No | No | No | Full |

Children can read their own `child_vault_status` row. They cannot read `vault_parent_settings` (no pricing or category information reaches the child). Parents can read and update their own `vault_parent_settings` rows. Parents can read `reward_requests` for their linked children. Parents can update the `status` field of those requests (approval/rejection). Admin has full access to all rows.

---

## 9. API and Service Boundaries

### New API routes

All routes go in `app/api/vault/`.

#### `GET /api/vault/status`

**Called by:** child dashboard, vault page (on load)
**Auth:** child session
**Returns:** current milestone band, credits available, pending request if any, next milestone targets
**Performance:** cached for 5 minutes per profile in Supabase RLS + Next.js caching. Never blocks the quiz loop.

```typescript
// Response shape
{
  currentBand: 'bronze' | 'silver' | 'gold' | 'platinum' | 'none'
  bandReachedAt: string | null
  creditsAvailable: number
  pendingRequest: {
    id: string
    status: 'pending' | 'deferred'
    createdAt: string
    parentResponseNote: string | null
  } | null
  nextMilestone: {
    band: string
    displayName: string
    xpNeeded: number
    topicsNeeded: number
    badgesNeeded: number
    guardianRequired: boolean
  } | null
  currentXP: number
  currentTopicsCompleted: number
  currentBadgeCount: number
  currentStreak: number
}
```

#### `POST /api/vault/check-milestone`

**Called by:** quiz submit route (background, non-blocking) and parent dashboard load
**Auth:** child session OR service role (for background calls)
**Behaviour:** runs the milestone engine, writes to `child_vault_status` and `vault_credits_ledger` if a new milestone is reached. Idempotent. Returns the new band if changed, `null` if unchanged.
**Never blocks quiz submission.** Called via `void milestoneCheck(profileId)` after the quiz transaction completes.

```typescript
// Internal milestone engine inputs (reads from DB)
{
  total_points: number           // profiles.total_points
  topics_completed: number       // COUNT(topic_progress WHERE status='completed')
  badge_count: number            // COUNT(profile_badges)
  streak_days: number            // profiles.streak_days
  guardian_beaten: boolean       // any profile_badge WHERE trigger_rule.type='guardian_win'
}
```

#### `POST /api/vault/request`

**Called by:** child vault page (request form submission)
**Auth:** child session
**Validation:**
- Child has `credit_balance >= 1` in `child_vault_status`
- No `pending` request exists (enforced by unique partial index)
- `child_message` ≤ 120 chars, sanitised
- At least one parent is linked (otherwise error: "Ask a parent to link their account first")
- Parent has not disabled requests (check `vault_parent_settings.max_requests_per_month` against current month count)

**On success:**
- Deducts 1 from `child_vault_status.credit_balance`
- Creates `reward_requests` row with snapshot data
- Sends in-app notification to parent (initially: a flag on the parent dashboard, not email — email in R2)

#### `GET /api/vault/parent/requests`

**Called by:** parent dashboard and parent vault settings page
**Auth:** parent session
**Returns:** pending and recent requests for all linked children

#### `POST /api/vault/parent/respond`

**Called by:** parent dashboard (approve/reject/defer/suggest)
**Auth:** parent session
**Validates:** parent is linked to the child of the request
**Actions:**
- `approve` (family): updates `reward_requests.status='approved'`, sets `reward_type='family'`, `reward_label`, sends notification to child
- `approve` (physical, R2): updates to 'approved', creates `reward_fulfilments` row, initiates Shopify draft order
- `reject`: updates `status='rejected'`, stores `parent_response_note` (shown to child)
- `defer`: updates `status='deferred'` (shown to child as "still deciding")
- `suggest_alternative`: updates `parent_response_note` with counter-suggestion, status stays `pending` (child can revise)

#### `GET /api/vault/parent/settings/[childId]`

Returns `vault_parent_settings` for the given child. Creates default row if not exists.

#### `PATCH /api/vault/parent/settings/[childId]`

Updates `vault_parent_settings`. Validates categories are from the allowed list. Validates budget is a non-negative integer. Validates `family_reward_options` array has ≤ 20 items, each ≤ 60 chars.

#### `GET /api/admin/vault/fulfilments`

Admin-only. Returns all `reward_fulfilments` with joined request and child data.

#### `PATCH /api/admin/vault/fulfilments/[id]`

Admin-only. Updates fulfilment status.

### What the Vault API must NOT do

- Call Anthropic/OpenAI APIs (no LLM calls in the reward path)
- Import from `lib/points.ts`, `lib/sm2.ts`, `lib/cards.ts`, or `lib/adaptive.ts` (one-way dependency: vault reads DB, does not call learning modules)
- Write to any learning table (`topic_progress`, `quiz_attempts`, `point_events`, `profile_badges`)
- Return pricing data to the child session
- Return delivery address data to the child session
- Return another child's data to a child session (RLS enforces this, but also validate at route level)

### Service boundary diagram

```
app/api/quiz/submit   →   writes learning tables   →   (background) POST /api/vault/check-milestone
                                                         writes vault tables only

app/(child)/vault     →   GET /api/vault/status     →   reads vault tables + learning tables (read-only)
                      →   POST /api/vault/request   →   writes reward_requests

app/dashboard/parent  →   GET /api/vault/parent/requests   →   reads reward_requests
                      →   POST /api/vault/parent/respond   →   writes reward_requests + reward_fulfilments

app/dashboard/admin/vault →  GET/PATCH /api/admin/vault/*  →   reads/writes reward_fulfilments
```

---

## 10. Shopify Integration Assessment

**Phase: R2 — not MVP. Build only after R1 has operated cleanly for ≥4 weeks.**

### Architecture

Decifer operates a **private Shopify storefront** with a curated product catalogue. This is not a public shop. Products are hand-selected and admin-approved before appearing in the `reward_catalog` table.

The integration is **Shopify Admin API** (not Storefront API, since there is no child-facing browsing). The flow:

```
Parent approves physical reward →
Admin reviews request in Decifer admin panel →
Admin clicks "Create Shopify order" →
Decifer backend calls Shopify Admin API: POST /admin/api/2024-01/draft_orders.json →
Shopify creates a draft order →
Admin receives email from Shopify to review and activate →
Admin confirms and sends invoice to parent email →
Parent pays via Shopify checkout link (parent-only, never in-app) →
Shopify fulfils order →
Shopify webhook → Decifer /api/shopify/webhook → updates reward_fulfilments.status
```

### What the child sees from Shopify: nothing.

### What the parent sees from Shopify: only an email payment link sent by admin after they approve a request. This is standard Shopify invoice email — no Decifer branding change needed.

### Technical requirements for R2

- Shopify store created with curated product catalogue
- `SHOPIFY_ADMIN_API_KEY` and `SHOPIFY_ADMIN_API_SECRET` added to env (update CLAUDE.md §6)
- `SHOPIFY_WEBHOOK_SECRET` for webhook validation
- `POST /api/shopify/webhook` route in Next.js — validates HMAC, updates `reward_fulfilments`
- `lib/shopify.ts` — isolated Shopify client, imported ONLY by `/api/admin/vault/` routes
- The Shopify client must NOT be imported by any child-facing or learning-adjacent module

### Shopify data minimisation

- Child name: NOT sent to Shopify (use child profile ID as order reference only)
- Delivery address: collected directly by the parent in the Shopify payment flow. Decifer NEVER stores or transmits delivery addresses.
- Parent email: only sent to Shopify for the invoice email. Covered by existing GDPR consent at registration if consent includes third-party service delivery.

### Catalogue management

- All products in the Shopify store are created and curated by Decifer admin
- Products are tagged by category (books, art, stationery, stem_toys, sport)
- Products have a `min_milestone` tag (bronze, silver, gold, platinum)
- Decifer admin script syncs active products from Shopify into `reward_catalog` table
- The sync runs on-demand (not automated in MVP)

### Cost model

Shopify Starter plan ($5/month) is sufficient for draft order + admin API use without a public storefront. No Shopify Payments needed in R1 — draft orders sent as invoices where the parent pays separately. Full Shopify Payments integration is a potential R3 optimisation.

---

## 11. Amazon Assessment

**Status: Parent-only later. Not in any current phase. Not in scope until post-community launch.**

### Why Amazon is excluded from MVP and R2

- Amazon's Associate affiliate programme requires disclosure and has terms around use with minors.
- Amazon links in the parent flow would mean Decifer presents specific products it has not curated, reviewed for safety, or age-verified.
- Amazon does not offer a draft order API equivalent that would let Decifer track fulfilment without the parent leaving the Decifer experience.
- The integration complexity is high with low differentiation vs. the Shopify curated catalogue.

### The only acceptable Amazon use case

A parent-only "bring your own reward" mode where the parent can mark a request as fulfilled via any means they choose (including Amazon) without Decifer being in the fulfilment chain at all. This is a settings option: "I'll handle the reward myself" — no Amazon link, no affiliate link, no URL in the app.

### The absolute prohibition

Amazon links must never appear in the child experience. No link, no product suggestion, no placeholder, at any phase. This is a non-negotiable safety constraint.

---

## 12. Safety, Compliance, and Privacy Guardrails

### UK Children's Code (ICO Age Appropriate Design Code)

The Reward Vault is covered by the existing UK Children's Code compliance obligations of the Decifer platform. Specific Vault implications:

| Standard | Vault implementation |
|---|---|
| Best interests of the child | Rewards celebrate verified learning, not incentivise use/engagement |
| Data minimisation | Snapshot data in `reward_requests` is the minimum needed to show evidence to parent. No behavioural profiles built for reward targeting. |
| Privacy by default | `vault_parent_settings.physical_rewards_enabled = false` by default |
| Geolocation | Not used. Delivery address collected by parent outside the app (Shopify checkout). |
| Profiling | No profiling of child for reward recommendations until R3, and only with explicit parent consent |
| Nudge techniques | No countdown timers on reward eligibility. No "you're so close!" pressure copy. No email/push to child about unclaimed rewards. |
| Parental controls | All physical rewards behind parent approval. Parent can disable physical rewards at any time. Immediate effect. |
| Connected toys | Not applicable. |

### GDPR-K / GDPR Article 8

- Children under 16 in the UK require parental consent for data processing. The existing Decifer registration flow already captures this (parent links child account). The Vault does not introduce new data processing purposes not covered by existing consent.
- The reward evidence block in `reward_requests` is personal data. It must be included in GDPR erasure: deleting a child's profile must cascade to `child_vault_status`, `reward_requests`, and their data within `reward_fulfilments`.

### COPPA (if US expansion ever considered)

Not relevant for the family pilot. Flagged for future: the Reward Vault's parent-controlled architecture is COPPA-compatible by design.

### Stripe / PCI-DSS

The Vault itself handles no payment data. Payment is handled by Shopify checkout (R2) and by parent manual action (R1). Decifer never processes card data.

### Content safety

- `child_message` (the child's reward request text) is free-form input. At API layer: max 120 characters, basic profanity filter on the server-side, stored verbatim, shown to parent only.
- `parent_response_note` is parent-authored. Shown to child. Apply basic content check at API layer.
- No AI-generated text in the Vault flow.

### Age verification

The parent's identity is established by the existing `family_links` mechanism. Physical rewards require the parent to click "Enable physical rewards" in settings — explicit opt-in, not default. This is sufficient as a positive parental consent signal in the MVP context.

### Data retention

- `reward_requests`: retain for 2 years after completion. Included in GDPR erasure.
- `reward_fulfilments`: retain for 7 years (financial records requirement). Redact personal identifiers after 2 years, retain fulfilment metadata.
- `vault_parent_settings`: delete when parent account is deleted or all children are unlinked.
- `child_vault_status`: delete when child profile is deleted.

---

## 13. Fraud and Abuse Prevention

### Threat model

The Vault's threat actors are:
1. A child manipulating the XP/milestone system to get more reward requests than earned
2. A parent accidentally or intentionally approving requests that don't reflect real learning
3. An admin misusing the fulfilment system
4. A compromised child account submitting requests

### Mitigations

#### Milestone gates (multiple independent signals required)

No single signal can unlock a reward band. The multi-factor gate (XP + topic completions + optional badges/streak) means that gaming one signal is not sufficient. The bands are designed so that reaching them requires sustained, cross-topic engagement.

#### Immutable snapshot evidence

`reward_requests` stores `xp_at_request`, `topics_at_request`, `badges_at_request`, `streak_at_request` at creation time. These fields are never updated after creation. If a child somehow had XP reverted (edge case), the historical evidence remains accurate.

#### Server-side milestone verification

`GET /api/vault/status` does not trust the client. It recomputes the milestone band from live DB data on every call. The `child_vault_status` cache is only used for display — the actual credit grant is gated by the server-side engine.

#### One pending request at a time

The unique partial index on `reward_requests (child_profile_id) WHERE status='pending'` prevents a child from flooding the parent with requests. A new request cannot be submitted while one is pending.

#### Monthly request limit

`vault_parent_settings.max_requests_per_month` (default 1). The API checks the current month's request count for the child before allowing a new request.

#### Parent is the final gate

No physical reward can proceed without explicit parent approval. The `POST /api/vault/parent/respond` route verifies that the authenticated user is a linked parent of the child profile in the request. There is no bypass, no timeout-to-approve, no grace period.

#### Admin fulfilment is double-gated

Admin can only act on `reward_requests` with `status='approved'`. Admin cannot create fulfilment records for unapproved requests.

#### Credit balance cannot go negative

`child_vault_status.credit_balance` is decremented on request creation. The API rejects request creation if `credit_balance < 1`. The DB also has a check constraint: `credit_balance >= 0`.

#### No XP exploit via reward path

The vault never writes to `point_events`, `topic_progress`, or any learning table. There is no way to gain XP through the vault flow.

#### Rate limiting

All Vault write endpoints (`POST /api/vault/request`, `POST /api/vault/parent/respond`) are rate-limited: 10 requests per minute per authenticated session. Existing Next.js middleware handles this.

#### Audit log

`point_events` (existing) provides an immutable XP audit trail. A similar append-only `vault_events` log can be added in R2: every milestone reached, every credit granted, every request created, every parent response — all appended with timestamp and actor. In R1, the immutable fields in `reward_requests` plus `child_vault_status` provide sufficient audit.

---

## 14. Phased Rollout Plan

### Phase R0 — Policy and design (current document)

**Duration:** ~1 week
**Deliverables:**
- This architecture document reviewed and approved
- Milestone band thresholds agreed with stakeholders (the thresholds in §8 are proposals)
- Family reward option list agreed
- Decision on which parent email notification approach to use (in-app flag only for R1, email in R2)
- CLAUDE.md §6 env var list updated to include future Shopify keys (as placeholders)
- Verification plan written (see §16)
- Go / No-go decision

**Gate:** Stakeholder sign-off on milestone thresholds, privacy guardrails, and child UX principles.

### Phase R1 — Manual pilot (family only, family rewards only)

**Duration:** ~3 weeks engineering, then ≥4 weeks pilot operation
**Scope:**
- Prisma migrations for all new tables (vault_milestones, child_vault_status, vault_parent_settings, reward_requests, reward_catalog (empty), reward_fulfilments (empty))
- Seed `vault_milestones` with four bands
- Seed default `vault_parent_settings` for linked family accounts
- `GET /api/vault/status`, `POST /api/vault/check-milestone`, `POST /api/vault/request`
- `GET /api/vault/parent/requests`, `POST /api/vault/parent/respond`
- `GET /api/vault/parent/settings/[childId]`, `PATCH /api/vault/parent/settings/[childId]`
- Child vault page (`app/(child)/vault/page.tsx`)
- Parent vault section on dashboard + settings page
- Admin vault table in admin dashboard (read-only in R1, no fulfilment actions needed since all rewards are family rewards)
- Verify scripts (see §16)
- **No Shopify.** `physical_rewards_enabled` defaults false and enforcement is locked in R1.
- Family pilot: two children (Year 3 and Year 7) use the app. Parents respond to real requests.

**Gate:**
- ≥1 family reward request successfully submitted, approved, and marked completed by a parent
- Zero credit-balance errors, zero double-request errors
- Admin can see request history accurately
- Parent can disable the vault entirely and child sees graceful empty state
- All verify scripts pass

**Rollback:** Disable the Vault link from child dashboard (feature flag: `vault_enabled` column in `vault_parent_settings`, default false). All vault tables remain in DB — no destructive rollback.

### Phase R2 — Shopify integration for physical rewards

**Duration:** ~2 weeks engineering, preceded by Shopify store setup
**Scope:**
- Create Shopify store with initial curated product catalogue (books, STEM kits, art supplies)
- `lib/shopify.ts` — Shopify Admin API client, imported only by admin vault routes
- Admin vault: "Create Shopify draft order" button
- `POST /api/shopify/webhook` — validates HMAC, updates `reward_fulfilments.status`
- `reward_catalog` seeded from Shopify product sync script
- Parent settings: enable `physical_rewards_enabled` toggle + category selection
- Budget guidance field (informational only, not programmatically enforced)
- Update CLAUDE.md §6 with Shopify env vars

**Gate:**
- One end-to-end physical reward: child requests → parent approves → admin creates Shopify draft order → parent pays → delivery tracked → marked completed
- Shopify webhook updates fulfilment status correctly
- Child never sees Shopify, prices, or delivery details

### Phase R3 — Personalised milestone recommendations

**Duration:** ~1 week
**Scope:**
- Add "personalised next steps" to the Vault page: "You're 2 topics away from Silver — here's what to focus on."
- Derived from existing `topic_progress` and `curriculum_outcomes` data
- No new AI calls. Pure database query + display logic.

**Gate:** Recommendations are accurate and based on verified data only.

---

## 15. Files Likely to Change in a Future Implementation Sprint

### New files

| File | Purpose |
|---|---|
| `prisma/migrations/YYYYMMDDHHMMSS_reward_vault/migration.sql` | All new vault tables |
| `lib/vault.ts` | Milestone engine, credit logic, status queries |
| `lib/shopify.ts` | Shopify Admin API client (R2 only) |
| `app/api/vault/status/route.ts` | Child vault status endpoint |
| `app/api/vault/check-milestone/route.ts` | Milestone engine trigger |
| `app/api/vault/request/route.ts` | Child reward request submission |
| `app/api/vault/parent/requests/route.ts` | Parent request list |
| `app/api/vault/parent/respond/route.ts` | Parent approval/rejection |
| `app/api/vault/parent/settings/[childId]/route.ts` | Parent vault settings |
| `app/api/admin/vault/fulfilments/route.ts` | Admin fulfilment list (R2) |
| `app/api/admin/vault/fulfilments/[id]/route.ts` | Admin fulfilment update (R2) |
| `app/api/shopify/webhook/route.ts` | Shopify webhook handler (R2) |
| `app/(child)/vault/page.tsx` | Child vault UI |
| `app/dashboard/parent/vault/[childId]/page.tsx` | Parent vault settings UI |
| `app/dashboard/admin/vault/page.tsx` | Admin fulfilment table |
| `scripts/seed-vault-milestones.mjs` | Seeds vault_milestones table |
| `scripts/verify-reward-vault-safety.mjs` | Vault safety verify script |
| `docs/REWARD_VAULT_ARCHITECTURE.md` | This document |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 6 new models (vault_milestones, child_vault_status, vault_parent_settings, reward_requests, reward_catalog, reward_fulfilments) |
| `app/api/quiz/submit/route.ts` | Add `void checkMilestone(profile.id)` call after transaction (non-blocking) |
| `app/(child)/layout.tsx` | Add "Vault" to bottom tab bar |
| `app/dashboard/child/page.tsx` | Add "🏆 My Vault" quick-link card |
| `app/dashboard/parent/page.tsx` | Add Vault section per child |
| `lib/parent-dashboard.ts` | Add `getChildVaultStatus()` and `getChildPendingRequests()` functions |
| `app/dashboard/admin/page.tsx` | Add link to vault fulfilment section |
| `CLAUDE.md` | Add vault env vars (SHOPIFY_*) to §6, add vault tables to §7, document R0–R3 phases |

### Files that must NOT change

| File | Reason |
|---|---|
| `lib/points.ts` | Vault never modifies XP logic |
| `lib/sm2.ts` | Vault has no spaced repetition logic |
| `lib/cards.ts` | Card drops are not part of vault |
| `lib/adaptive.ts` | Content selection is not part of vault |
| `services/content-pipeline/` | Pipeline is for content generation, not rewards |
| Any Prisma migration already merged | Only additive migrations allowed |

---

## 16. Verification and Test Plan

### Verify scripts (to write alongside R1 implementation)

Following the project's existing `scripts/verify-*.mjs` pattern:

#### `scripts/verify-reward-vault-safety.mjs`

Checks (in order):

1. `vault_milestones` table exists and has exactly 4 active rows (bronze/silver/gold/platinum)
2. Each milestone has `xp_required > 0`, `topics_required > 0`, `credits_awarded >= 1`
3. `child_vault_status.credit_balance >= 0` for all rows (no negative balances)
4. No child profile has two `reward_requests` rows with `status='pending'` simultaneously
5. All `reward_requests` rows have non-null `xp_at_request`, `topics_at_request`, `badges_at_request`, `streak_at_request`
6. All `reward_requests` rows with `status='approved'` have a non-null `reward_type`
7. No child session can read `vault_parent_settings` (RLS check via anon key)
8. No child session can read `reward_fulfilments` (RLS check)
9. No child session can read another child's `reward_requests` (RLS check)
10. `POST /api/vault/request` returns 400 when `credit_balance = 0`
11. `POST /api/vault/request` returns 400 when `child_message.length > 120`
12. `POST /api/vault/request` returns 400 when a pending request already exists
13. `POST /api/vault/parent/respond` returns 403 when the authenticated user is not a linked parent of the request's child
14. `POST /api/vault/parent/respond` with `status='approved'` and `reward_type='physical'` is rejected when `physical_rewards_enabled=false`
15. Milestone engine correctly computes `bronze` band for a profile with ≥500 XP and ≥5 completed topics
16. Milestone engine does NOT compute `bronze` band for a profile with 499 XP and 5 topics (XP gate fails)
17. Milestone engine does NOT compute `bronze` band for a profile with 500 XP and 4 topics (topic gate fails)
18. `GET /api/vault/status` returns `nextMilestone: null` for a profile at platinum band
19. `vault_parent_settings` row is created with `physical_rewards_enabled=false` when first fetched
20. Deleting a child profile cascades to `child_vault_status` and `reward_requests` (GDPR erasure check)

**Pass gate:** All 20 checks green before R1 goes to pilot.

### Manual test plan

#### Child journey (manual tester: child session)

1. Start with a fresh child profile (0 XP, 0 topics)
2. Vault page shows "No milestone yet" + progress indicators pointing to Bronze
3. Complete 5 topics, accumulate 500+ XP
4. Vault page updates: "You've reached Bronze!"
5. "Ask for a reward" button becomes visible
6. Submit a request ("New book please")
7. Button is replaced by "Waiting for parent to decide"
8. Attempt to submit a second request → UI blocks it (button not shown)

#### Parent journey (manual tester: parent session)

1. Open parent dashboard
2. Vault section shows child has made a request + evidence block (XP, topics, badges, streak)
3. Tap "Approve — family reward"
4. Select "Bookshop visit" from the list
5. Child's vault page updates: "Your reward was approved! Your parent will sort it out."
6. Parent vault history shows one completed reward
7. Test Defer: defer a request → child sees "still deciding"
8. Test Reject: reject with a note → child sees positive reframe message
9. Toggle physical rewards off → verify child cannot request physical reward (button not visible even if eligible)

#### Admin journey (manual tester: admin session)

1. Open admin dashboard → vault section
2. See all requests for all children (R1: family rewards only)
3. Verify evidence block matches what parent saw
4. Mark a completed reward → status changes to 'completed'
5. Attempt to create a fulfilment for a 'pending' (not yet approved) request → blocked

#### Edge cases to test

- Child with no linked parent submits request → informative error: "Ask a parent to link their account"
- Parent tries to approve request for a child they are not linked to → 403
- Two browser sessions try to create a request for the same child simultaneously → one succeeds, one gets 400 (unique partial index)
- Child's `credit_balance` is 0 but milestone band is not 'none' (e.g., they already spent the credit) → "Ask for a reward" button not shown, informative message: "You've already requested a reward for this milestone — keep going for the next one!"

---

## 17. Open Questions

The following decisions are outstanding and should be resolved in Phase R0 before implementation begins:

1. **Milestone threshold values:** The proposed values (500 XP / 5 topics for Bronze, etc.) are estimates based on expected engagement pace. These should be validated against actual pilot data from the existing family pilot before being locked in. Is a child likely to hit Bronze in week 2 or week 6? The thresholds should feel earned but not discouraging.

2. **Parent notification mechanism:** For R1, the Vault shows a badge/indicator on the parent dashboard when a request is pending. Is push notification (via browser push or email) needed for R1, or can the parent discover it on their next dashboard login? Email notification would require a transactional email provider (e.g., Resend or Postmark) — not currently in the stack.

3. **Multi-parent households:** `reward_requests` currently notifies one parent (the first linked parent). If two parents are linked to the same child, which receives the request? Should both receive it? Who can approve? This edge case needs a policy decision.

4. **Credits not expiring:** The current proposal says credits do not expire. This means a child who reaches Bronze but never requests a reward accumulates a credit indefinitely. Is this acceptable? Alternatively, credits could expire after 90 days with a parent-visible notification.

5. **Counter-offer UX:** The "Suggest an alternative" flow (parent counter-proposes, child can revise) is described but the child's UI for receiving and responding to a counter-offer is not fully designed. This needs a wireframe before R1 implementation.

6. **Year-group-specific milestone thresholds:** Should a Year 3 child have lower milestone thresholds than a Year 7 child? Year 3 Maths has fewer available topics in MVP. If `topics_required=5` but only 4 topics are published for Year 3, the bronze gate is unreachable. The milestone engine should check `published topics for year group` and not apply a gate that is impossible to meet.

7. **Guardian requirement for Gold/Platinum:** The Guardian quiz is currently only available when all zone topics are complete. If the content pipeline has not produced enough published questions for a Guardian to be available, the Gold/Platinum gates requiring a Guardian win are unreachable. Consider making `guardian_required` an admin-adjustable setting per band.

8. **Physical reward catalogue curation:** Who curates the Shopify catalogue? What is the price range ceiling? What categories are excluded (no electronics above £X, no explicit media, etc.)? This needs an editorial policy before R2.

9. **Budget guidance enforcement:** The current proposal says `monthly_budget_pence` is informational only (not enforced by code). Is there an expectation that the system should block approvals that exceed the budget? If yes, define the enforcement logic carefully: does the budget reset on the 1st of each month? What if approval and delivery cross a month boundary?

10. **Deletion cascade for `reward_fulfilments`:** GDPR erasure requires deleting child personal data. But `reward_fulfilments` may need to be retained for financial records (7 years). Define the exact erasure policy: does deletion anonymise the child identifier but retain the fulfilment record? Or is the 7-year retention period waived for family pilot (small scale, no financial transaction)?

---

## 18. Final Recommendation

### GO — with clear phase boundaries and the constraints listed below

**Proceed to Phase R0 (design finalisation and stakeholder review) immediately.**

**Do not start R1 implementation until:**
- All 17 open questions above have answers (or explicit "defer to later" decisions)
- Milestone thresholds validated against pilot data or agreed as provisional
- Multi-parent policy decided
- Parent notification approach decided (in-app vs. email)

**Do not start R2 (Shopify) until:**
- R1 has operated for at least 4 weeks with at least 1 successful family reward cycle
- Physical reward catalogue is curated and reviewed for age-appropriateness
- Editorial policy for catalogue is written
- Shopify store is created and tested independently

**Hard constraints that must survive the implementation sprint:**

| Constraint | How to enforce |
|---|---|
| No vault logic in quiz submit transaction | Code review gate: `lib/vault.ts` must not be imported by `app/api/quiz/submit/route.ts` |
| No child-facing pricing | RLS: child session cannot read `reward_catalog.price_pence` or `vault_parent_settings.monthly_budget_pence` |
| No approval bypass | Unique partial index + server-side parent-link validation in `/api/vault/parent/respond` |
| No negative credit balances | DB check constraint: `child_vault_status.credit_balance >= 0` |
| Physical rewards default off | `vault_parent_settings.physical_rewards_enabled DEFAULT FALSE` in schema |
| No Amazon links | Code review gate: no `amazon.co.uk` or `amzn.to` URLs in any source file |
| Vault verify script must pass | Pre-R1-pilot gate |

**Why this is worth building:**

The Reward Vault is a meaningful differentiator. Parent trust is the hardest product problem in EdTech. A system that lets parents recognise and celebrate their child's real learning achievements — in a controlled, transparent, parent-led way — directly addresses the concern that gamification turns learning into a dopamine farm. Done right, it makes parents allies in the engagement loop, not bystanders.

The technical risk is low. The tables are simple. The API surface is small. The learning loop is entirely unchanged. The only complexity is the Shopify integration, which is properly deferred.

The product risk, if the design principles are violated, is high. The constraints in this document exist to prevent the Vault from becoming a prize shop. Enforce them at every stage.

**The system is ready to build. The principles are sound. Proceed.**

---

*End of Reward Vault Architecture Document v1.0*
*Next step: stakeholder review of open questions in §17, then R1 implementation sprint.*
