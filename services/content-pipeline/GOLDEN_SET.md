# Golden-Set Regression Harness

A **golden set** is a fixed bank of known-good and known-bad content items that
must always pass / fail the pipeline's deterministic Stage-2 verifiers. It is a
regression tripwire: a prompt change, a model swap, a verifier refactor, or a
dependency bump can never silently degrade the quality gate without a golden
item flipping and turning the build red.

It guards the **deterministic** half of the pipeline only — Stage 2 code
verification (`maths` / `physics` / `chemistry` / `english`), the part that is
supposed to be reproducible with zero LLM involvement (CLAUDE.md §4.2, §9). The
LLM stages (RAG generation, consensus, constitutional critique) are
intentionally *not* covered here: they are non-deterministic and require network
calls, so they cannot be a pure regression bank.

## Files

| File | Role |
|---|---|
| `tests/golden/golden_items.json` | The bank. ~34 items spanning every verifier type. |
| `tests/golden/test_golden_set.py` | Parametrised pytest — one test case per item. |
| `../../scripts/verify-pipeline-golden.py` | CI / pre-deploy gate — exits non-zero on any regression. |

## Running it

```bash
# As pytest (one case per item, pinpoints regressions by id):
python3 -m pytest services/content-pipeline/tests/golden/test_golden_set.py -v

# As the CI / pre-deploy gate (exit 0 clean, 1 = regression, 2 = setup error):
python3 scripts/verify-pipeline-golden.py

# With the full pipeline venv so pint/chempy/languagetool cases also run
# (locally these SKIP if the dep is absent — they never fail):
services/content-pipeline/.venv/bin/python3 scripts/verify-pipeline-golden.py
```

Both are **pure and offline** — they import the verifier modules directly and
make no Anthropic / OpenAI / network calls.

### Dependency skips (not failures)

Some verifiers need an external dependency: physics needs **pint**, chemistry
equation-balancing needs **chempy**, and english grammar/phonics/comprehension
need a live **LanguageTool** (`language_tool_python`). When a dependency is
absent the corresponding golden items are **skipped, never failed** — matching
the existing english verifier suite, which degrades gracefully when LanguageTool
is unavailable. The maths verifier has no external deps, so its golden items
always run.

> Note on LanguageTool: when LanguageTool is *down*, the english verifier
> returns a graceful pass, which would let a bad grammar item through. The
> harness therefore only runs `languagetool`-tagged items when LanguageTool can
> actually be instantiated (`english._lt_available`). CI must install
> LanguageTool to exercise those items rather than silently skipping them.

## Adding a golden item

Append an object to the `items` array in `golden_items.json`:

```jsonc
{
  "id": "math-arith-good-new-case",   // stable unique slug — NEVER reuse an id
  "verifier": "maths",                 // maths | physics | chemistry | english
  "expect_pass": true,                 // true = must verify True; false = must be rejected
  "requires": ["pint"],                // optional: pint | chempy | languagetool
  "note": "why this case is in the bank",
  "question_data": {                   // exact dict passed to verifier.verify()
    "question_type": "maths_arithmetic",
    "verification_expression": "7 * 8",
    "correct_answer": "56"
  }
}
```

Rules:
- **Keep answers code-checkable** — no item should depend on an LLM or network.
  The verifier must be able to confirm/reject the answer deterministically.
- **`question_data` must match the real verifier contract.** Mirror the field
  shapes the verifier reads (see each verifier's `verify()` dispatcher and inline
  `_run_tests()`): e.g. `verification_expression` for maths/physics,
  `verification_equation` + `verification_variable` for algebra,
  `question_metadata.{instruction_text,stimulus_text,intentional_error_span}`
  for english grammar/phonics, `question_metadata.{element,property}` for
  `chemistry_element_fact`.
- **Tag external-dep cases with `requires`** so they skip cleanly where the dep
  is missing.
- **Add both directions** for any new verifier type — at least one good item and
  one bad item. The `test_golden_set_has_good_and_bad_per_verifier` guard
  enforces this.
- Run the gate after editing; a typo in `question_data` shows up immediately.

---

# Alerting plan for the unattended nightly pipeline

