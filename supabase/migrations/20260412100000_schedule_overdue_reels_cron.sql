-- Schedule the check-overdue-reels edge function to run daily at 09:00 UTC.
-- This sends 48-hour deadline reminders and marks overdue participations.
--
-- Requires: pg_cron extension (enable via Supabase dashboard → Database → Extensions)
-- Requires: pg_net extension (enable via Supabase dashboard → Database → Extensions)
--
-- Secrets must be stored in Supabase Vault before this migration runs:
--   select vault.create_secret('https://your-project.supabase.co', 'supabase_url');
--   select vault.create_secret('your-service-role-key', 'service_role_key');

-- Create helper function that invokes the edge function
create or replace function public.invoke_check_overdue_reels()
returns void
language plpgsql
security definer
as $$
declare
  function_url text;
  service_key text;
  base_url text;
begin
  -- Read from vault (must be created via vault.create_secret beforehand)
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if base_url is null or service_key is null then
    raise notice 'Skipping check-overdue-reels: vault secrets supabase_url or service_role_key not configured';
    return;
  end if;

  function_url := base_url || '/functions/v1/check-overdue-reels';

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
