-- Skills Check: the six-week retest reminder.
--
-- The result page and the report email both promise a reminder in six weeks.
-- Nothing sent it, so the promise was empty. This column is what makes the
-- reminder send exactly once per lead: the cron selects leads whose report is
-- old enough and whose reminder_sent_at is still null, and stamps it on the way
-- out.
--
-- A tombstoned lead (deleted_at set) is never selected, so a parent who used the
-- delete link is not emailed again. That is the whole point of the tombstone.

ALTER TABLE "skill_check_leads" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMPTZ;

-- Drives the cron's selection: unsent reminders, oldest consent first.
CREATE INDEX IF NOT EXISTS "skill_check_leads_reminder_idx"
    ON "skill_check_leads"("reminder_sent_at", "consented_at")
    WHERE "reminder_sent_at" IS NULL AND "deleted_at" IS NULL;
