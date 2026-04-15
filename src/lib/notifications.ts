import { supabase } from './supabase';

/**
 * Insert a notification that triggers the send-email edge function via webhook.
 * The edge function reads email_type to pick the right template and email_meta
 * for template variables. Enabled/disabled state is checked server-side in the
 * edge function via the notification_settings table, so toggles work regardless
 * of which browser triggered the notification.
 */
async function insertNotification(params: {
  userId: string;
  userType: 'creator' | 'business' | 'admin';
  message: string;
  emailType: string;
  emailMeta?: Record<string, string>;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    user_type: params.userType,
    message: params.message,
    email_type: params.emailType,
    email_meta: params.emailMeta || {},
  });
  if (error) {
    console.error(`[notifications] Failed to insert ${params.emailType}:`, error.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function sendCreatorWelcomeEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Welcome to Nayba! Explore local collabs and claim your first one.',
    emailType: 'creator_welcome',
  });
}

export async function sendBusinessWelcomeEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Welcome to Nayba! Create your first collab to start attracting creators.',
    emailType: 'business_welcome',
  });
}

export async function sendAdminSignupNotification(params: {
  userType: 'creator' | 'business';
  displayName: string;
  email: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000', // placeholder for admin notifications
    userType: 'admin',
    message: `New ${params.userType} signup: ${params.displayName} (${params.email})`,
    emailType: 'admin_signup',
    emailMeta: {
      user_type: params.userType,
      display_name: params.displayName,
      email: params.email,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function sendCreatorApprovedEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Your creator account has been approved! Start exploring collabs.',
    emailType: 'creator_approved',
  });
}

export async function sendBusinessApprovedEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Your business account has been approved! Create your first collab.',
    emailType: 'business_approved',
  });
}

export async function sendCreatorDeniedEmail(creatorId: string): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: 'Your creator application was not approved at this time.',
    emailType: 'creator_denied',
  });
}

export async function sendBusinessDeniedEmail(businessId: string): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: 'Your business application was not approved at this time.',
    emailType: 'business_denied',
  });
}

export async function sendBusinessCampaignLiveEmail(businessId: string, meta: {
  campaign_title: string;
  headline: string;
  perk_description: string;
  creator_target: number;
  expression_deadline: string;
}): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: `Your campaign "${meta.campaign_title}" is now live!`,
    emailType: 'business_campaign_live',
    emailMeta: {
      campaign_title: meta.campaign_title,
      headline: meta.headline,
      perk_description: meta.perk_description,
      creator_target: meta.creator_target.toString(),
      expression_deadline: meta.expression_deadline,
    },
  });
}

export async function sendAdminApprovalRequest(params: {
  userType: 'creator' | 'business';
  userId: string;
  displayName: string;
  email: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `New ${params.userType} awaiting approval: ${params.displayName} (${params.email})`,
    emailType: 'admin_approval_request',
    emailMeta: {
      user_type: params.userType,
      user_id: params.userId,
      display_name: params.displayName,
      email: params.email,
    },
  });
}

// ─── Campaign Lifecycle Emails ──────────────────────────────────────────

export async function sendCreatorSelectedEmail(creatorId: string, meta: {
  campaign_title: string;
  brand_name: string;
  campaign_id: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `You've been selected for ${meta.brand_name}'s campaign — confirm your spot!`,
    emailType: 'creator_selected',
    emailMeta: {
      campaign_title: meta.campaign_title,
      brand_name: meta.brand_name,
      campaign_id: meta.campaign_id,
      cta_url: `https://app.nayba.app?campaign=${meta.campaign_id}`,
    },
  });
}

export async function sendCreatorConfirmedEmail(creatorId: string, meta: {
  campaign_title: string;
  brand_name: string;
  perk_description: string;
  brand_address?: string;
  brand_instructions?: string;
  brand_instagram?: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `You're confirmed for ${meta.brand_name} — here's what happens next`,
    emailType: 'creator_confirmed',
    emailMeta: {
      campaign_title: meta.campaign_title,
      brand_name: meta.brand_name,
      perk_description: meta.perk_description,
      brand_address: meta.brand_address || '',
      brand_instructions: meta.brand_instructions || '',
      brand_instagram: meta.brand_instagram || '',
    },
  });
}

export async function sendBusinessCreatorConfirmedEmail(businessId: string, meta: {
  creator_name: string;
  creator_instagram: string;
  campaign_title: string;
  perk_description: string;
}): Promise<void> {
  await insertNotification({
    userId: businessId,
    userType: 'business',
    message: `${meta.creator_name} is confirmed for your campaign — they'll visit soon`,
    emailType: 'business_creator_confirmed',
    emailMeta: {
      creator_name: meta.creator_name,
      creator_instagram: meta.creator_instagram,
      campaign_title: meta.campaign_title,
      perk_description: meta.perk_description,
    },
  });
}

export async function sendCreatorDeadlineReminderEmail(creatorId: string, meta: {
  campaign_title: string;
  brand_name: string;
  campaign_id: string;
  content_deadline: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `Heads up — your Reel for ${meta.brand_name} is due in 48 hours`,
    emailType: 'creator_deadline_reminder',
    emailMeta: {
      campaign_title: meta.campaign_title,
      brand_name: meta.brand_name,
      campaign_id: meta.campaign_id,
      content_deadline: meta.content_deadline,
      cta_url: `https://app.nayba.app?campaign=${meta.campaign_id}`,
    },
  });
}

