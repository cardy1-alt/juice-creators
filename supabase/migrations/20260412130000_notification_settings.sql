-- Move email notification toggles from localStorage → database, so:
-- 1) Settings sync across admin devices
-- 2) Edge function enforces toggles regardless of which browser triggered
--    the notification (fixes user-triggered emails that previously bypassed
--    localStorage-based checks)
-- 3) Audit trail of when settings were last changed

create table if not exists public.notification_settings (
  email_type text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_settings is
  'Per-email-type enabled flag. Checked by the send-email edge function before calling Resend. Admin-managed via the Settings tab.';

-- Seed every email_type currently used in the codebase with enabled=true
insert into public.notification_settings (email_type, enabled) values
  ('creator_welcome', true),
  ('creator_approved', true),
  ('creator_denied', true),
  ('creator_selected', true),
  ('creator_confirmed', true),
  ('creator_content_received', true),
  ('creator_deadline_reminder', true),
  ('creator_campaign_complete', true),
  ('weekly_digest', true),
  ('business_welcome', true),
  ('business_approved', true),
  ('business_denied', true),
  ('business_campaign_live', true),
  ('business_creator_confirmed', true),
  ('admin_signup', true),
  ('admin_approval_request', true),
  ('admin_interest_expressed', true),
  ('admin_creator_confirmed', true),
  ('admin_content_submitted', true),
  ('feedback', true),
  ('campaign_notification', true),
  ('offer_claimed_creator', true),
  ('visit_confirmed_creator', true),
  ('reel_due_reminder', true),
  ('new_claim_business', true),
  ('reel_submitted_creator', true),
  ('slot_ready', true),
  ('content_deadline_reminder', true),
  ('content_overdue', true)
on conflict (email_type) do nothing;

-- RLS: only admins can read/write. Service role (used by edge functions)
-- bypasses RLS so the webhook handler can still query the table.
alter table public.notification_settings enable row level security;

drop policy if exists notification_settings_select on public.notification_settings;
drop policy if exists notification_settings_update on public.notification_settings;

create policy notification_settings_select on public.notification_settings
  for select to authenticated
  using (public.is_admin());

create policy notification_settings_update on public.notification_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Trigger to keep updated_at fresh
create or replace function public.touch_notification_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_settings_touch_updated on public.notification_settings;
create trigger notification_settings_touch_updated
  before update on public.notification_settings
  for each row execute function public.touch_notification_settings_updated_at();
