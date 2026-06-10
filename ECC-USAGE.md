# ECC Usage — decifer-learning

Curated Claude Code agents & slash commands (from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)).
Live in `.claude/agents/` and `.claude/commands/`. Available only in a Claude Code session started **inside this repo**.

## How to invoke

- **Subagents** — just ask in plain English; Claude delegates automatically. Always name a target (a path or "my last commit").
  ```
  Use the typescript-reviewer subagent to review the question-generation pipeline
  ```
  Equivalent phrasings: "have <agent> check…", "run the <agent> agent on…". Type `/agents` to list them.
  Review agents are **read-only** — they report findings, they don't edit.
- **Slash commands** — type `/name`. Type `/help` or `/` to browse.

## The build-a-feature loop (use for anything non-trivial)

```
/plan         show source text, image, and explanation in every flagged-question card
/feature-dev  implement what we just planned
/react-build  scaffold the component following repo conventions
/react-test   generate tests for it
/code-review  (run before committing)
```
`/plan` restates the requirement and surfaces risks/edge cases before code.
`/feature-dev` explores existing code (`code-explorer`) first so changes fit conventions.

## Review agents (read-only) — highest value first

| Ask for… | Use on |
|---|---|
| `react-reviewer` (or `/react-review`) | React/JSX in the current diff |
| `typescript-reviewer` | question-generation pipeline, typed logic |
| `a11y-architect` | quiz / question-card components (keyboard nav, ARIA, contrast) |
| `database-reviewer` | Supabase queries / RLS (e.g. flagged questions) |
| `type-design-analyzer` | shared types / data models |
| `performance-optimizer` | slow renders, heavy data fetches |

## Everyday slash commands

```
/code-review     review current diff (delegates to code-reviewer + refactor-cleaner)
/react-review    React-specific review
/react-build     scaffold a component to repo conventions
/react-test      generate component tests
/build-fix       paste a failing build/type error → diagnose & fix
/test-coverage   find untested paths
/refactor-clean  safe cleanup of a file you just touched (no behavior change)
/quality-gate    pre-merge gate (lint + types + tests + review summary)
```

## Compounding over time

- `/learn` — run **after** a good session; extracts patterns/corrections into a reusable skill in `.claude/skills/`.
- `/checkpoint`, `/save-session`, `/resume-session` — carry context across long tasks.

> Accessibility matters here — it's a learning product. Run `a11y-architect` on any new interactive UI before shipping.
