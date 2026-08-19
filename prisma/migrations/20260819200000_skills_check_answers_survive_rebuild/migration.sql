-- Skills Check: stop a check rebuild from deleting every answer it ever had.
--
-- WHAT WENT WRONG
-- persistCheck() replaces a check's item list with deleteMany + createMany, and
-- skill_check_answers.item_id was ON DELETE CASCADE. So every rebuild silently
-- deleted every answer ever given to that check. It ate the first 20 answers the
-- live check recorded (attempt 18:11 UTC, check rebuilt 19:04 UTC, 2026-08-19).
-- The attempt row survived, because its FK points at skill_checks, and
-- strand_results is denormalised JSON, so nothing on the report looked wrong.
--
-- THE FIX
-- An answer carries its own question, check, band, strand and position, so it no
-- longer needs the item row to mean anything. item_id becomes nullable and
-- SET NULL. question_id is the right key anyway: difficulty belongs to a
-- question, not to the slot it sat in, and lib/irt.ts calibrates per question.
--
-- THIS HALF IS BACKWARD COMPATIBLE ON PURPOSE.
-- The new columns stay nullable and the old unique key stays in place, so the
-- currently deployed build keeps working after this runs. It already stops the
-- data loss on its own. The companion migration
-- 20260819200100_skills_check_answers_require_question tightens the columns to
-- NOT NULL and swaps the unique key, and must only run once the code that
-- populates them is live.

-- ---------- New columns, nullable for now ----------

ALTER TABLE "skill_check_answers"
    ADD COLUMN "question_id"     UUID,
    ADD COLUMN "check_id"        UUID,
    ADD COLUMN "band"            "SkillCheckBand",
    ADD COLUMN "strand_topic_id" UUID,
    ADD COLUMN "position"        INTEGER;

-- Backfill from the item each answer still points at. A no-op on production,
-- where the table is empty precisely because of the bug above, but it has to be
-- right for any environment that still holds rows.
UPDATE "skill_check_answers" a
SET "question_id"     = i."question_id",
    "check_id"        = i."check_id",
    "band"            = i."band",
    "strand_topic_id" = i."strand_topic_id",
    "position"        = i."position"
FROM "skill_check_items" i
WHERE a."item_id" = i."id";

-- ---------- item_id: nullable, and no longer a delete path ----------

ALTER TABLE "skill_check_answers" ALTER COLUMN "item_id" DROP NOT NULL;

ALTER TABLE "skill_check_answers" DROP CONSTRAINT "skill_check_answers_item_id_fkey";
ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "skill_check_items"("id") ON DELETE SET NULL;

-- ---------- The rest of the new foreign keys ----------
--
-- question and check stay ON DELETE CASCADE: if the question itself is deleted
-- there is no difficulty left to report, and if the check is deleted the answer
-- has no home. Neither happens on a rebuild, which is the event that caused the
-- data loss.

ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE;
ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_check_id_fkey"
    FOREIGN KEY ("check_id") REFERENCES "skill_checks"("id") ON DELETE CASCADE;
ALTER TABLE "skill_check_answers"
    ADD CONSTRAINT "skill_check_answers_strand_topic_id_fkey"
    FOREIGN KEY ("strand_topic_id") REFERENCES "topics"("id");

CREATE INDEX "skill_check_answers_question_idx" ON "skill_check_answers"("question_id");
CREATE INDEX "skill_check_answers_check_idx"    ON "skill_check_answers"("check_id");
