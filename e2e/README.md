# Decifer Learning — End-to-End tests (Playwright)

Regression net for the critical **child-facing** journeys: CLAUDE.md Phases 4
(Learn→Practise→Quiz), 5 (points/hearts/progress), 7 (cards), 8 (world map),
and 10 (PWA / offline sync). Mobile-first: the **primary project runs at a
375 px viewport** (iPhone SE), the device the app is designed for.

These tests live entirely under `e2e/` and never touch app code.

---

## Quick start

```bash
# one-time: install the Chromium browser binary Playwright drives
npx playwright install chromium

# run the green-by-default suite (smoke + redirect tests only)
npm run e2e

# interactive UI mode
npm run e2e:ui

# open the HTML report from the last run
npm run e2e:report
```

The config has a `webServer` block that runs `npm run dev` and waits for the
base URL. Locally it **reuses** an already-running dev server, so you can also
start `npm run dev` yourself in another terminal first.

---

## Environment variables

| Var            | Default                 | Purpose                                                                 |
| -------------- | ----------------------- | ---------------------------------------------------------------------- |
| `E2E_BASE_URL` | `http://localhost:3000` | Base URL under test (point at a preview deploy to skip the dev server). |
| `E2E_LIVE`     | _unset_                 | Set to `1` to run the data-dependent journeys (auth, learn/quiz, offline, world map). |
| `CI`           | _unset_                 | Enables retries (2) and disables dev-server reuse.                      |

```bash
# full suite against a seeded local DB
E2E_LIVE=1 npm run e2e

# against a deployed preview
E2E_BASE_URL=https://<preview>.vercel.app E2E_LIVE=1 npm run e2e
```

---

## What runs when

### Green-by-default (no DB, no seed, no auth) — always runs

- **`smoke.spec.ts`** — homepage loads; no console errors; no uncaught page
  errors; **no horizontal scroll at 375 px** (`document.documentElement.scrollWidth
  ≤ clientWidth`). Also checks `/login` and `/register` render + don't overflow.
- **`auth.spec.ts` → "protected route redirect"** — logged-out `/dashboard`
  redirects to `/login`; a deep child route (`/world-map`) redirects with
  `?redirectTo=`. Pure middleware behaviour, no DB needed.

### Gated behind `E2E_LIVE=1` — skipped (green) without it

- **`auth.spec.ts` → "full registration journey"** — register → role **child** →
  **Year 3** → land on `/dashboard`.
- **`learn-practise-quiz.spec.ts`** — open the dashboard's first published topic,
  render the **Learn** page, then run a **Quiz** question and assert immediate
  feedback + a "Next Question/See Results" advance. Also asserts **no
  `staged`/`flagged`/`regenerating` status words leak** into the child UI
  (CLAUDE.md §8 hard rule).
- **`offline-sync.spec.ts`** — go offline via `context.setOffline(true)`, queue an
  answer into IndexedDB (`decifer-offline` / `pending-answers`), reconnect, and
  assert the `decifer:sync-start` → `decifer:sync-end` lifecycle fires and the
  queue drains.
- **`world-map.spec.ts`** — world map renders at 375 px without horizontal
  scroll; a **locked node is not a link**; (documented, currently skipped)
  completing a topic unlocks the next node.

---

## Data-seeding prerequisites for the LIVE specs

The `E2E_LIVE` journeys drive the real Supabase-backed app, so the target
environment must have:

1. **Supabase email confirmation OFF** (or a pre-seeded, already-confirmed child
   account). With confirmation **on**, `supabase.auth.signUp` returns no session
   and `RegisterForm` shows a "check your email" notice instead of routing to
   `/dashboard` — `ensureChildSession()` will fail with a clear message. Use a
   dedicated, disposable E2E Supabase project for this.
2. **At least one published Year-3 topic** (`is_published = true`) with:
   - published `learn_content` (`status = 'published'`), and
   - ≥1 published `quiz_questions` (`status = 'published'`)
     so the child dashboard surfaces a "Start" CTA linking to
     `/topics/<id>/learn` and `/topics/<id>/quiz`.
3. **Seeded `zones` + `world_map_nodes`** for the child's year group, so
   `/world-map` renders zone maps. For the (currently skipped) unlock test you
   additionally need a deterministic seed: one completable topic gating one
   locked follow-on topic.

Disposable accounts are generated per run (`e2e+child-<timestamp>@example.com`)
so reruns never collide. They are **not** cleaned up automatically — periodically
purge `e2e+%@example.com` users from the E2E Supabase project, or run against a
throwaway branch DB.

---

## Recommended `data-testid` hooks (for stable selectors)

The specs use resilient role/text selectors today, but the app text is tuned for
children and may change. Adding these stable hooks would make the suite far less
brittle. Each is noted inline in the relevant spec/helper too.

| Hook                              | Where to add it                                                        | Used by                         |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| `data-testid="role-child"`        | `RegisterForm.tsx` — the role `<button>` for "child"                   | `helpers/auth.ts`               |
| `data-testid="year-group-3"`      | `RegisterForm.tsx` — the year-group `<button>` for Year 3 (etc.)        | `helpers/auth.ts`               |
| `data-testid="parental-consent"`  | `RegisterForm.tsx` — the consent `<input type="checkbox">`             | `helpers/auth.ts`               |
| `data-testid="start-topic"`       | `app/dashboard/child/page.tsx` — the primary topic "Start →" CTA       | `learn-practise-quiz.spec.ts`   |
| `data-testid="quiz-choice"`       | `components/quiz/QuizShell.tsx` — each MCQ choice `<button>`           | `learn-practise-quiz.spec.ts`   |
| `data-testid="quiz-feedback"`     | `QuizShell.tsx` — the post-question feedback panel                      | `learn-practise-quiz.spec.ts`   |
| `data-testid="quiz-next"`         | `QuizShell.tsx` — the "Next Question / See Results" advance `<button>`  | `learn-practise-quiz.spec.ts`   |
| `data-testid="offline-banner"`    | `components/ui/OfflineBanner.tsx` — the status banner                   | `offline-sync.spec.ts`          |
| `data-testid="topic-node"`        | `components/world-map/TopicNode.tsx` — node wrapper (+ `data-state`)    | `world-map.spec.ts`             |
| `data-testid="topic-node-locked"` | `TopicNode.tsx` — the locked (non-link) `<div>` branch                 | `world-map.spec.ts`             |

A `data-state="locked|available|completed"` attribute on the TopicNode wrapper
would let the world-map spec assert node state directly instead of inferring it
from the `sr-only "— locked"` text.
