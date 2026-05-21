# Decifer Learning — Architecture Decisions

This file records production decisions, hardening requirements, and known pre-production
items that are not Phase blockers but must be resolved before public launch.

---

## PgBouncer transaction atomicity — pre-production hardening required

**Status:** Pre-production hardening required. Not a Phase 7 blocker.

**Context:**
`DATABASE_URL` routes through Supabase's PgBouncer connection pooler in transaction
mode by default. Prisma `$transaction(async (tx) => { ... })` (interactive transactions)
requires that all statements in the callback run on the same physical connection.
In PgBouncer transaction mode, the pooler may hand a new connection to each
top-level transaction boundary, which means Prisma interactive transactions can silently
lose their atomicity guarantee: partial writes from a failed transaction callback may
commit instead of rolling back.

**Current state:**
The MVP / local-pilot flow works because:
- `DIRECT_URL` is set and used by Prisma Migrate (connection is direct, not pooled).
- Observed writes during Phase 7 testing committed correctly.
- Transaction traffic is low (one child, single-digit concurrency).

At low concurrency, PgBouncer transaction mode rarely reassigns the connection mid-transaction,
so failures are unlikely to manifest. The current pilot is safe.

**Pre-production requirement (before community rollout):**
For any route that uses `prisma.$transaction(...)` with multiple interdependent writes
— specifically `/api/quiz/submit` and any future reward/unlock routes —
choose **one** of the following before opening to concurrent public traffic:

**Option A (preferred for simplicity):**
Set the connection string used by Prisma client (at runtime, not just migrate-time) to
`DIRECT_URL` (a direct, non-pooled Postgres connection). This gives true interactive
transaction atomicity. Acceptable at pilot scale; evaluate connection limits before
community launch.

**Option B (preferred for scale):**
Restructure multi-write reward routes into safe non-interactive batch writes:
- Use `prisma.createMany` / `prisma.upsert` where possible.
- Make each write idempotent (e.g., upsert with a unique constraint rather than
  insert-then-update).
- Accept eventual consistency for streak/points if a request is retried — design
  for at-least-once delivery rather than exactly-once transactionality.

**Affected routes:**
- `POST /api/quiz/submit` — quiz_attempt + quiz_answers + points + topic_progress + card + badges + streak (all in one `$transaction`)
- `POST /api/streak/shields/use` — single decrement (low risk, but not atomic with callers)

**Action required by:** before community rollout (Phase 12 gate or earlier).

---
