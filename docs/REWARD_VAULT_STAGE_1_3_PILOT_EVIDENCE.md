# Reward Vault — Stage 1.3 Pilot Evidence

Static code review complete. Live walkthrough fields are marked **[TESTER FILLS]**.

---

## Section A — Static code review (completed before live walkthrough)

### A1. Files reviewed

| File | Status |
|---|---|
| `app/(child)/vault/page.tsx` | ✓ Reviewed |
| `app/(child)/vault/RequestSection.tsx` | ✓ Reviewed |
| `app/dashboard/parent/vault/[childId]/page.tsx` | ✓ Reviewed |
| `app/dashboard/parent/vault/[childId]/RespondButtons.tsx` | ✓ Reviewed |
| `app/dashboard/parent/vault/[childId]/FulfillButton.tsx` | ✓ Reviewed |
| `app/dashboard/parent/vault/[childId]/RewardSettingsForm.tsx` | ✓ Reviewed |
| `app/dashboard/parent/page.tsx` | ✓ Reviewed |
| `app/api/vault/request/route.ts` | ✓ Reviewed |
| `app/api/vault/parent/respond/route.ts` | ✓ Reviewed |
| `app/api/vault/parent/fulfill/route.ts` | ✓ Reviewed |
| `app/api/vault/parent/settings/[childId]/route.ts` | ✓ Reviewed |
| `lib/vault/requests.ts` | ✓ Reviewed |
| `lib/vault/status.ts` | ✓ Reviewed |
| `lib/vault/milestone-engine.ts` | ✓ Reviewed |
| `lib/vault/settings.ts` | ✓ Reviewed |
| `lib/vault/commerce-adapter.ts` | ✓ Reviewed |
| `lib/parent-dashboard.ts` (vault functions) | ✓ Reviewed |
| `scripts/verify-reward-vault-safety.mjs` | ✓ Reviewed |
| `scripts/verify-reward-cycle.mjs` | ✓ Reviewed |
| `scripts/seed-vault-milestones.mjs` | ✓ Exists |

### A2. Verification results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✓ Clean |
| `npm run lint` | ✓ Clean |
| `npm run build` | ✓ Clean (40 routes) |
| `node scripts/verify-reward-vault-safety.mjs` | ✓ 25/25 |
| `node scripts/verify-reward-cycle.mjs` | ✓ 25/25 (was 24, C25 added) |

### A3. Child-facing language check

Words searched across `app/(child)/vault/page.tsx` and `app/(child)/vault/RequestSection.tsx`:

| Forbidden word | Present? |
|---|---|
| wallet | ✗ Not present |
| spend | ✗ Not present |
| price | ✗ Not present |
| cost | ✗ Not present |
| payment | ✗ Not present |
| delivery | ✗ Not present |
| address | ✗ Not present |
| credit balance (as display) | ✗ Not present |
| N credits (numeric) | ✗ Not present |
| buy / shop / purchase | ✗ Not present |

### A4. Access control review

| Control | Status |
|---|---|
| Parent-only: approve / reject / defer / counter_offer | ✓ Enforced in `respondToRequest` — isParent check |
| Child-only: accept_counter / dismiss_counter | ✓ Enforced in `respondToRequest` — isChild check |
| Fulfill: parent-only | ✓ `getUserRole(user) !== 'parent'` → 403 |
| Admin queue: admin-only | ✓ `getUserRole(user) !== 'admin'` → 403 |
| Parent-child link verified | ✓ `familyLink.findFirst` before any action |
| Unauthenticated access | ✓ All routes return 401 if no session |

### A5. Blocker found and fixed

**Blocker:** `respondToRequest` in `lib/vault/requests.ts` only allowed parent transitions
from `pending` status. A `deferred` request fell into the `else` catch-all and threw
`INVALID_TRANSITION: Request in status 'deferred' cannot be updated`.

The pilot checklist (Part 3, steps 22 → 25) explicitly tests:
- Step 22: Parent taps "Save for later" → status: `deferred`
- Step 25: Parent taps "Suggest different" while request is `deferred`

Step 25 would have failed with a 422 error before this fix.

**Fix applied:** `lib/vault/requests.ts` — transition guard now covers both
`pending` and `deferred` status for parent-initiated actions.

**Verify check added:** `C25` in `scripts/verify-reward-cycle.mjs` — confirms this
transition is structurally present in future runs.

