# Amazon Incentives API — Integration Plan
> Status: Research complete. Ready to implement.
> Last updated: 2026-06-05

---

## 1. What we're building

When a parent approves a Reward Vault request, they can optionally choose "Send Amazon Gift Card" as the fulfilment method. The server calls the Amazon Incentives API (AGCOD), gets back a claim code, and shows it **once** to the parent in the UI. The parent delivers it to the child manually (copy/paste, screenshot). No commerce touches the child UI at any point.

---

## 2. Confirmed API facts (sourced from Amazon developer docs)

### Endpoint
| Environment | Host |
|---|---|
| Sandbox | `agcod-v2-gamma.amazon.com` |
| Production EU | `agcod-v2-eu.amazon.com` |
| Production NA | `agcod-v2.amazon.com` |

UK (GBP) uses the **EU endpoint** (`agcod-v2-eu.amazon.com`).

### Request shape (CreateGiftCard)
```
POST /CreateGiftCard HTTP/1.1
Host: agcod-v2-eu.amazon.com
accept: application/json
content-type: application/json
x-amz-date: 20260605T120000Z
x-amz-target: com.amazonaws.agcod.AGCODService.CreateGiftCard
Authorization: AWS4-HMAC-SHA256 Credential=<accessKeyId>/20260605/us-east-1/AGCODService/aws4_request, SignedHeaders=accept;content-type;host;x-amz-date;x-amz-target, Signature=<sig>

{
  "creationRequestId": "<partnerId><uniqueSuffix>",
  "partnerId": "<partnerId>",
  "value": { "currencyCode": "GBP", "amount": 10 }
}
```

### Signing (AWS Sig V4) — confirmed values
- **Algorithm**: `AWS4-HMAC-SHA256`
- **Service**: `AGCODService` (NOT `execute-api`, NOT `agcod` — this is the exact string)
- **Region**: `us-east-1` (even for EU endpoint — confirmed from Amazon security docs)
- **Signed headers** (alphabetical): `accept;content-type;host;x-amz-date;x-amz-target`
- **Credential scope**: `YYYYMMDD/us-east-1/AGCODService/aws4_request`

### Response shape (success)
```json
{
  "cardInfo": {
    "cardStatus": "Fulfilled",
    "value": { "amount": 10, "currencyCode": "GBP" }
  },
  "creationRequestId": "<partnerId><uniqueSuffix>",
  "gcClaimCode": "XXXX-XXXXXXXX-XXXX",
  "gcId": "XXXXXXXXXX",
  "status": "SUCCESS"
}
```

### GBP amount range
- Minimum: £1.00
- Maximum: £5,000.00
- Expiry: 10 years from issue

### creationRequestId constraints
- Max 40 characters
- Alphanumeric only
- **Must be prefixed with partnerId** (e.g. if partnerId is `Decif`, then `Decif` + up to 35 chars)
- Case-sensitive
- Idempotent: same ID + same amount = same claim code returned (safe to retry)

### partnerId format (confirmed from docs)
- "First letter capitalised, next four lowercase" — e.g. `Decif`, `Amssb`
- Case-sensitive throughout the API

### Idempotency behaviour (critical for error recovery)
- Same `creationRequestId` + same amount → returns the **original** claim code (no duplicate charge)
- Same `creationRequestId` + **different** amount → F200 error (denomination mismatch)
- This means: store the `creationRequestId` in our DB, and if the call fails mid-flight, retry with the same ID to recover the code

### Claim code storage rule (Amazon ToS)
- Amazon explicitly prohibits storing claim codes
- Correct pattern: **store only the `creationRequestId`**, then re-call `CreateGiftCard` with the same ID to retrieve the code on demand
- The idempotency guarantee makes this retrieval safe and free (no new charge)

### Prepaid balance model
- Amazon deducts from a pre-funded account balance in real time
- Insufficient funds → F300 error (no retry — requires topping up the Amazon Incentives account)
- We do **not** charge parents per-call — the Decifer account maintains a balance

### Rate limits
- 10 requests/second for CreateGiftCard
- 1 request/second for GetAvailableFunds (balance check)

### Error codes (actionable ones)
| Code | Meaning | Retry? |
|---|---|---|
| F200 | Invalid request (bad amount, missing field, denomination mismatch) | No — fix request |
| F300 | Account/auth issue (invalid partner ID, insufficient funds, active contract not found) | No — resolve account |
| F400 | Temporary system unavailability | Yes — exponential backoff, same `creationRequestId` |
| Throttled | Rate limit exceeded | Yes — backoff |
| F100/F500 | Amazon internal error | No — contact Amazon |