export async function sendCreatorContentReceivedEmail(creatorId: string, meta: {
  campaign_title: string;
  brand_name: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `We got your Reel for ${meta.brand_name} — thanks for sharing your experience!`,
    emailType: 'creator_content_received',
    emailMeta: {
      campaign_title: meta.campaign_title,
      brand_name: meta.brand_name,
    },
  });
}

// ─── Admin Activity Notifications ──────────────────────────────────────

export async function sendAdminContentSubmittedEmail(meta: {
  creator_name: string;
  campaign_title: string;
  brand_name: string;
  reel_url: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `${meta.creator_name} submitted a Reel for ${meta.brand_name} — ${meta.campaign_title}`,
    emailType: 'admin_content_submitted',
    emailMeta: meta,
  });
}

export async function sendAdminInterestExpressedEmail(meta: {
  creator_name: string;
  campaign_title: string;
  brand_name: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `${meta.creator_name} expressed interest in ${meta.brand_name} — ${meta.campaign_title}`,
    emailType: 'admin_interest_expressed',
    emailMeta: meta,
  });
}

export async function sendAdminCreatorConfirmedEmail(meta: {
  creator_name: string;
  campaign_title: string;
  brand_name: string;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `${meta.creator_name} confirmed their spot for ${meta.brand_name} — ${meta.campaign_title}`,
    emailType: 'admin_creator_confirmed',
    emailMeta: meta,
  });
}

export async function sendCreatorCampaignCompleteEmail(creatorId: string, meta: {
  campaign_title: string;
  brand_name: string;
  total_campaigns: number;
  completion_rate: number;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `Campaign complete — nice work on ${meta.brand_name}!`,
    emailType: 'creator_campaign_complete',
    emailMeta: {
      campaign_title: meta.campaign_title,
      brand_name: meta.brand_name,
      total_campaigns: meta.total_campaigns.toString(),
      completion_rate: meta.completion_rate.toString(),
    },
  });
}

// ─── Community Campaigns (Prize Draw) ───────────────────────────────────

/**
 * Sent when a creator enters a community/prize-draw campaign. Replaces
 * sendCreatorConfirmedEmail for the community flow — there's no brand to
 * promise a perk from, just confirmation that the entry is in.
 */
export async function sendCreatorEnteredCommunityEmail(creatorId: string, meta: {
  campaign_title: string;
  perk_description: string;
  content_deadline: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `You're entered into "${meta.campaign_title}" — submit your Reel to be in the draw`,
    emailType: 'creator_entered_community',
    emailMeta: {
      campaign_title: meta.campaign_title,
      perk_description: meta.perk_description,
      content_deadline: meta.content_deadline,
    },
  });
}

/** Sent to each winning creator after admin picks winners. */
export async function sendCreatorWonCommunityEmail(creatorId: string, meta: {
  campaign_title: string;
  perk_description: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `You won "${meta.campaign_title}"! We'll be in touch with your prize.`,
    emailType: 'creator_won_community',
    emailMeta: {
      campaign_title: meta.campaign_title,
      perk_description: meta.perk_description,
    },
  });
}

/** Sent to non-winning creators after admin picks winners. */
export async function sendCreatorNotSelectedCommunityEmail(creatorId: string, meta: {
  campaign_title: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `"${meta.campaign_title}" — the winners are picked. Thanks for entering!`,
    emailType: 'creator_not_selected_community',
    emailMeta: {
      campaign_title: meta.campaign_title,
    },
  });
}

/** Admin summary after winners are picked. */
export async function sendAdminCommunityWinnersPickedEmail(meta: {
  campaign_title: string;
  num_winners: number;
  num_entries: number;
}): Promise<void> {
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `${meta.num_winners} winner${meta.num_winners === 1 ? '' : 's'} picked for "${meta.campaign_title}" (${meta.num_entries} entries)`,
    emailType: 'admin_community_winners_picked',
    emailMeta: {
      campaign_title: meta.campaign_title,
      num_winners: meta.num_winners.toString(),
      num_entries: meta.num_entries.toString(),
    },
  });
}

// ─── Weekly Digest ──────────────────────────────────────────────────────

export async function sendWeeklyDigestEmail(creatorId: string, meta: {
  creator_name: string;
  campaigns: { title: string; brand_name: string; perk_summary: string; campaign_id: string }[];
  city: string;
}): Promise<void> {
  await insertNotification({
    userId: creatorId,
    userType: 'creator',
    message: `This week's campaigns in ${meta.city} — ${meta.campaigns.length} new opportunities`,
    emailType: 'weekly_digest',
    emailMeta: {
      creator_name: meta.creator_name,
      city: meta.city,
      campaign_count: meta.campaigns.length.toString(),
      campaigns_json: JSON.stringify(meta.campaigns),
    },
  });
}

// ─── Feedback ───────────────────────────────────────────────────────────

export async function sendFeedbackEmail(params: {
  userId: string;
  userType: 'creator' | 'business';
  displayName: string;
  page: string;
  feedback: string;
}): Promise<void> {
  // Save to feedback table
  await supabase.from('feedback').insert({
    user_id: params.userId,
    user_type: params.userType,
    display_name: params.displayName,
    page: params.page,
    message: params.feedback,
  });

  // Send email notification
  await insertNotification({
    userId: '00000000-0000-0000-0000-000000000000',
    userType: 'admin',
    message: `Feedback from ${params.displayName}: ${params.feedback.slice(0, 100)}`,
    emailType: 'feedback',
    emailMeta: {
      user_id: params.userId,
      user_type: params.userType,
      display_name: params.displayName,
      page: params.page,
      feedback: params.feedback,
    },
  });
}
