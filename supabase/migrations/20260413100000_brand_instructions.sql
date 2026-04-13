-- Brand-specific requirements per campaign (e.g. "Please book a visit in
-- advance via Instagram DM"). Surfaced to creators before applying, before
-- confirming, after confirming, and in the creator_confirmed email.
--
-- Optional, free-form text. Existing campaigns get null and behave as
-- before (no callout shown).

alter table public.campaigns
  add column if not exists brand_instructions text;

comment on column public.campaigns.brand_instructions is
  'Brand-written requirements creators must follow (e.g. booking, posting cadence). Shown across the creator flow.';
