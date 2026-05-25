-- CreateTable
CREATE TABLE "learning_events" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"      UUID NOT NULL,
    "event_type"      TEXT NOT NULL,
    "subject_id"      UUID,
    "topic_id"        UUID,
    "lesson_id"       UUID,
    "quiz_attempt_id" UUID,
    "metadata"        JSONB NOT NULL DEFAULT '{}',
    "occurred_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_events_profile_id_event_type_occurred_at_idx"
    ON "learning_events"("profile_id", "event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "learning_events_profile_id_topic_id_occurred_at_idx"
    ON "learning_events"("profile_id", "topic_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "learning_events"
    ADD CONSTRAINT "learning_events_profile_id_fkey"
    FOREIGN KEY ("profile_id")
    REFERENCES "profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
