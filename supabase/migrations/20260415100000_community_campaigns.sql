-- Community campaigns + prize-draw winner selection.
--
-- Background: the v2 pivot migration declared `brand_id` as nullable in the
-- DB but the application layer (TS types, UI, emails) treated it as required.
-- A handful of fields referenced in code (`campaign_type`, `campaign_image`,
-- `required_tags`) were never added to the schema at all — inserts that
-- included them silently dropped the values. This migration:
--   1. adds the four missing columns so insert payloads from
--      AdminCampaignsTab/CampaignWizard stop being silently truncated, and
--   2. adds a CHECK constraint that lets `brand_id` legitimately be NULL —
--      but only when `campaign_type = 'community'`. Brand campaigns must
--      still have a brand.
--   3. introduces winner-selection plumbing for the prize-draw model:
--      `num_winners`, `winner_announced_at`, plus 'winner' / 'not_selected'
--      participation statuses.

-- ── 1. Missing columns ────────────────────────────────────────────────
alter table public.campaigns
  add column if not exists campaign_type text not null default 'brand';

alter table public.campaigns
  add column if not exists campaign_image text;

alter table public.campaigns
  add column if not exists required_tags text[];

-- Allowed campaign_type values
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'campaigns_campaign_type_check'
      and table_name = 'campaigns'
  ) then
    alter table public.campaigns
      add constraint campaigns_campaign_type_check
      check (campaign_type in ('brand', 'community'));
  end if;
end $$;

-- ── 2. brand_id is required for brand campaigns, optional for community ──
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'campaigns_brand_required_for_brand_type'
      and table_name = 'campaigns'
  ) then
    alter table public.campaigns
      add constraint campaigns_brand_required_for_brand_type
      check (campaign_type = 'community' or brand_id is not null);
  end if;
end $$;

-- ── 3. Prize-draw winner-selection plumbing ──────────────────────────
alter table public.campaigns
  add column if not exists num_winners integer default 1;

alter table public.campaigns
  add column if not exists winner_announced_at timestamptz;

-- Extend participations.status to include winner / not_selected.
-- The v2 pivot used a CHECK constraint with no explicit name, so we look
-- it up dynamically and replace it.
do $$
declare
  cn text;
begin
  select conname into cn
  from pg_constraint
  where conrelid = 'public.participations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cn is not null then
    execute format('alter table public.participations drop constraint %I', cn);
  end if;
  alter table public.participations
    add constraint participations_status_check
    check (status in (
      'confirmed', 'visited', 'content_submitted', 'completed', 'overdue',
      'winner', 'not_selected'
    ));
end $$;

comment on column public.campaigns.campaign_type is
  '"brand" — owned by a business; "community" — owned by Nayba (no brand_id, prize-draw model).';
comment on column public.campaigns.num_winners is
  'For community/prize-draw campaigns: how many winners the admin will pick from submitted Reels.';
comment on column public.campaigns.winner_announced_at is
  'Set when the admin picks winners. Used to show creators the draw outcome.';