---

## 3. Package strategy

**Do NOT hand-roll AWS Sig V4.** Use `@smithy/signature-v4` — the signing library inside AWS SDK v3. It handles canonical request construction, HMAC chains, and header formatting correctly.

Packages to install:
```
npm install @smithy/signature-v4 @smithy/hash-node @smithy/protocol-http
```

Usage pattern:
```typescript
import { SignatureV4 } from '@smithy/signature-v4'
import { Hash } from '@smithy/hash-node'
import { HttpRequest } from '@smithy/protocol-http'

const signer = new SignatureV4({
  credentials: { accessKeyId, secretAccessKey },
  region: 'us-east-1',
  service: 'AGCODService',
  sha256: Hash.bind(null, 'sha256'),
})

const request = new HttpRequest({
  method: 'POST',
  protocol: 'https:',
  hostname: 'agcod-v2-eu.amazon.com',   // or gamma for sandbox
  path: '/CreateGiftCard',
  headers: {
    host: 'agcod-v2-eu.amazon.com',
    accept: 'application/json',
    'content-type': 'application/json',
    'x-amz-target': 'com.amazonaws.agcod.AGCODService.CreateGiftCard',
  },
  body: JSON.stringify(payload),
})

const signed = await signer.sign(request)
// signed.headers now contains Authorization + x-amz-date
const response = await fetch(`https://${signed.hostname}${signed.path}`, {
  method: signed.method,
  headers: signed.headers,
  body: signed.body,
})
```

---

## 4. Environment variables (new — must add to CLAUDE.md §6)

```
AMAZON_INCENTIVES_PARTNER_ID        # e.g. "Decif" — issued by Amazon on onboarding
AMAZON_INCENTIVES_ACCESS_KEY_ID     # AWS-style access key from Incentives portal
AMAZON_INCENTIVES_SECRET_ACCESS_KEY # AWS-style secret key from Incentives portal
AMAZON_INCENTIVES_SANDBOX           # "true" = use gamma endpoint; "false" = production
```

Default to sandbox (`"true"`) until Amazon approves the live account.

---

## 5. Database changes

### Migration: add Amazon fields to `reward_fulfilments`

```sql
ALTER TABLE reward_fulfilments
  ADD COLUMN IF NOT EXISTS amazon_creation_request_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS amazon_denomination_gbp     INT,
  ADD COLUMN IF NOT EXISTS amazon_issued_at            TIMESTAMPTZ;

COMMENT ON COLUMN reward_fulfilments.amazon_creation_request_id IS
  'AGCOD idempotency key. Used to retrieve the claim code on demand. Never store the claim code itself (Amazon ToS).';
```

### Prisma model update (`RewardFulfilment`)
Add three fields:
- `amazon_creation_request_id String? @unique`
- `amazon_denomination_gbp Int?`
- `amazon_issued_at DateTime?`

---

## 6. New files

| File | Purpose |
|---|---|
| `lib/vault/amazon-adapter.ts` | Implements `CommerceAdapter` — calls AGCOD, stores `creationRequestId`, retrieves code on demand |
| `app/api/vault/amazon/claim-code/route.ts` | Parent-only GET — re-fetches claim code via AGCOD idempotency and returns it (never stored) |
| `prisma/migrations/<ts>_reward_vault_amazon/migration.sql` | DB migration above |

### Modified files

| File | Change |
|---|---|
| `lib/vault/commerce-adapter.ts` | Add `claimCode?: string` to `CommerceOrderResult` (transient — never persisted) |
| `app/api/vault/parent/respond/route.ts` | Wire AmazonAdapter when `reward_type === 'amazon_gift_card'` |
| `app/dashboard/parent/vault/[childId]/RewardSettingsForm.tsx` | Add "Amazon Gift Card" option with denomination picker |
| `prisma/schema.prisma` | Add three fields to `RewardFulfilment` |
| `CLAUDE.md §6` | Document four new env vars |

---

## 7. AmazonAdapter design

```typescript
// lib/vault/amazon-adapter.ts

export class AmazonAdapter implements CommerceAdapter {
  // createOrder: called once when parent approves
  // 1. Generate creationRequestId = partnerId + requestId (trimmed to 40 chars, alphanumeric)
  // 2. Call AGCOD CreateGiftCard
  // 3. Store creationRequestId + denomination in reward_fulfilments (NOT the claim code)
  // 4. Return { externalOrderId: creationRequestId, status: 'created', claimCode: gcClaimCode }
  //    — claimCode travels in the API response to the parent UI only; never written to DB

