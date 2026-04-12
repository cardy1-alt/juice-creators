-- Fix applications RLS: creator_id references creators.id (not auth.uid())
--
-- The previous policy checked `creator_id = auth.uid()` which always fails
-- because creators.id is a generated UUID, not the auth user's UID. Creators
-- are matched to auth users via creators.email = auth.email().
--
-- This blocked creators from registering interest in campaigns — every
-- insert was rejected by RLS with a silent failure.

drop policy if exists applications_select on applications;
drop policy if exists applications_insert_own on applications;
drop policy if exists applications_update on applications;
drop policy if exists applications_delete on applications;

-- Helper: get the current user's creator row id (null if not a creator)
create or replace function public.current_creator_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.creators where email = auth.email() limit 1;
$$;

-- Select: creators can see their own applications; brand owners can see
-- applications to their campaigns; admins see all
create policy applications_select on applications
  for select to authenticated
  using (
    creator_id = public.current_creator_id()
    or exists (
      select 1 from public.campaigns c
      join public.businesses b on b.id = c.brand_id
      where c.id = applications.campaign_id and b.owner_email = auth.email()
    )
    or public.is_admin()
  );

-- Insert: creators can insert applications for themselves; admins can insert any
create policy applications_insert_own on applications
  for insert to authenticated
  with check (
    creator_id = public.current_creator_id()
    or public.is_admin()
  );

-- Update: creators can update their own; admins can update any
create policy applications_update on applications
  for update to authenticated
  using (
    creator_id = public.current_creator_id()
    or public.is_admin()
  )
  with check (
    creator_id = public.current_creator_id()
    or public.is_admin()
  );

-- Delete: admin only (campaigns/creators cascade-delete handles the rest)
create policy applications_delete on applications
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- Participations — same creator_id != auth.uid() bug
-- Plus: creators need to INSERT their own participation on confirm
-- and UPDATE it when submitting a reel.
-- ============================================================

drop policy if exists participations_select on participations;
drop policy if exists participations_insert_admin on participations;
drop policy if exists participations_update_admin on participations;
drop policy if exists participations_insert on participations;
drop policy if exists participations_update on participations;

create policy participations_select on participations
  for select to authenticated
  using (
    creator_id = public.current_creator_id()
    or public.is_admin()
    or exists (
      select 1 from public.campaigns c
      join public.businesses b on b.id = c.brand_id
      where c.id = participations.campaign_id
      and b.owner_email = lower(auth.jwt() ->> 'email')
    )
  );

-- Creators can create their own participation (on confirming a spot);
-- admins can create any.
create policy participations_insert on participations
  for insert to authenticated
  with check (
    creator_id = public.current_creator_id()
    or public.is_admin()
  );

-- Creators can update their own participation (reel submission, etc);
-- admins can update any.
create policy participations_update on participations
  for update to authenticated
  using (
    creator_id = public.current_creator_id()
    or public.is_admin()
  )
  with check (
    creator_id = public.current_creator_id()
    or public.is_admin()
  );
