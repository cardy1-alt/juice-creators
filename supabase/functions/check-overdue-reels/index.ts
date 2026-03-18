// Supabase Edge Function: check-overdue-reels
// Run periodically via Supabase cron (pg_cron) or external scheduler.
// 1. Sends a 24-hour reminder notification for reels due soon
// 2. Sends a 6-hour warning notification for reels due very soon
// 3. Marks claims as 'overdue' when reel_due_at has passed with no reel submitted
//
// Required env vars (auto-set by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  let remindersSent = 0;

  // 1. Send 24-hour reel due reminder (uses the reel_due_reminder email template)
  const { data: dueSoon24 } = await supabase
    .from('claims')
    .select('id, creator_id, business_id, reel_due_at, businesses(name)')
    .eq('status', 'redeemed')
    .is('reel_url', null)
    .gt('reel_due_at', sixHoursFromNow.toISOString())
    .lte('reel_due_at', twentyFourHoursFromNow.toISOString());

  if (dueSoon24 && dueSoon24.length > 0) {
    for (const claim of dueSoon24) {
      // Check if 24hr reminder already sent
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', claim.creator_id)
        .eq('email_type', 'reel_due_reminder');

      if (!count || count === 0) {
        const businessName = (claim as any).businesses?.name || 'the business';
        await supabase.from('notifications').insert({
          user_id: claim.creator_id,
          user_type: 'creator',
          message: `Reminder: Your Reel for ${businessName} is due in less than 24 hours.`,
          email_type: 'reel_due_reminder',
          email_meta: {
            business_name: businessName,
            reel_due_at: claim.reel_due_at || '',
          },
        });
        remindersSent++;
      }
    }
  }

  // 2. Send 6-hour warning for reels due very soon
  const { data: dueSoon6 } = await supabase
    .from('claims')
    .select('id, creator_id, business_id, reel_due_at, businesses(name)')
    .eq('status', 'redeemed')
    .is('reel_url', null)
    .gt('reel_due_at', now.toISOString())
    .lte('reel_due_at', sixHoursFromNow.toISOString());

  let warningsSent = 0;
  if (dueSoon6 && dueSoon6.length > 0) {
    for (const claim of dueSoon6) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', claim.creator_id)
        .like('message', `%reel for ${(claim as any).businesses?.name}%due soon%`);

      if (!count || count === 0) {
        const businessName = (claim as any).businesses?.name || 'the business';
        await supabase.from('notifications').insert({
          user_id: claim.creator_id,
          user_type: 'creator',
          message: `Your reel for ${businessName} is due soon! Less than 6 hours remaining.`,
        });
        warningsSent++;
      }
    }
  }

  // 3. Mark overdue claims
  const { data: overdue } = await supabase
    .from('claims')
    .select('id, creator_id, business_id, businesses(name)')
    .eq('status', 'redeemed')
    .is('reel_url', null)
    .lte('reel_due_at', now.toISOString());

  if (overdue && overdue.length > 0) {
    const overdueIds = overdue.map(c => c.id);
    await supabase
      .from('claims')
      .update({ status: 'overdue' })
      .in('id', overdueIds);

    for (const claim of overdue) {
      const businessName = (claim as any).businesses?.name || 'the business';
      await supabase.from('notifications').insert({
        user_id: claim.creator_id,
        user_type: 'creator',
        message: `Your reel for ${businessName} is overdue. The 48-hour deadline has passed.`,
      });
    }
  }

  return new Response(
    JSON.stringify({
      reminders_sent_24h: remindersSent,
      warnings_sent_6h: warningsSent,
      marked_overdue: overdue?.length || 0,
    }),
    { status: 200 }
  );
});
