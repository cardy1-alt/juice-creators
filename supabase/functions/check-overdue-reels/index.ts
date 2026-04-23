// Supabase Edge Function: check-overdue-reels
// Run periodically via cron. Checks for:
// 1. Content deadline approaching (48 hours) — sends reminder
// 2. Content deadline passed — marks participation as overdue
// 3. Selection confirmation window expired (48 hours since selected_at) —
//    auto-declines the application so the spot can be offered elsewhere
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
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  let remindersSent = 0;
  let markedOverdue = 0;
  let selectionsExpired = 0;

  // 1. Send 48-hour content deadline reminder
  // Find participations where content_deadline is within 48 hours and reel not submitted.
  // A per-creator content_deadline_override (if set) takes precedence over
  // the campaign-wide deadline — brands sometimes grant individual extensions
  // and the cron shouldn't warn/mark-overdue against a stale campaign date.
  const { data: dueSoon } = await supabase
    .from('participations')
    .select('id, creator_id, campaign_id, content_deadline_override, campaigns(title, content_deadline, businesses(name))')
    .in('status', ['confirmed', 'visited'])
    .is('reel_url', null);

  if (dueSoon && dueSoon.length > 0) {
    for (const part of dueSoon) {
      const campaign = (part as any).campaigns;
      const contentDeadline = (part as any).content_deadline_override || campaign?.content_deadline;
      if (!contentDeadline) continue;

      const deadline = new Date(contentDeadline);
      // Only send reminder if deadline is within 48 hours and hasn't passed yet
      if (deadline > now && deadline <= fortyEightHoursFromNow) {
        // Check if reminder already sent for this participation
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', part.creator_id)
          .eq('campaign_id', part.campaign_id)
          .eq('email_type', 'content_deadline_reminder');

        if (!count || count === 0) {
          const brandName = campaign?.businesses?.name || 'the brand';
          await supabase.from('notifications').insert({
            user_id: part.creator_id,
            user_type: 'creator',
            message: `Your Reel for ${brandName} is due in less than 48 hours.`,
            email_type: 'content_deadline_reminder',
            campaign_id: part.campaign_id,
            email_meta: {
              brand_name: brandName,
              campaign_id: part.campaign_id,
              campaign_title: campaign?.title || '',
            },
          });
          remindersSent++;
        }
      }
    }
  }

  // 2. Mark overdue participations
  // Find participations where content_deadline has passed, reel not submitted, not already overdue/completed
  const { data: allActive } = await supabase
    .from('participations')
    .select('id, creator_id, campaign_id, content_deadline_override, campaigns(content_deadline, businesses(name))')
    .in('status', ['confirmed', 'visited'])
    .is('reel_url', null);

  if (allActive && allActive.length > 0) {
    for (const part of allActive) {
      const contentDeadline = (part as any).content_deadline_override || (part as any).campaigns?.content_deadline;
      if (!contentDeadline) continue;

      if (new Date(contentDeadline) <= now) {
        await supabase
          .from('participations')
          .update({ status: 'overdue' })
          .eq('id', part.id);

        const brandName = (part as any).campaigns?.businesses?.name || 'the brand';
        await supabase.from('notifications').insert({
          user_id: part.creator_id,
          user_type: 'creator',
          message: `Your Reel for ${brandName} is overdue. The content deadline has passed.`,
          email_type: 'content_overdue',
          campaign_id: part.campaign_id,
          email_meta: {
            brand_name: brandName,
            campaign_id: part.campaign_id,
            campaign_title: (part as any).campaigns?.title || '',
          },
        });
        markedOverdue++;
      }
    }
  }

  // 3. Auto-decline selections that the creator didn't confirm within 48 hours.
  // This frees the spot back up for another creator and keeps the pipeline moving.
  const { data: staleSelections } = await supabase
    .from('applications')
    .select('id, creator_id, campaign_id, campaigns(title, businesses(name))')
    .eq('status', 'selected')
    .lt('selected_at', fortyEightHoursAgo.toISOString());

  if (staleSelections && staleSelections.length > 0) {
    for (const app of staleSelections) {
      const { error: updErr } = await supabase
        .from('applications')
        .update({ status: 'declined' })
        .eq('id', app.id);
      if (updErr) continue;

      const brandName = (app as any).campaigns?.businesses?.name || 'the brand';
      const campaignTitle = (app as any).campaigns?.title || '';
      await supabase.from('notifications').insert({
        user_id: app.creator_id,
        user_type: 'creator',
        message: `Your selection for ${brandName} expired — the 48-hour confirmation window passed.`,
        email_type: 'selection_expired',
        campaign_id: app.campaign_id,
        email_meta: {
          brand_name: brandName,
          campaign_id: app.campaign_id,
          campaign_title: campaignTitle,
        },
      });
      selectionsExpired++;
    }
  }

  return new Response(
    JSON.stringify({
      reminders_sent: remindersSent,
      marked_overdue: markedOverdue,
      selections_expired: selectionsExpired,
    }),
    { status: 200 }
  );
});
