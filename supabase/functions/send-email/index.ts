// Supabase Edge Function: send-email
// Triggered by DB webhook on notifications table INSERT
// Uses Resend to deliver transactional emails for all platform events
//
// Required env vars (set via Supabase dashboard):
//   RESEND_API_KEY — your Resend API key
//   SUPABASE_URL — auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-set by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_EMAIL = 'Nayba <hello@nayba.app>';
const ADMIN_EMAIL = 'hello@nayba.app';
const APP_URL = 'https://nayba.vercel.app';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Email template types ─────────────────────────────────────────────────
// email_type values stored in notifications.email_type:
//   creator_welcome, business_welcome, offer_claimed_creator,
//   visit_confirmed_creator, reel_due_reminder, new_claim_business,
//   admin_signup, feedback
// If email_type is null/empty, falls back to generic notification email.

interface NotificationRecord {
  id: string;
  user_id: string;
  user_type: string;
  message: string;
  email_sent: boolean;
  email_type?: string;
  email_meta?: Record<string, string>;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: Record<string, unknown>;
}

// ─── Nayba email wrapper ──────────────────────────────────────────────────
function wrapEmail(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #222222;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h2 style="margin: 0; color: #1A3C34; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">nayba</h2>
      </div>
      ${body}
      <p style="text-align: center; margin-top: 32px; color: #999; font-size: 12px;">
        — The Nayba Team
      </p>
    </div>
  `;
}

// ─── Template builders ────────────────────────────────────────────────────

function creatorWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Nayba!',
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Welcome to Nayba — we're really glad you're here.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Nayba connects you with local businesses who want to work with creators like you. Browse offers from cafes, salons, gyms, and more in your area. Claim an offer, visit the business, and post an Instagram Reel — that's it.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Your account is being reviewed by our team. Once approved, you'll be able to start exploring offers and claiming your first one.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">In the meantime, make sure your profile is looking good — businesses will see it when you claim their offers.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Open Nayba</a>
    `),
  };
}

function businessWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Nayba!',
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Welcome to Nayba — great to have you on board.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Nayba turns local creators into your marketing team — no budget required. You create an offer (a free coffee, a haircut, a discount — whatever feels right), local creators claim it, visit your business, and post an authentic Instagram Reel about the experience.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Your next step is to create your first offer. It only takes a minute, and once it's live, creators in your area will be able to discover and claim it right away.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">If you have any questions, just reply to this email — we're here to help.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Create your first offer</a>
    `),
  };
}

function offerClaimedCreatorEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const offerTitle = meta.offer_title || 'an offer';
  const businessName = meta.business_name || 'a local business';
  return {
    subject: `You claimed ${offerTitle} from ${businessName}`,
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Nice one — you've just claimed <strong>${escapeHtml(offerTitle)}</strong> from <strong>${escapeHtml(businessName)}</strong>.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Here's what happens next:</p>
      <ol style="font-size: 15px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
        <li>Visit ${escapeHtml(businessName)} in person and show your QR pass</li>
        <li>Enjoy the experience</li>
        <li>Post an Instagram Reel within <strong>48 hours</strong> of your visit</li>
      </ol>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">Your QR pass is ready in the app. Head over when you're ready!</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">View your pass</a>
    `),
  };
}

function visitConfirmedCreatorEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const businessName = meta.business_name || 'the business';
  const reelDueAt = meta.reel_due_at || '';
  let deadlineStr = '';
  if (reelDueAt) {
    try {
      const d = new Date(reelDueAt);
      deadlineStr = d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    } catch { deadlineStr = reelDueAt; }
  }
  return {
    subject: `Visit confirmed — your 48hr Reel clock has started`,
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">${escapeHtml(businessName)} has confirmed your visit — nice work!</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Your <strong>48-hour Reel clock has now started</strong>. Post your Instagram Reel and submit the link in the app before the deadline.</p>
      ${deadlineStr ? `<div style="background: #FFF5F2; border-radius: 12px; padding: 16px 20px; margin: 0 0 16px; border: 1px solid #F5DDD5;">
        <p style="margin: 0; font-size: 14px; color: #C4674A; font-weight: 600;">Deadline: ${escapeHtml(deadlineStr)}</p>
      </div>` : ''}
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">Keep it authentic — just share your honest experience at ${escapeHtml(businessName)}. That's what makes Nayba work.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Submit your Reel</a>
    `),
  };
}

function reelDueReminderEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const businessName = meta.business_name || 'the business';
  const reelDueAt = meta.reel_due_at || '';
  let deadlineStr = '';
  if (reelDueAt) {
    try {
      const d = new Date(reelDueAt);
      deadlineStr = d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    } catch { deadlineStr = reelDueAt; }
  }
  return {
    subject: `Reminder: Your Reel for ${businessName} is due soon`,
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Friendly reminder — your Reel for <strong>${escapeHtml(businessName)}</strong> is due in less than 24 hours.</p>
      ${deadlineStr ? `<div style="background: #FFF5F2; border-radius: 12px; padding: 16px 20px; margin: 0 0 16px; border: 1px solid #F5DDD5;">
        <p style="margin: 0; font-size: 14px; color: #C4674A; font-weight: 600;">Deadline: ${escapeHtml(deadlineStr)}</p>
      </div>` : ''}
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Post your Instagram Reel and then paste the link in the Nayba app. It doesn't need to be perfect — just authentic.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">If you miss the deadline, the claim will be marked as overdue. Don't let a good experience go to waste!</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Submit your Reel now</a>
    `),
  };
}

function newClaimBusinessEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const creatorName = meta.creator_name || 'A creator';
  const offerTitle = meta.offer_title || 'your offer';
  return {
    subject: `${creatorName} just claimed ${offerTitle}`,
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Good news — <strong>${escapeHtml(creatorName)}</strong> has just claimed <strong>${escapeHtml(offerTitle)}</strong>.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">They'll be visiting your business soon. When they arrive, open the Nayba app and scan their QR code to confirm the visit.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">After the visit, they have 48 hours to post an Instagram Reel about their experience. You'll be notified once it's submitted.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Open Nayba</a>
    `),
  };
}

function creatorApprovedEmail(name: string): { subject: string; html: string } {
  return {
    subject: "You're approved — welcome to Nayba!",
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Great news — your Nayba creator account has been approved! 🎉</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">You can now browse offers from local businesses in your area, claim the ones you like, and start creating. Here's how it works:</p>
      <ol style="font-size: 15px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
        <li>Browse and claim an offer</li>
        <li>Visit the business and show your QR pass</li>
        <li>Post an Instagram Reel within 48 hours</li>
      </ol>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">Jump in and claim your first offer — there are businesses waiting to work with you.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Explore offers</a>
    `),
  };
}

function businessApprovedEmail(name: string): { subject: string; html: string } {
  return {
    subject: "You're approved — welcome to Nayba!",
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Great news — your Nayba business account has been approved! 🎉</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">You're now live on the platform. Create your first offer and local creators will be able to discover and claim it right away.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">If you need any help getting started, just reply to this email — we're here for you.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Create your first offer</a>
    `),
  };
}

function creatorDeniedEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Update on your Nayba application',
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Thanks for your interest in Nayba. After reviewing your application, we're unable to approve your creator account at this time.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">This could be for a number of reasons — incomplete profile, follower count, or content fit. If you think this was a mistake, or if anything has changed, feel free to reply to this email and we'll take another look.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">We appreciate your time and hope to welcome you in the future.</p>
    `),
  };
}

function businessDeniedEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Update on your Nayba application',
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Thanks for your interest in Nayba. After reviewing your application, we're unable to approve your business account at this time.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">If you believe this was a mistake or would like more information, please reply to this email and we'll be happy to help.</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">We appreciate your interest and hope to work with you in the future.</p>
    `),
  };
}

function adminApprovalRequestEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const displayName = meta.display_name || 'Unknown';
  const userEmail = meta.email || 'Unknown';
  return {
    subject: `Action required: New ${userType} awaiting approval — ${displayName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #222;">New ${escapeHtml(userType)} awaiting approval</h3>
        <table style="font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 20px;">
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Type</td><td>${escapeHtml(userType)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Name</td><td>${escapeHtml(displayName)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Email</td><td>${escapeHtml(userEmail)}</td></tr>
        </table>
        <a href="${APP_URL}?demo=admin" style="display: inline-block; background: #1A3C34; color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 14px;">Review in Admin Dashboard</a>
      </div>
    `,
  };
}

function genericNotificationEmail(name: string, message: string): { subject: string; html: string } {
  return {
    subject: `Nayba — ${message.slice(0, 60)}`,
    html: wrapEmail(`
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 24px;">${escapeHtml(message)}</p>
      <a href="${APP_URL}" style="display: inline-block; background: #C4674A; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">Open Nayba</a>
    `),
  };
}

// ─── Admin signup notification ────────────────────────────────────────────
function adminSignupEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const displayName = meta.display_name || 'Unknown';
  const email = meta.email || 'Unknown';
  const timestamp = meta.timestamp || new Date().toISOString();
  return {
    subject: `New ${userType} signup: ${displayName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #222;">New ${escapeHtml(userType)} signup on Nayba</h3>
        <table style="font-size: 14px; line-height: 1.6; color: #333;">
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">User type</td><td>${escapeHtml(userType)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Name</td><td>${escapeHtml(displayName)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Email</td><td>${escapeHtml(email)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Timestamp</td><td>${escapeHtml(timestamp)}</td></tr>
        </table>
      </div>
    `,
  };
}

// ─── Feedback email ───────────────────────────────────────────────────────
function feedbackEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const userId = meta.user_id || 'unknown';
  const page = meta.page || 'unknown';
  const feedbackText = meta.feedback || '';
  return {
    subject: `Feedback from ${userType} (${meta.display_name || userId})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #222;">New feedback on Nayba</h3>
        <table style="font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 16px;">
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">From</td><td>${escapeHtml(meta.display_name || userId)} (${escapeHtml(userType)})</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">User ID</td><td>${escapeHtml(userId)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #999;">Page</td><td>${escapeHtml(page)}</td></tr>
        </table>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #222;">
          ${escapeHtml(feedbackText)}
        </div>
      </div>
    `,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    console.log('[send-email] Payload received:', JSON.stringify(payload).slice(0, 500));

    // Only process notification inserts
    if (payload.table !== 'notifications' || payload.type !== 'INSERT') {
      console.log('[send-email] Skipped: not a notifications INSERT', payload.type, payload.table);
      return new Response(JSON.stringify({ skipped: true, reason: 'not_insert' }), { status: 200 });
    }

    const notification = payload.record as NotificationRecord;
    console.log('[send-email] Notification:', JSON.stringify(notification).slice(0, 500));

    // Skip if already sent
    if (notification.email_sent) {
      console.log('[send-email] Skipped: already sent');
      return new Response(JSON.stringify({ skipped: true, reason: 'already_sent' }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const emailType = notification.email_type || '';
    const meta = (notification.email_meta || {}) as Record<string, string>;

    // Determine recipient
    let recipientEmail: string | null = null;
    let recipientName = '';

    if (emailType === 'admin_signup' || emailType === 'feedback') {
      // These go to the admin inbox
      recipientEmail = ADMIN_EMAIL;
      recipientName = 'Admin';
    } else if (notification.user_type === 'creator') {
      const { data } = await supabase
        .from('creators')
        .select('email, name, display_name')
        .eq('id', notification.user_id)
        .single();
      if (data) {
        recipientEmail = data.email;
        recipientName = data.display_name || data.name;
      }
    } else if (notification.user_type === 'business') {
      const { data } = await supabase
        .from('businesses')
        .select('owner_email, name')
        .eq('id', notification.user_id)
        .single();
      if (data) {
        recipientEmail = data.owner_email;
        recipientName = data.name;
      }
    } else if (notification.user_type === 'admin') {
      recipientEmail = ADMIN_EMAIL;
      recipientName = 'Admin';
    }

    if (!recipientEmail) {
      console.log('[send-email] No recipient found. emailType:', emailType, 'user_type:', notification.user_type, 'user_id:', notification.user_id);
      return new Response(JSON.stringify({ error: 'No recipient found', emailType, user_type: notification.user_type }), { status: 200 });
    }

    console.log('[send-email] Sending', emailType, 'to', recipientEmail);

    // Build email based on type
    let email: { subject: string; html: string };

    switch (emailType) {
      case 'creator_welcome':
        email = creatorWelcomeEmail(recipientName);
        break;
      case 'business_welcome':
        email = businessWelcomeEmail(recipientName);
        break;
      case 'offer_claimed_creator':
        email = offerClaimedCreatorEmail(recipientName, meta);
        break;
      case 'visit_confirmed_creator':
        email = visitConfirmedCreatorEmail(recipientName, meta);
        break;
      case 'reel_due_reminder':
        email = reelDueReminderEmail(recipientName, meta);
        break;
      case 'new_claim_business':
        email = newClaimBusinessEmail(recipientName, meta);
        break;
      case 'creator_approved':
        email = creatorApprovedEmail(recipientName);
        break;
      case 'business_approved':
        email = businessApprovedEmail(recipientName);
        break;
      case 'creator_denied':
        email = creatorDeniedEmail(recipientName);
        break;
      case 'business_denied':
        email = businessDeniedEmail(recipientName);
        break;
      case 'admin_signup':
        email = adminSignupEmail(meta);
        break;
      case 'admin_approval_request':
        email = adminApprovalRequestEmail(meta);
        break;
      case 'feedback':
        email = feedbackEmail(meta);
        break;
      default:
        email = genericNotificationEmail(recipientName, notification.message);
    }

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject: email.subject,
        html: email.html,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      console.error('Resend error:', errBody);
      return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 500 });
    }

    // Mark as sent to prevent duplicates
    await supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('id', notification.id);

    return new Response(JSON.stringify({ success: true, email_type: emailType }), { status: 200 });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
