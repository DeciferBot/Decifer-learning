# Reward Vault — Stage 1.4 Pilot Evidence

Pilot-polish and live-test readiness sprint. Resolves all three non-blockers from Stage 1.3.

---

## Section A — Changes made

### A1. Counter-offer state polish (NB-1 resolved)

**File:** `app/dashboard/parent/vault/[childId]/RespondButtons.tsx`

Added `status: string` prop. When `status === 'counter_offered'`, the component now renders a
waiting-state card instead of the four action buttons:

> **Waiting for [child name]**
> [Child name] can accept or dismiss your suggestion from their Reward Vault page.

Parent action buttons (Approve / Save for later / Suggest different / Decline) are not rendered
in this state. The API remains fail-closed — any direct POST with a parent action against a
`counter_offered` request still returns 422.

### A2. Human-readable status labels (NB-2 resolved)

**Files:** `app/dashboard/parent/vault/[childId]/page.tsx`, `app/dashboard/parent/page.tsx`

Replaced all `status.replace('_', ' ')` display calls with a typed label map:

| DB status | Label shown to parent |
|---|---|
| `pending` | Waiting for parent |
| `deferred` | Deferred |
| `counter_offered` | Waiting for child |
| `approved` | Approved — to give |
| `rejected` | Declined |
| `cancelled` | Withdrawn |
| `completed` | Done ✓ |

Labels used on:
- Active request status badge on parent vault detail page
- Pending request status badge on parent dashboard summary section

### A3. Standing parent entry point (NB-3 resolved)

**File:** `app/dashboard/parent/page.tsx`

Each child card footer now carries a standing **Reward Vault** link alongside the existing
"View full report →". It links to `/dashboard/parent/vault/[childId]` and is always visible
regardless of whether a request is pending.

If the child has one or more active requests, a small count badge is shown next to the link.
No credit balance, no money language, no prize/shopping framing.

---

## Section B — Verification results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✓ Clean |
| `npm run lint` | ✓ Clean |
| `npm run build` | ✓ Clean (40 routes) |
| `node scripts/verify-reward-vault-safety.mjs` | ✓ 25/25 |
| `node scripts/verify-reward-cycle.mjs` | ✓ 30/30 (5 new checks C26–C30) |

New checks added:

| ID | Description |
|---|---|
| C26 | RespondButtons renders waiting state for `counter_offered` — not action buttons |
| C27 | `counter_offered` status shows polished "Waiting for child" label in both parent pages |
| C28 | Parent dashboard has standing Reward Vault entry point using `child.profileId` |
| C29 | Stage 1.4 parent UI files contain no forbidden commerce strings |
| C30 | Parent vault UI uses label maps — no raw `status.replace` calls for display |

---

## Section C — Safety confirmation

- [x] No physical catalogue
- [x] No payments
- [x] No delivery
- [x] No Shopify (C29 verified)
- [x] No Amazon (C29 verified)
- [x] No child-facing commercial language (C24 verified)
- [x] Parent approval remains fail-closed — API unchanged, only UI improved
- [x] Fulfilment does not alter XP, learning, points, or milestone progress (C19 verified)

---

## Section D — Remaining non-blockers

None. All three Stage 1.3 non-blockers are resolved.

---

## Section E — Files changed

| File | Change |
|---|---|
| `app/dashboard/parent/vault/[childId]/RespondButtons.tsx` | Added `status` prop; waiting-state card for `counter_offered` |
| `app/dashboard/parent/vault/[childId]/page.tsx` | `ACTIVE_STATUS_LABELS` map; passes `status` to `RespondButtons` |
| `app/dashboard/parent/page.tsx` | `VAULT_STATUS_LABELS` map; destructures `vault`; standing vault link per child card |
| `scripts/verify-reward-cycle.mjs` | Checks C26–C30 added (30/30 total) |

---

**Verdict: GO for live family reward-cycle test.**

*Stage 1.4 — Pilot polish complete.*
