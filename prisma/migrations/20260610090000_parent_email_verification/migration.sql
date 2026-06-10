-- Parent email verification for self-registered child accounts.
--
-- Children who register themselves must now provide a parent/guardian email.
-- We store it on the profile, mint a verification token, email the parent a
-- confirmation link, and send reminders (cron) until they confirm.
--
-- parent_email_verified_at is the "verified parental consent" timestamp;
-- parental_consent_at remains the self-attested checkbox timestamp from signup.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "parent_email" TEXT,
  ADD COLUMN IF NOT EXISTS "parent_email_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parent_verify_token" UUID,
  ADD COLUMN IF NOT EXISTS "parent_verify_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parent_verify_reminder_count" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_parent_verify_token_key"
  ON "profiles"("parent_verify_token");

-- Extend the auth bridge trigger: copy parent_email metadata onto the profile
-- and mint a verification token. Matches the live function (which already
-- handles exam_board + parental_consent_at) — do not regress those fields.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role                  text;
  v_display_name          text;
  v_year_label            text;
  v_year_group_id         uuid;
  v_exam_board            text;
  v_parental_consent_at   timestamptz;
  v_parent_email          text;
  v_parent_verify_token   uuid;
BEGIN
  v_role         := COALESCE(NEW.raw_user_meta_data->>'role', 'child');
  v_display_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), NEW.email, 'Explorer');
  v_year_label   := NEW.raw_user_meta_data->>'year_group';
  v_exam_board   := NEW.raw_user_meta_data->>'exam_board';

  IF v_role NOT IN ('child', 'parent', 'admin') THEN
    RAISE EXCEPTION 'handle_new_auth_user: invalid role %', v_role;
  END IF;

  IF v_role = 'child' THEN
    IF v_year_label IS NULL THEN
      RAISE EXCEPTION 'handle_new_auth_user: child registrations must include year_group metadata';
    END IF;
    SELECT id INTO v_year_group_id FROM public.year_groups WHERE label = v_year_label;
    IF v_year_group_id IS NULL THEN
      RAISE EXCEPTION 'handle_new_auth_user: unknown year_group label %', v_year_label;
    END IF;

    -- Record parental consent timestamp if the parent checked the consent box
    IF (NEW.raw_user_meta_data->>'parental_consent_given')::boolean IS TRUE THEN
      v_parental_consent_at := NOW();
    END IF;

    -- Parent/guardian contact for verification emails. Parent-created child
    -- accounts (child-*@decifer.internal) carry no parent_email metadata —
    -- the creating parent IS the verified parent in that flow.
    v_parent_email := NULLIF(lower(trim(NEW.raw_user_meta_data->>'parent_email')), '');
    IF v_parent_email IS NOT NULL THEN
      v_parent_verify_token := gen_random_uuid();
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, role, year_group_id,
    exam_board, parental_consent_at, subscription_tier,
    parent_email, parent_verify_token
  )
  VALUES (
    NEW.id, v_display_name, v_role::"Role", v_year_group_id,
    v_exam_board, v_parental_consent_at, 'free',
    v_parent_email, v_parent_verify_token
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