---

## Section B — Live walkthrough record

To be completed by the human tester during the family pilot session.
Fill in each field. Mark each step pass ✓ or fail ✗.

### B1. Accounts used

| Field | Value |
|---|---|
| Child account email | **[TESTER FILLS]** |
| Child year group | **[TESTER FILLS]** |
| Parent account email | **[TESTER FILLS]** |
| Accounts linked before test? | **[TESTER FILLS — Yes / No]** |
| Fast-path milestone grant used? | **[TESTER FILLS — Yes / No]** |

### B2. Content used

| Field | Value |
|---|---|
| Topic used to reach milestone | **[TESTER FILLS — or "fast-path SQL grant"]** |
| Milestone band reached | **[TESTER FILLS — Bronze / Silver / Gold / Platinum]** |
| Credit balance shown to child | **[TESTER FILLS — expected: 1]** |

### B3. Step-by-step walkthrough

**Part 1 — Child view: checking progress**

| Step | Description | Result |
|---|---|---|
| 1 | Child logs in | **[✓ / ✗]** |
| 2 | Child taps Reward Vault | **[✓ / ✗]** |
| 3 | Page loads, milestone band shows | **[✓ / ✗]** |
| 5 | Three stats (XP, topics done, badges) visible | **[✓ / ✗]** |
| 6 | No "wallet / spend / price / cost / payment" on page | **[✓ / ✗]** |

**Part 2 — Child sends a reward request**

| Step | Description | Result |
|---|---|---|
| 7 | "Reward earned" badge and "Ask for a reward" button visible | **[✓ / ✗]** |
| 9 | Modal shows "What would you like?" and suggestion chips | **[✓ / ✗]** |
| 11 | Tap "Send Request" | **[✓ / ✗]** |
| 12 | Success message appears | **[✓ / ✗]** |
| 13 | Status card shows "Waiting for parent" | **[✓ / ✗]** |
| 14 | "Ask for a reward" button no longer visible | **[✓ / ✗]** |

**Part 3 — Parent responds**

| Step | Description | Result |
|---|---|---|
| 17 | Parent dashboard shows "🎁 Reward Vault" section with child name | **[✓ / ✗]** |
| 18 | "Respond →" link present | **[✓ / ✗]** |
| 19 | Parent vault page shows Reward Request card | **[✓ / ✗]** |
| 20 | Four buttons: Approve / Save for later / Suggest different / Decline | **[✓ / ✗]** |
| 21 | "How rewards work" section visible | **[✓ / ✗]** |
| 22 | Tap "Save for later" | **[✓ / ✗]** |
| 24 | Child device: status shows "Saved for later" | **[✓ / ✗]** |
| 25 | Parent taps "Suggest different" (from deferred state — blocker was fixed) | **[✓ / ✗]** |
| 26 | Parent types suggestion, taps "Send Suggestion" | **[✓ / ✗]** |
| 27 | Child: status shows "Parent has a suggestion" | **[✓ / ✗]** |
| 28 | Child: two buttons "Accept ✓" and "No thanks" visible | **[✓ / ✗]** |
| 29 | Child taps "No thanks" — pending card disappears, "Ask for a reward" returns | **[✓ / ✗]** |

**Part 4 — Full approve and mark done**

| Step | Description | Result |
|---|---|---|
| 31 | Child sends new request | **[✓ / ✗]** |
| 32 | Parent taps "✓ Approve" | **[✓ / ✗]** |
| 33 | Parent enters reward label | **[✓ / ✗]** |
| 36 | History shows "Approved — to give" with note | **[✓ / ✗]** |
| 37 | "✓ Mark as done" button visible | **[✓ / ✗]** |
| 38 | Parent taps "✓ Mark as done" | **[✓ / ✗]** |
| 39 | Confirmation prompt "Mark as given?" appears | **[✓ / ✗]** |
| 40 | Parent taps "Yes, done" | **[✓ / ✗]** |
| 41 | History item shows "Done ✓", button gone | **[✓ / ✗]** |
| 42 | Child: pending card gone, "Ask for a reward" not visible (credit used) | **[✓ / ✗]** |

**Part 5 — Decline (credit refund check)**

