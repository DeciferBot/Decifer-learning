-- Learning Aid Box: exploration session tracking
CREATE TABLE "exploration_sessions" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"       UUID NOT NULL,
    "aid_type"         TEXT NOT NULL,
    "topic_key"        TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "ask_count"        INTEGER NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exploration_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exploration_sessions_profile_id_idx" ON "exploration_sessions"("profile_id");
CREATE INDEX "exploration_sessions_aid_type_idx" ON "exploration_sessions"("aid_type");

ALTER TABLE "exploration_sessions"
    ADD CONSTRAINT "exploration_sessions_profile_id_fkey"
    FOREIGN KEY ("profile_id")
    REFERENCES "profiles"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
