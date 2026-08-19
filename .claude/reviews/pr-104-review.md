# PR Review: #104 — fix(emails): parent big-moment emails never sent on Vercel

**Reviewed**: 2026-08-19
**Author**: Claude (self-review, requested by Amit)
**Branch**: claude/inspiring-turing-9d8474 → main (merged as 723ce99, deployed to production)
**Decision**: APPROVE the code change, REQUEST CHANGES on its documentation

## Summary

The code change is correct and an improvement. The reasoning written into the commit
message, PR body, and source comments was overstated, and the dependency footprint was
misreported. Both are now corrected in a follow-up.

## Findings

### CRITICAL
None.

### HIGH

**1. The stated root cause was wrong, and it is written into permanent code comments.**
`lib/parent-notify.ts`, `app/api/quiz/submit/route.ts`, `app/api/guardian/[zoneId]/submit/route.ts`

The claim was that on Vercel a bare `void promise` "never runs to completion". Production
data contradicts it. The PLI learning-event block in `quiz/submit` used the same `void`
and wrote 64 rows. Correlating `quiz_attempts` against `learning_events` by profile and
timestamp:

| Month | Quiz attempts | Events landed | % |
|---|---|---|---|
| 2026-06 | 82 | 55 | 67% |
| 2026-07 | 1 | 1 | 100% |
| 2026-08 | 1 | 0 | 0% |

June is the only month with real traffic. So `void` is a **race**, not a guaranteed
failure: roughly one submit in three lost its background work. That still fully justifies
the fix — `first_win` fires once per child ever, so a one-in-three loss rate means a real
chance of losing the only email that matters — but "never runs" is not what the evidence
says. Comments corrected.

### MEDIUM

**2. `waitUntil` fails silently if the request context is absent — and this is unverified
in production.** `node_modules/@vercel/functions/wait-until.js`

```js
return getContext().waitUntil?.(promise);   // getContext() returns {} when absent
```

`getContext()` reads `globalThis[Symbol.for("@vercel/request-context")]`. If Vercel does
not inject that symbol for Next 14.2.35 App Router route handlers, the optional call
no-ops and the promise is dropped exactly as before — but now with a comment claiming it
is fixed. Next 14.2.35's own dist never references the symbol; the injection would come
from Vercel's runtime wrapper. Vercel docs name `@vercel/functions` as the supported path
for "older Next.js versions", so this is very likely fine, but it is documented-not-proven.

**Open risk. Resolved by the same production test that verifies the email** — a quiz submit
now writes a `quiz_completed` learning event through `waitUntil`, so if that row appears,
the context is live.

### LOW

**3. Dependency footprint misreported.** `package-lock.json`

Reported to Amit and in the PR body as "one transitive dep `@vercel/oidc`". The lockfile
actually added **17 packages**, including `execa` (a child-process spawner), `@vercel/cli-exec`,
`@vercel/cli-config`, `zod`, `jose`, `xdg-app-paths`.

Mitigating: `@vercel/functions/index.js` does not require `./oidc` — that is a separate
subpath export — so none of `execa`/`jose`/`zod` reaches the server bundle. The runtime cost
is `wait-until.js` plus `get-context.js`, a few lines. Install-time and supply-chain surface
only. Not worth reverting, but the number should have been stated correctly.

## Verified correct

- All three `waitUntil` arguments are promises, so the `TypeError` guard cannot fire.
- Every wrapped promise handles its own rejection (`notifyParentBigMoment` try/catch,
  `checkAndUpdateMilestone` `.catch`, PLI block try/catch). No unhandled rejections.
- `waitUntil` does not throw when called with no context, so local dev and vitest are safe.
- Cron routes re-checked: no fire-and-forget, they await.

## Validation Results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass |
| Lint (`next lint`) | Skipped — pre-existing worktree ESLint config conflict, unrelated |
| Tests (`vitest run`) | Pass — 519 tests, 31 files |
| Build (`next build`) | Fail locally — Prisma `EMAXCONNSESSION pool_size: 15` prerendering skills-check/curriculum. Known local-build trap, unrelated. Vercel's own production build passed. |

## Files Reviewed

- `app/api/quiz/submit/route.ts` — Modified
- `app/api/guardian/[zoneId]/submit/route.ts` — Modified
- `lib/parent-notify.ts` — Modified
- `package.json`, `package-lock.json` — Modified

## Still open

A live send is unverified. Create a child linked to `amit@decifer.io` and complete one
topic; that single action verifies the email, and the `quiz_completed` row verifies
finding #2.
