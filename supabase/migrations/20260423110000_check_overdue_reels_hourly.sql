-- ═══════════════════════════════════════════════════════════════
-- NAYBA — run check-overdue-reels hourly instead of daily
--
-- The original schedule (20260412100000) runs the cron at 09:00 UTC
-- once a day. With T-24h selection reminders and slot-reopened
-- brand/admin notifications now hanging off the same job, daily
-- cadence means a reminder can land up to a day late and an
-- auto-decline can lag up to 33h past the 48h mark. Hourly keeps
-- the business rules tight without changing them.
--
-- The edge function itself guards against duplicate work via the
-- notifications table, so running more often is safe.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  perform cron.unschedule('check-overdue-reels-daily');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('check-overdue-reels-hourly');
exception when others then null;
end $$;

select cron.schedule(
  'check-overdue-reels-hourly',
  '0 * * * *',
  $$select public.invoke_check_overdue_reels();$$
);
