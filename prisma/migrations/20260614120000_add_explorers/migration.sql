-- Explorable engine content tables: data-driven immersive explorers.
-- explorers      = one row per explorer (solar-system, world-atlas, ...).
-- explorer_nodes = one row per focusable object (planet, country, organ, ...).
-- Content lives in the DB (CLAUDE.md §16 rule 5 — no hardcoded content). RLS
-- enforces published-only reads for app clients (CLAUDE.md §8). Idempotent so it
-- is safe to re-run via `prisma migrate deploy` even though the live DB was
-- provisioned out-of-band via the Supabase migration tooling.

CREATE TABLE IF NOT EXISTS "explorers" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "key"          TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "tagline"      TEXT,
    "emoji"        TEXT,
    "scene_type"   TEXT NOT NULL,
    "gradient"     TEXT,
    "config"       JSONB NOT NULL DEFAULT '{}'::jsonb,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "order_index"  INTEGER NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "explorers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "explorers_key_key" UNIQUE ("key")
);

CREATE INDEX IF NOT EXISTS "explorers_published_idx" ON "explorers"("is_published", "order_index");

CREATE TABLE IF NOT EXISTS "explorer_nodes" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "explorer_id" UUID NOT NULL,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "visual"      JSONB NOT NULL DEFAULT '{}'::jsonb,
    "stats"       JSONB NOT NULL DEFAULT '{}'::jsonb,
    "content"     JSONB NOT NULL DEFAULT '{}'::jsonb,
    "quiz"        JSONB,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "explorer_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "explorer_nodes_explorer_id_key_key" UNIQUE ("explorer_id", "key")
);

CREATE INDEX IF NOT EXISTS "explorer_nodes_explorer_idx" ON "explorer_nodes"("explorer_id", "order_index");

ALTER TABLE "explorer_nodes"
    DROP CONSTRAINT IF EXISTS "explorer_nodes_explorer_id_fkey";
ALTER TABLE "explorer_nodes"
    ADD CONSTRAINT "explorer_nodes_explorer_id_fkey"
    FOREIGN KEY ("explorer_id") REFERENCES "explorers"("id") ON DELETE CASCADE;

ALTER TABLE "explorers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explorer_nodes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "explorers_published_read" ON "explorers";
CREATE POLICY "explorers_published_read" ON "explorers"
    FOR SELECT TO anon, authenticated
    USING ("is_published" = true);

DROP POLICY IF EXISTS "explorer_nodes_published_read" ON "explorer_nodes";
CREATE POLICY "explorer_nodes_published_read" ON "explorer_nodes"
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM "explorers" e WHERE e.id = "explorer_id" AND e.is_published = true));
