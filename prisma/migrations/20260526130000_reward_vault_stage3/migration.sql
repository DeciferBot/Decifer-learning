-- Reward Vault Stage 3 — Shopify integration schema additions.
-- Adds delivery_address to vault_parent_settings.
-- reward_catalog.shopify_variant_id and reward_fulfilments.shopify_order_* columns
-- already exist from Stage 1 migration — no changes needed to those tables.

-- ── vault_parent_settings: add delivery address ──────────────────────────────

ALTER TABLE "vault_parent_settings" ADD COLUMN IF NOT EXISTS "delivery_address" JSONB;

COMMENT ON COLUMN "vault_parent_settings"."delivery_address" IS
  'Optional delivery address for physical reward fulfilment. JSON with keys: firstName, lastName, address1, address2, city, postcode, country.';
