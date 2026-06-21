-- Engagement re-engagement emails (activation nudge for kids who never played,
-- come-back reminder for kids who went idle). Mirrors the parent-verify
-- tracking pattern: a last-sent timestamp + a capped send counter per flow.
-- Driven by /api/cron/engagement-nudge.
alter table profiles
  add column if not exists activation_email_sent_at timestamptz,
  add column if not exists activation_email_count   integer not null default 0,
  add column if not exists comeback_email_sent_at   timestamptz,
  add column if not exists comeback_email_count      integer not null default 0;