| Step | Description | Result |
|---|---|---|
| 43 | Child sends another request | **[✓ / ✗]** |
| 44 | Parent taps "✗ Decline" | **[✓ / ✗]** |
| 46 | Parent taps "Confirm Decline" | **[✓ / ✗]** |
| 47 | Child: pending card gone, "Ask for a reward" returns (credit restored) | **[✓ / ✗]** |
| 48 | Parent history shows "Declined" | **[✓ / ✗]** |

**Part 6 — Edit family reward ideas**

| Step | Description | Result |
|---|---|---|
| 50 | Parent taps "Edit ideas" | **[✓ / ✗]** |
| 51 | Edit form appears with current ideas and Remove links | **[✓ / ✗]** |
| 52 | Remove one idea, add a new one, tap Save | **[✓ / ✗]** |
| 53 | List updates | **[✓ / ✗]** |
| 54 | Child modal shows new idea as suggestion chip | **[✓ / ✗]** |

### B4. Key safety checks (pass/fail during walkthrough)

| Check | Expected | Result |
|---|---|---|
| Credit balance goes negative | ✗ Must not happen | **[✓ / ✗]** |
| Two pending requests at once | ✗ Must not happen | **[✓ / ✗]** |
| Declined request — credit restored | ✓ Button reappears | **[✓ / ✗]** |
| Counter-offer dismissed — credit restored | ✓ Button reappears | **[✓ / ✗]** |
| Approved — "Mark as done" visible | ✓ In history | **[✓ / ✗]** |
| Fulfilled — "Done ✓" shown, button gone | ✓ | **[✓ / ✗]** |
| "wallet / spend / price / cost / payment" visible to child | ✗ Must not appear | **[✓ / ✗]** |
| Note > 280 characters typed | ✗ Input capped | **[✓ / ✗]** |

### B5. Copy and clarity observations

| Area | Observation |
|---|---|
| Child vault page copy | **[TESTER FILLS — any confusing words or unclear labels]** |
| Parent vault page copy | **[TESTER FILLS — any confusing words or unclear labels]** |
| Status labels (Waiting for parent / Saved for later / Parent has a suggestion) | **[TESTER FILLS]** |
| Parent response buttons (Approve / Save for later / Suggest different / Decline) | **[TESTER FILLS]** |
| History section ("Approved — to give" / "Done ✓" / "Declined") | **[TESTER FILLS]** |

### B6. Known non-blockers (observed during code review)

These do not need to block the pilot. Note if you observed them during the walkthrough.

| # | Description | Observed? |
|---|---|---|
| NB-1 | When a request is `counter_offered`, the parent vault page still shows all four action buttons (Approve / Save for later / Suggest different / Decline). Any tap returns an API error. The parent should simply wait for the child to respond during this state. | **[Yes / No / N/A]** |
| NB-2 | The status badge on the active request card in the parent vault page shows raw `counter offered` (space-separated, first-letter capitalised). Readable but not styled copy. | **[Yes / No / N/A]** |
| NB-3 | Parent dashboard "Reward Vault" section is only visible when a pending/deferred/counter_offered request exists. If no request is pending, the section is hidden. This is by design but the parent has no standing prompt to visit the vault page. | **[Yes / No / N/A]** |

---

## Section C — Final verdict

| Field | Value |
|---|---|
| All 54 walkthrough steps passed | **[TESTER FILLS — Yes / No]** |
| Blockers found during live test (beyond NB-1 to NB-3) | **[TESTER FILLS — none / describe]** |
| Non-blockers found during live test | **[TESTER FILLS — none / describe]** |
| **Verdict** | **[TESTER FILLS — GO / GO WITH NON-BLOCKERS / NO-GO]** |
| Signed off by | **[TESTER FILLS — initials and date]** |

---

## Section D — Safety confirmation (static — pre-filled)

Confirmed by code review and passing verifier:

- [x] No physical catalogue
- [x] No payments
- [x] No delivery
- [x] No Shopify (verified: `verify-reward-vault-safety.mjs` checks 17 and 18)
- [x] No Amazon (verified: check 19)
- [x] No child-facing commercial language (verified: checks 21, C24)
- [x] Parent approval remains fail-closed (verified: checks 05, 08, 16, C12)
- [x] Fulfilment does not alter XP, learning, points, or milestone progress (verified: checks 12, 13, C19)
- [x] Physical rewards explicitly blocked at API level (verified: check 22)

---

*Stage 1.3 — Pilot evidence. Static section completed. Live walkthrough section ready for family test.*
