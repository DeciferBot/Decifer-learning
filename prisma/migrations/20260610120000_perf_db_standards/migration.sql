-- Database performance standards pass (Supabase linter remediation).
--
-- 1. Covering indexes for unindexed foreign keys (lint 0001).
-- 2. subscriptions: drop the redundant service_role policy (service_role has
--    BYPASSRLS, so the policy never gates anything — it only adds per-row
--    evaluation cost) and rewrite the remaining policy with an initplan-safe
--    `(select auth.uid())` (lint 0003 auth_rls_initplan).
-- 3. Consolidate multiple permissive policies per (role, action) into single
--    OR'd policies (lint 0006 multiple_permissive_policies). Behaviour is
--    identical: the new USING clause is the exact OR of the old clauses.
--    All rewritten policies are scoped TO authenticated — anon users always
--    failed these checks (auth.uid() IS NULL) but still paid the evaluation.

-- ── 1. Foreign-key covering indexes ─────────────────────────────────────────
create index if not exists idx_curriculum_units_year_group_id
  on public.curriculum_units (year_group_id);
create index if not exists idx_exam_assignments_subject_id
  on public.exam_assignments (subject_id);
create index if not exists idx_exam_assignments_year_group_id
  on public.exam_assignments (year_group_id);

-- ── 2. subscriptions ─────────────────────────────────────────────────────────
drop policy if exists subscriptions_service_all on public.subscriptions;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 3a. profiles: 3 permissive SELECT policies → 1 ──────────────────────────
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_linked_child on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.family_links
      where family_links.parent_user_id = (select auth.uid())
        and family_links.child_user_id = profiles.user_id
    )
    or current_user_is_admin()
  );

-- ── 3b. family_links: 2 permissive SELECT policies → 1 ──────────────────────
drop policy if exists family_links_select_party on public.family_links;
drop policy if exists family_links_select_admin on public.family_links;
create policy family_links_select on public.family_links
  for select to authenticated
  using (
    parent_user_id = (select auth.uid())
    or child_user_id = (select auth.uid())
    or current_user_is_admin()
  );

-- ── 3c. parent_controls: ALL policy overlapped both SELECT policies ─────────
-- Split the linked-parent ALL policy into write-only policies and merge the
-- read paths (child self + linked parent) into one SELECT policy.
drop policy if exists parent_controls_modify_linked_parent on public.parent_controls;
drop policy if exists parent_controls_select_child_self on public.parent_controls;
drop policy if exists parent_controls_select_linked_parent on public.parent_controls;
create policy parent_controls_select on public.parent_controls
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = parent_controls.child_profile_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = parent_controls.child_profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );
create policy parent_controls_insert_linked_parent on public.parent_controls
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = parent_controls.child_profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );
create policy parent_controls_update_linked_parent on public.parent_controls
  for update to authenticated
  using (
    exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = parent_controls.child_profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );
create policy parent_controls_delete_linked_parent on public.parent_controls
  for delete to authenticated
  using (
    exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = parent_controls.child_profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );

-- ── 3d. reward_requests: 2 permissive SELECT policies → 1 ───────────────────
drop policy if exists reward_requests_child_select on public.reward_requests;
drop policy if exists reward_requests_parent_select on public.reward_requests;
create policy reward_requests_select on public.reward_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = reward_requests.child_profile_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = reward_requests.child_profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );

-- ── 3e. child_vault_status: 2 permissive SELECT policies → 1 ────────────────
drop policy if exists child_vault_status_own_read on public.child_vault_status;
drop policy if exists child_vault_status_parent_read on public.child_vault_status;
create policy child_vault_status_select on public.child_vault_status
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = child_vault_status.profile_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = child_vault_status.profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );

-- ── 3f. vault_milestone_events: 2 permissive SELECT policies → 1 ────────────
drop policy if exists vault_milestone_events_child_read on public.vault_milestone_events;
drop policy if exists vault_milestone_events_parent_read on public.vault_milestone_events;
create policy vault_milestone_events_select on public.vault_milestone_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = vault_milestone_events.profile_id
        and p.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.family_links fl
      join public.profiles p on p.id = vault_milestone_events.profile_id
      where fl.parent_user_id = (select auth.uid())
        and fl.child_user_id = p.user_id
    )
  );
