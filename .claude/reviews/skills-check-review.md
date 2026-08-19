# Review: Skills Check, end to end

**Reviewed**: 2026-08-19
**Scope**: everything shipped in PRs #96, #98, #100, #102 — the engines, the API, the pages, and the live behaviour.
**Decision**: fixes applied; four findings, all in code I wrote.

## Summary

The engine half holds up. The findings are all in the parts that only exist once
the thing is running: what happens when content changes underneath a live check,
what an endpoint does when it is replayed, and what an email actually looks like
in an inbox. Three of the four were invisible until the feature ran against
production.

## Findings

### HIGH

**1. A retired question was hidden from the child but still marked wrong.**
`lib/skills-check/server.ts`

`startAttempt` filters out any item whose question has since been retired, so
the child is never shown it. `submitAttempt` then looped over *every* item in the
check, so that same question was scored as an unanswered wrong answer. A child
would lose a mark for a question that was never on their screen, and a whole
strand could drop a verdict because of it.

*Fixed*: `submitAttempt` applies the same published-only filter, so it scores
only what was served. `strandVerdict` already scales its cut points for a short
strand, so a four-item strand is judged proportionally rather than harshly.

**2. The unlock endpoint would send an email on every replay.**
`app/api/skills-check/unlock/route.ts`, `lib/skills-check/server.ts`

One finished token could be posted with any number of different addresses, and
each one sent mail from our domain. The per-IP rate limit does not stop a
distributed replay. The report is harmless content so this is not a phishing
vector, but it is a quick way to wreck a sending reputation.

*Fixed*: two layers. `unlockReport` now reports whether the address is actually
new to this attempt, and the route only sends when it is — which also stops a
reload sending a parent a second copy. On top of that, a per-token cap of three
unlocks an hour.

### MEDIUM

**3. The report email never sent at all.** (Shipped as PR #102.)
`app/api/skills-check/unlock/route.ts`

`void sendSkillsCheckReport(...)` on Vercel: the function is frozen the moment
it returns a response, so the promise never completed. The unlock returned 200,
the report unlocked correctly on the page, and Resend had no record of the send.

*Fixed*: awaited. Measured at 1.3s for the whole unlock request, and confirmed
by finding the email in Resend afterwards rather than by trusting the 200.

*The same pattern is in three other routes* — the parent "big moment" emails in
`app/api/quiz/submit` and `app/api/guardian/[zoneId]/submit`, which have
therefore probably never sent either. Those are a child's hot path and
`lib/parent-notify.ts` explicitly optimises for adding no latency there, so a
blind `await` is the wrong fix. They want `waitUntil`. Raised separately rather
than changed in passing.

### LOW

**4. The email subject read as two sentences jammed together.**
`lib/skills-check/email.ts`

A real inbox showed "Working below Year 4 maths. Your child's Year 4 maths
check" — the year and subject twice, and a full stop in the middle.

*Fixed*: leads with what the email is, then the finding.

## Checked and found fine

- **The gate.** Verified on production: before the email, the result page HTML
  contains no verdicts, no next steps and no score. It is enforced in
  `getAttemptView`, so there is nothing for a CSS or devtools trick to reveal.
- **Answer leakage.** The `/start` payload carries question text and options and
  nothing else. Marking is server-side.
- **Token guessability.** Attempt tokens are database-generated UUIDs.
- **Published-only reads.** Every content query filters `status = 'published'`,
  and a check must also have `is_published`. An unpublished check 404s.
- **`noindex`** on result and delete pages; neither is in the sitemap.
- **The delete link** does not act on GET, so a mail scanner cannot delete
  somebody's report, and it reports honestly when there was nothing to delete.
- **Idempotent submit.** A second submission returns the stored result.

## Known limits, not fixed

- **Rate limiting is in-memory**, so on serverless it is per-instance and weaker
  than it looks. This is the existing pattern across the repo
  (`lib/rate-limit.ts`), and changing it belongs in its own piece of work.
- **`lib/skills-check/server.ts` and `build.ts` have no unit tests.** Both are DB
  glue over logic that is fully tested, and both were exercised end to end
  against production. The pure modules carry 125 tests.
- **Anyone with a result link can attach their own email** and receive the
  report. The link is the secret, and the report contains nothing that
  identifies a child.

## Validation

| Check | Result |
|---|---|
| Type check | Pass |
| Lint | Pass |
| Brand-hex guardrail | Pass |
| Tests | Pass — 125 |
| Live flow on production | Pass — start, submit, gate, unlock, email, delete |