The pipeline runs unattended overnight. Nobody is watching the logs, so failures
must **page by email**. Target inbox: **chopraa@gmail.com**.

## (a) The nightly cron chain

Vercel Cron routes (`vercel.json` → `app/api/cron/*`), all gated by `CRON_SECRET`:

| Time (UTC) | Route | Action |
|---|---|---|
| 02:00 | `app/api/cron/anomaly-detect/route.ts` | Flag questions with high error rate / high hint-3 rate → `status='flagged'` (CLAUDE.md §9). |
| 03:00 | `app/api/cron/regenerate-flagged/route.ts` | Fire pipeline `/pipeline/regenerate-flagged-all?cap=150` to re-run flagged questions through the 6 stages. |
| 04:00 | `app/api/cron/oak-refresh/route.ts` | Refresh Oak National Academy source chunks. |

Each route returns JSON and logs to the Vercel function logs; each already
fails fast with a non-2xx status on a missing secret / missing
`PIPELINE_SERVICE_URL` / pipeline error (see the `try/catch` + `console.error`
in `regenerate-flagged/route.ts`).

## (b) Signals that should alert

| Signal | Where it surfaces | Severity |
|---|---|---|
| **Cron route failed** (non-2xx, threw, or pipeline returned 5xx) | `catch` block already `console.error`s in each `app/api/cron/*` route | page |
| **Zero items published in a regeneration run** | pipeline `/pipeline/regenerate-flagged-all` response body (`published` count == 0 while `flagged` > 0) | page |
| **Error-rate / failure spike** | `generation_errors` row count for the run, or anomaly-detect flagging an unusually large batch in one night | page |
| **Golden-set regression** | `scripts/verify-pipeline-golden.py` exit code 1 in CI / pre-deploy (deterministic gate changed) | block deploy + page |
| Run produced fewer than expected published items (degraded, not zero) | run summary | digest/warn |

The golden-set signal is the **pre-deploy** guard (it runs in CI, not nightly);
the other four are **nightly runtime** guards.

## (c) Concrete low-effort mechanism (existing Resend integration)

`RESEND_API_KEY` is already configured and Resend is already imported in
`app/api/cron/weekly-digest/route.ts` and `app/api/cron/parent-verify/route.ts`
(and `lib/parent-verification.ts`). Reuse it for failure alerts — no new env var,
no new dependency.

**Exact hook point.** In each `app/api/cron/*` route, the failure path is
already isolated in a `catch` block that calls `console.error(...)`. Add one
`sendPipelineAlert(...)` call alongside that `console.error`, plus a check on the
pipeline response body for the "zero published" case. A single shared helper
keeps it DRY:

```ts
// lib/pipeline-alert.ts  (NEW — ~15 lines; the only wiring needed)
import { Resend } from 'resend'

export async function sendPipelineAlert(subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) return            // same guard as weekly-digest
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Decifer Pipeline <alerts@decifer.app>',   // reuse the weekly-digest FROM/domain
    to: 'chopraa@gmail.com',
    subject: `[Decifer pipeline] ${subject}`,
    text: body,
  })
}
```

Then in each cron route's existing `catch` (e.g. `regenerate-flagged/route.ts`):

```ts
} catch (err) {
  console.error('[regenerate-flagged] pipeline error', err)
  await sendPipelineAlert('regenerate-flagged FAILED', String(err))   // ← add this line
  return NextResponse.json({ error: String(err) }, { status: 502 })
}
```

…and, for the **zero-published** signal, right after the response is parsed:

```ts
if ((body.flagged ?? 0) > 0 && (body.published ?? 0) === 0) {
  await sendPipelineAlert('regenerate-flagged published 0 items',
    JSON.stringify(body))
}
```

For the **golden-set regression** signal, the CI step is simply:

```yaml
- run: python3 scripts/verify-pipeline-golden.py   # non-zero exit fails the job
```

CI's native red-build notification covers paging there, so no Resend wiring is
needed for that one.

> This document specifies the hook points but does **not** implement the email
> wiring (`lib/pipeline-alert.ts` and the cron-route edits are TypeScript, owned
> by the app side, outside this pipeline harness). The helper above is the
> complete recipe.
