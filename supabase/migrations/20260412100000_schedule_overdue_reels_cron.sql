-- Schedule the check-overdue-reels edge function to run daily at 09:00 UTC.
-- This sends 48-hour deadline reminders and marks overdue participations.
--
-- Requires: pg_cron extension (enable via Supabase dashboard → Database → Extensions)
-- Requires: pg_net extension (usually enabled by default on Supabase)
--
-- The function url and service role key must be set in Supabase vault or
-- injected at migration time. We use app_settings here which you'll need to
-- configure per-environment.

-- Create helper function that invokes the edge function
create or replace function public.invoke_check_overdue_reels()
returns void
language plpgsql
security definer
as $$
declare
  function_url text;
  service_key text;
begin
  -- Read from vault / app_settings (set via dashboard)
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/check-overdue-reels';
  service_key := current_setting('app.service_role_key', true);

  if function_url is null or service_key is null then
    raise notice 'Skipping check-overdue-reels: app.supabase_url or app.service_role_key not configured';
    return;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Schedule daily at 09:00 UTC (adjust as needed)
-- Unschedule first if it exists to avoid duplicates on re-run
do $$
begin
  perform cron.unschedule('check-overdue-reels-daily');
exception when others then null;
end $$;

select cron.schedule(
  'check-overdue-reels-daily',
  '0 9 * * *',
  $$select public.invoke_check_overdue_reels();$$
);