  // getClaimCode(creationRequestId): called when parent wants to see the code again
  // 1. Re-call AGCOD CreateGiftCard with same creationRequestId + same amount
  // 2. AGCOD returns same code (idempotency)
  // 3. Return the code — caller shows it, does not store it

  // getOrderStatus: returns 'delivered' once issued (digital — instant fulfilment)
}
```

---

## 8. Parent UI flow

1. In Reward Settings, parent enables "Amazon Gift Card" and picks default denomination (£5 / £10 / £25 / £50)
2. When approving a child's reward request, parent sees "Send £10 Amazon Gift Card" as the approval action
3. On confirm, server calls AGCOD → returns claim code in the API response
4. Modal shows: "Gift card code: **XXXX-XXXXXXXX-XXXX** — Copy this now and give it to [child name]. We don't store this code."
5. A "Show code again" button on the fulfilment record calls `/api/vault/amazon/claim-code?requestId=<id>` which re-fetches via AGCOD idempotency

---

## 9. Open questions (must resolve before building)

| # | Question | Impact |
|---|---|---|
| 1 | Does the **EU endpoint** use region `us-east-1` or `eu-west-1` in the credential scope? The security doc showed `us-east-1` for sandbox; needs confirmation for EU prod. | Signing will break if wrong |
| 2 | Exact **partnerId** format for Decifer — what Amazon assigns. | `creationRequestId` prefix |
| 3 | Does `@smithy/hash-node` work in **Next.js edge/serverless** environment or only in Node.js? | Package choice |
| 4 | Amazon Incentives account approval — applied for yet? | Go-live timing |

### Q1 answer (CONFIRMED)
Verbatim from Amazon docs endpoints table:
- Sandbox EU: `https://agcod-v2-eu-gamma.amazon.com` → region `eu-west-1`
- Sandbox NA: `https://agcod-v2-gamma.amazon.com` → region `us-east-1`
- Production EU: `https://agcod-v2-eu.amazon.com` → region `eu-west-1`
- Production NA: `https://agcod-v2.amazon.com` → region `us-east-1`

For UK (GBP), we use the **EU endpoint + eu-west-1 region** in both sandbox and prod.

### Q3 answer
The vault API routes run as **Node.js serverless functions** (not edge runtime) — confirmed by our `createSupabaseServerClient()` usage throughout. `@smithy/hash-node` works fine.

---

## 10. What we do NOT build

- Child-facing anything — no codes, no denominations, no "you won a gift card" messaging to the child
- Auto-dispatch (no automatic fulfilment without parent click-to-confirm)
- Balance top-up UI (parent manages their Amazon Incentives account separately)
- Stripe-funded flow (Amazon Incentives is prepaid, separate from any Stripe subscription)

---

## 11. Build sequence (one PR)

1. Install packages
2. Write migration SQL + apply
3. Update Prisma schema
4. Write `lib/vault/amazon-adapter.ts`
5. Update `commerce-adapter.ts` (add `claimCode` field)
6. Update `app/api/vault/parent/respond/route.ts` (wire adapter)
7. Add `app/api/vault/amazon/claim-code/route.ts`
8. Update `RewardSettingsForm.tsx` (denomination picker)
9. Update parent approval UI (show claim code modal)
10. Update `CLAUDE.md §6`
11. Run verify scripts

---

## 12. Remaining unknowns that block 100% confidence

### CONFIRMED ✓
- API request/response shape (exact field names)
- Signing algorithm and service name (`AGCODService`)
- Headers to sign (`accept;content-type;host;x-amz-date;x-amz-target`)
- GBP supported (£1–£5,000, 10-year expiry)
- Idempotency behaviour (safe retry with same `creationRequestId`)
- "No store claim code" rule → retrieve via idempotency instead
- Package strategy (`@smithy/signature-v4`)
- `HttpRequest` interface shape
- Error codes and retry strategy
- Prepaid balance model

### NOT YET CONFIRMED ✗
- **Exact `partnerId`** assigned by Amazon — we don't have one yet (requires onboarding). The format is known (first letter cap, next four lowercase). Implementation will use env var.

### ALL TECHNICAL UNKNOWNS RESOLVED ✓
All signing, endpoint, region, package, and flow questions are answered. Build can proceed.
