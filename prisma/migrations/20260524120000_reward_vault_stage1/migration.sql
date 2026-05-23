-- Reward Vault Stage 1 migration
-- Creates foundation tables for milestone tracking, parent settings, and reward requests.
-- reward_catalog and reward_fulfilments are created empty for Stage 2+ readiness.

-- ── vault_milestones ──────────────────────────────────────────────────────
CREATE TABLE vault_milestones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  band              TEXT        NOT NULL UNIQUE,
  display_name      TEXT        NOT NULL,
  xp_required       INT         NOT NULL DEFAULT 0,
  topics_required   INT         NOT NULL DEFAULT 0,
  badges_required   INT         NOT NULL DEFAULT 0,
  guardian_required BOOLEAN     NOT NULL DEFAULT FALSE,
  credits_awarded   INT         NOT NULL DEFAULT 1,
  order_index       INT         NOT NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT vault_milestones_band_check CHECK (band IN ('bronze','silver','gold','platinum'))
);

-- ── child_vault_status ────────────────────────────────────────────────────
CREATE TABLE child_vault_status (
  profile_id              UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_band            TEXT        NOT NULL DEFAULT 'none',
  current_band_reached_at TIMESTAMPTZ,
  credit_balance          INT         NOT NULL DEFAULT 0,
  credits_earned_total    INT         NOT NULL DEFAULT 0,
  last_milestone_check    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT child_vault_status_band_check CHECK (current_band IN ('none','bronze','silver','gold','platinum')),
  CONSTRAINT child_vault_status_credit_nonneg CHECK (credit_balance >= 0)
);

-- ── vault_parent_settings ─────────────────────────────────────────────────
CREATE TABLE vault_parent_settings (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_profile_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  physical_rewards_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  monthly_budget_pence     INT         NOT NULL DEFAULT 0,
  allowed_categories       TEXT[]      NOT NULL DEFAULT '{}',
  family_reward_options    JSONB       NOT NULL DEFAULT '[]',
  max_requests_per_month   INT         NOT NULL DEFAULT 1,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_profile_id, child_profile_id),
  CONSTRAINT vault_parent_settings_max_requests_check CHECK (max_requests_per_month BETWEEN 0 AND 12)
);

-- ── reward_requests ───────────────────────────────────────────────────────
CREATE TABLE reward_requests (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_profile_id       UUID        NOT NULL REFERENCES profiles(id),
  responded_by_profile_id UUID        REFERENCES profiles(id),
  milestone_band          TEXT        NOT NULL,
  xp_at_request           INT         NOT NULL,
  topics_at_request       INT         NOT NULL,
  badges_at_request       INT         NOT NULL,
  streak_at_request       INT         NOT NULL DEFAULT 0,
  child_message           TEXT,
  credits_used            INT         NOT NULL DEFAULT 1,
  status                  TEXT        NOT NULL DEFAULT 'pending',
  parent_response_note    TEXT,
  reward_type             TEXT,
  reward_label            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at            TIMESTAMPTZ,
  CONSTRAINT reward_requests_status_check CHECK (status IN (
    'pending','approved','rejected','deferred','counter_offered','completed','cancelled'
  )),
  CONSTRAINT reward_requests_reward_type_check CHECK (reward_type IN ('family','manual','physical') OR reward_type IS NULL),
  CONSTRAINT reward_requests_message_length CHECK (char_length(child_message) <= 120),
  CONSTRAINT reward_requests_note_length CHECK (char_length(parent_response_note) <= 280)
);

-- One pending request per child at a time
CREATE UNIQUE INDEX reward_requests_one_pending_per_child
  ON reward_requests (child_profile_id)
  WHERE status = 'pending';

CREATE INDEX reward_requests_child_status_idx ON reward_requests (child_profile_id, status);
CREATE INDEX reward_requests_parent_created_idx ON reward_requests (parent_profile_id, created_at DESC);

-- ── vault_milestone_events ────────────────────────────────────────────────
CREATE TABLE vault_milestone_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  band            TEXT        NOT NULL,
  credits_awarded INT         NOT NULL DEFAULT 1,
  xp_snapshot     INT         NOT NULL,
  topics_snapshot INT         NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vault_milestone_events_profile_idx ON vault_milestone_events (profile_id, occurred_at DESC);

-- ── reward_catalog (empty — Stage 2) ──────────────────────────────────────
CREATE TABLE reward_catalog (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  description        TEXT,
  category           TEXT,
  min_milestone      TEXT,
  price_pence        INT         NOT NULL DEFAULT 0,
  image_url          TEXT,
  shopify_variant_id TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reward_fulfilments (empty — Stage 2) ─────────────────────────────────
CREATE TABLE reward_fulfilments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID        NOT NULL UNIQUE REFERENCES reward_requests(id),
  status            TEXT        NOT NULL DEFAULT 'approved',
  shopify_order_id  TEXT,
  shopify_order_url TEXT,
  tracking_number   TEXT,
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reward_fulfilments_status_check CHECK (status IN (
    'approved','processing','ordered','shipped','delivered','completed','cancelled','refunded'
  ))
);

-- ── RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE vault_milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_vault_status        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_parent_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_milestone_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_catalog            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_fulfilments        ENABLE ROW LEVEL SECURITY;

-- vault_milestones: authenticated users can read; service role full access
CREATE POLICY "vault_milestones_read" ON vault_milestones
  FOR SELECT USING (auth.role() = 'authenticated');

-- child_vault_status: child reads own row; parent reads linked children; service role full
CREATE POLICY "child_vault_status_own_read" ON child_vault_status
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "child_vault_status_parent_read" ON child_vault_status
  FOR SELECT USING (
    profile_id IN (
      SELECT child_user_id FROM family_links
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE parent_user_id = p.user_id
    )
  );

-- vault_parent_settings: parent reads/updates own rows; child cannot read
CREATE POLICY "vault_parent_settings_parent_select" ON vault_parent_settings
  FOR SELECT USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vault_parent_settings_parent_insert" ON vault_parent_settings
  FOR INSERT WITH CHECK (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vault_parent_settings_parent_update" ON vault_parent_settings
  FOR UPDATE USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- reward_requests: child inserts own requests; child reads own; parent reads linked children
CREATE POLICY "reward_requests_child_select" ON reward_requests
  FOR SELECT USING (
    child_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "reward_requests_child_insert" ON reward_requests
  FOR INSERT WITH CHECK (
    child_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "reward_requests_parent_select" ON reward_requests
  FOR SELECT USING (
    child_profile_id IN (
      SELECT fl.child_user_id FROM family_links fl
      JOIN profiles p ON p.user_id = fl.parent_user_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "reward_requests_parent_update" ON reward_requests
  FOR UPDATE USING (
    child_profile_id IN (
      SELECT fl.child_user_id FROM family_links fl
      JOIN profiles p ON p.user_id = fl.parent_user_id
      WHERE p.user_id = auth.uid()
    )
  );

-- vault_milestone_events: child reads own; parent reads linked children
CREATE POLICY "vault_milestone_events_child_read" ON vault_milestone_events
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vault_milestone_events_parent_read" ON vault_milestone_events
  FOR SELECT USING (
    profile_id IN (
      SELECT fl.child_user_id FROM family_links fl
      JOIN profiles p ON p.user_id = fl.parent_user_id
      WHERE p.user_id = auth.uid()
    )
  );

-- reward_catalog: no public access (Stage 2 will add parent read for published items)
-- (No SELECT policy = no access for authenticated users without service role)

-- reward_fulfilments: no public access (admin only via service role)
