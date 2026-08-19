-- Skills Check: finish the answer denormalisation started in
-- 20260819200000_skills_check_answers_survive_rebuild.
--
-- RUN THIS ONLY ONCE THE CODE THAT POPULATES THE NEW COLUMNS IS DEPLOYED.
-- The first migration left them nullable so the previously deployed build kept
-- working. This one makes them required, which the old build cannot satisfy.
-- Splitting it is the whole point: either half can land first without breaking
-- the live check.

-- Any row still missing a question predates the deploy and cannot be
-- reconstructed: its item row is gone, which is the bug the first migration
-- fixed. On production this deletes nothing, because the table is empty.
DELETE FROM "skill_check_answers" WHERE "question_id" IS NULL;

ALTER TABLE "skill_check_answers"
    ALTER COLUMN "question_id"     SET NOT NULL,
    ALTER COLUMN "check_id"        SET NOT NULL,
    ALTER COLUMN "band"            SET NOT NULL,
    ALTER COLUMN "strand_topic_id" SET NOT NULL,
    ALTER COLUMN "position"        SET NOT NULL;

-- The old unique key was (attempt_id, item_id). With item_id nullable that stops
-- enforcing anything, because Postgres treats NULLs as distinct. One answer per
-- question per attempt is the real invariant, and skill_check_items already
-- guarantees a question appears at most once in a check.
DROP INDEX IF EXISTS "skill_check_answers_attempt_item_key";

CREATE UNIQUE INDEX "skill_check_answers_attempt_question_key"
    ON "skill_check_answers"("attempt_id", "question_id");
