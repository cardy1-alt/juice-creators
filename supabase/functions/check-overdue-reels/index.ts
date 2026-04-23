// Supabase Edge Function: check-overdue-reels
// Run periodically via cron (hourly). Checks for:
// 1. Content deadline approaching (48 hours) — sends reminder
// 2. Content deadline passed — marks participation as overdue
// 3. Selection T-24h — creator was selected ~24h ago and still hasn't
//    confirmed; nudge them before the window closes.
// 4. Selection confirmation window expired (48 hours since selected_at) —
//    auto-declines the application so the spot can be offered elsewhere
//    and notifies the brand + admin that a slot just reopened.
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
  // T-24h reminder window — pick anything selected between 25h and 23h ago
  // so an hourly cron always catches each selection exactly once.
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  let remindersSent = 0;
  let markedOverdue = 0;
  let selectionsExpired = 0;
  let selectionReminders = 0;

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

  // 3. T-24h selection reminder — pending confirmations that are ~24h old.
  // Guard on the notifications table so re-runs within the same window
  // (we run hourly) don't double-send.
  const { data: pendingSelections } = await supabase
    .from('applications')
    .select('id, creator_id, campaign_id, selected_at, campaigns(title, campaign_type, businesses(name))')
    .eq('status', 'selected')
    .gte('selected_at', twentyFiveHoursAgo.toISOString())
    .lte('selected_at', twentyThreeHoursAgo.toISOString());

  if (pendingSelections && pendingSelections.length > 0) {
    for (const app of pendingSelections) {
      // Community campaigns auto-confirm at apply-time — they never
      // transition through 'selected', but belt-and-braces skip them.
      const campaign = (app as any).campaigns;
      if (campaign?.campaign_type === 'community') continue;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', app.creator_id)
        .eq('campaign_id', app.campaign_id)
        .eq('email_type', 'creator_selection_reminder_24h');
      if (count && count > 0) continue;

      const brandName = campaign?.businesses?.name || 'the brand';
      await supabase.from('notifications').insert({
        user_id: app.creator_id,
        user_type: 'creator',
        message: `Heads up — your selection for ${brandName} closes in about a day.`,
        email_type: 'creator_selection_reminder_24h',
        campaign_id: app.campaign_id,
        email_meta: {
          brand_name: brandName,
          campaign_id: app.campaign_id,
          campaign_title: campaign?.title || '',
          cta_url: `https://app.nayba.app?campaign=${app.campaign_id}`,
        },
      });
      selectionReminders++;
    }
  }

  // 4. Auto-decline selections that the creator didn't confirm within 48 hours.
  // This frees the spot back up for another creator and keeps the pipeline moving.
  // Also notifies the brand owner + admin so the reopened slot doesn't sit unnoticed.
  const { data: staleSelections } = await supabase
    .from('applications')
    .select('id, creator_id, campaign_id, campaigns(title, brand_id, businesses(id, owner_email, name)), creators(name, display_name)')
    .eq('status', 'selected')
    .lt('selected_at', fortyEightHoursAgo.toISOString());

  if (staleSelections && staleSelections.length > 0) {
    for (const app of staleSelections) {
      const { error: updErr } = await supabase
        .from('applications')
        .update({ status: 'declined' })
        .eq('id', app.id);
      if (updErr) continue;

      const campaign = (app as any).campaigns;
      const brand = campaign?.businesses;
      const brandName = brand?.name || 'the brand';
      const campaignTitle = campaign?.title || '';
      const creator = (app as any).creators;
      const creatorName = creator?.display_name || creator?.name || 'A creator';

      // Creator — existing behaviour.
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

      // Count reserves still sitting as 'interested' on this campaign so
      // the brand/admin can see at a glance whether a reserve is ready.
      const { count: reservesCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', app.campaign_id)
        .eq('status', 'interested');
      const reserves = reservesCount || 0;

      // Brand — owner of the campaign.
      if (brand?.id) {
        await supabase.from('notifications').insert({
          user_id: brand.id,
          user_type: 'business',
          message: `${creatorName} didn't confirm in time for ${campaignTitle} — their slot is open again.`,
          email_type: 'business_selection_expired',
          campaign_id: app.campaign_id,
          email_meta: {
            creator_name: creatorName,
            campaign_title: campaignTitle,
            campaign_id: app.campaign_id,
            reserves_remaining: String(reserves),
            cta_url: `https://app.nayba.app?campaign=${app.campaign_id}`,
          },
        });
      }

      // Admin — sentinel user id, matches the pattern used by the other
      // admin notifications in notifications.ts.
      await supabase.from('notifications').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        user_type: 'admin',
        message: `Selection expired — ${creatorName} didn't confirm for ${brandName} / ${campaignTitle}. ${reserves} reserve${reserves === 1 ? '' : 's'} available.`,
        email_type: 'admin_selection_expired',
        campaign_id: app.campaign_id,
        email_meta: {
          creator_name: creatorName,
          brand_name: brandName,
          campaign_title: campaignTitle,
          reserves_remaining: String(reserves),
        },
      });

      selectionsExpired++;
    }
  }

  return new Response(
    JSON.stringify({
      reminders_sent: remindersSent,
      marked_overdue: markedOverdue,
      selection_reminders: selectionReminders,
      selections_expired: selectionsExpired,
    }),
    { status: 200 }
  );
});
