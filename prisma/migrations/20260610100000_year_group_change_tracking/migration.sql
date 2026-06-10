-- Track when a child last self-changed their year group so the self-service
-- route can enforce a cooldown (admins are exempt — their PATCH ignores this).
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "year_group_changed_at" TIMESTAMP(3);
