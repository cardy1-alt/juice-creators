// Supabase Edge Function: send-email
// Triggered by DB webhook on notifications table INSERT
// Uses Resend to deliver transactional emails for all platform events

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_EMAIL = 'Nayba <hello@nayba.app>';
const ADMIN_EMAIL = 'hello@nayba.app';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.nayba.app';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// ─── Design system (aligned with app tokens) ─────────────────────────────
const TERRA = '#D95F3B';
const TERRA_LIGHT = '#F9E8E1';
const TERRA_BORDER = '#F2DDD5';
const INK = '#2A2018';
const INK_60 = '#7A7168';
const INK_35 = '#B0AAA4';
const INK_08 = '#F4F3F1';
const VIOLET = '#8C7AAA';
const VIOLET_LIGHT = '#DDD6EE';
const SAGE = '#7A9478';
const SAGE_LIGHT = '#DDEADD';
const BALTIC = '#7AA0B8';
const BALTIC_LIGHT = '#D6E6F0';
const GOLDEN_MIST = '#C4A84A';
const GOLDEN_MIST_LIGHT = '#EDE5C0';
const CHALK = '#F6F3EE';
const LOGOMARK_URL = 'https://app.nayba.app/logomark.png';

// ─── Branded email wrapper ────────────────────────────────────────────────
function wrapEmail(body: string, _accentColor = TERRA): string {
  // Built with nested tables + bgcolor attrs for maximum email-client
  // compatibility. Divs with background/border-radius/box-shadow are
  // stripped or rendered inconsistently by Spark, Outlook, and some
  // Android clients — tables render identically everywhere.
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Nayba</title>
</head>
<body style="margin:0;padding:0;background-color:${CHALK};-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CHALK}" style="background-color:${CHALK};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="${LOGOMARK_URL}" width="36" height="36" alt="Nayba" style="display:block;width:36px;height:36px;border:0;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:24px;font-weight:700;color:${INK};letter-spacing:-0.04em;">Nayba</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:12px;padding:36px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 0 0;">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:${INK_35};">
                The Nayba Team &middot; Connecting creators with local businesses
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:${INK_35};">
                You're receiving this because you signed up for Nayba.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string, bg = TERRA): string {
  // Table + bgcolor for button so Spark/Outlook render the background fill.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0 auto;">
    <tr>
      <td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:10px;">
        <a href="${href}" style="display:inline-block;background-color:${bg};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:15px;letter-spacing:-0.2px;mso-padding-alt:0;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function p(text: string): string {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.7; color: ${INK}; margin: 0 0 16px;">${text}</p>`;
}

function heading(text: string): string {
  return `<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 22px; font-weight: 600; color: ${INK}; margin: 0 0 8px; letter-spacing: -0.3px;">${text}</h1>`;
}

function subtext(text: string): string {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: ${INK_60}; margin: 0 0 24px;">${text}</p>`;
}

function divider(): string {
  return `<div style="height: 1px; background: ${INK_08}; margin: 24px 0;"></div>`;
}

function infoBox(content: string, bg = TERRA_LIGHT, border = TERRA_BORDER): string {
  // Table-based card so Spark/Outlook keep the background fill + border.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border-collapse:separate;">
    <tr>
      <td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;">${content}</td>
    </tr>
  </table>`;
}

function stepList(steps: string[]): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    ${steps.map((step, i) => `
      <tr>
        <td style="width: 28px; vertical-align: top; padding: 0 14px ${i < steps.length - 1 ? '14px' : '0'} 0;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: ${TERRA_LIGHT}; color: ${TERRA}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 700; text-align: center; line-height: 28px;">${i + 1}</div>
        </td>
        <td style="vertical-align: top; padding: 0 0 ${i < steps.length - 1 ? '14px' : '0'} 0;">
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: ${INK}; margin: 2px 0 0;">${step}</p>
        </td>
      </tr>
    `).join('')}
  </table>`;
}

// ─── Template builders ────────────────────────────────────────────────────

function creatorWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Nayba!',
    html: wrapEmail(`
      ${heading(`Welcome, ${escapeHtml(name)}!`)}
      ${subtext("We're really glad you're here.")}
      ${p('Nayba connects you with local brands who want to work with creators like you. Browse campaigns from cafes, wellness studios, food brands, and more in your area.')}
      ${p("<strong>Here's how it works:</strong>")}
      ${stepList([
        'Browse campaigns and express interest',
        'Get selected and receive your perk',
        'Post an Instagram Reel about your experience',
      ])}
      ${divider()}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${TERRA}; font-weight: 600; margin: 0;">
          Your account is being reviewed
        </p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: ${INK_60}; margin: 6px 0 0;">
          We'll email you once approved. In the meantime, make sure your profile is looking great!
        </p>
      `)}
      ${btn('Complete Your Profile', APP_URL)}
    `),
  };
}

function campaignNotificationEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const brandName = meta.brand_name || 'a local brand';
  const campaignTitle = meta.campaign_title || 'a new campaign';
  const campaignId = meta.campaign_id || '';
  return {
    subject: `New campaign just dropped — ${brandName}`,
    html: wrapEmail(`
      ${heading('New Campaign!')}
      ${subtext(`Hey ${escapeHtml(name)}, there's a new opportunity for you.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 700; color: ${INK}; margin: 0 0 6px;">${escapeHtml(brandName)}</p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; color: ${INK_60}; margin: 0;">${escapeHtml(campaignTitle)}</p>
      `)}
      ${p("A brand in your area is looking for local creators. Check out the campaign, see what's on offer, and let them know you're interested.")}
      ${p("Spots are limited — express your interest early.")}
      ${btn('View Campaign', `${APP_URL}?campaign=${campaignId}`)}
    `),
  };
}

function creatorSelectedEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const brandName = meta.brand_name || 'a local brand';
  const campaignTitle = meta.campaign_title || 'a campaign';
  const campaignId = meta.campaign_id || '';
  const perkDescription = meta.perk_description || '';
  return {
    subject: `${brandName} wants you — you've been selected`,
    html: wrapEmail(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#127881;</div>
      </div>
      ${heading("You've been selected!")}
      ${subtext(`Great news, ${escapeHtml(name)} — ${escapeHtml(brandName)} wants to work with you.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(campaignTitle)}</p>
        ${perkDescription ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">${escapeHtml(perkDescription)}</p>` : ''}
      `)}
      ${p("<strong>What happens next:</strong>")}
      ${stepList([
        'Confirm your spot in the app <strong>within 48 hours</strong>',
        "You'll receive your perk from the brand",
        'Post an Instagram Reel about your experience',
      ])}
      ${p("You've got <strong>48 hours</strong> to confirm before the spot opens back up for another creator — don't keep them waiting!")}
      ${btn('Confirm Your Spot', `${APP_URL}?campaign=${campaignId}`)}
    `),
  };
}

function contentDeadlineReminderEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const brandName = meta.brand_name || 'a local brand';
  const campaignId = meta.campaign_id || '';
  return {
    subject: `Your Reel is due in 48 hours — ${brandName}`,
    html: wrapEmail(`
      ${heading('Your Reel is due soon')}
      ${subtext(`Hey ${escapeHtml(name)}, just a friendly reminder.`)}
      ${infoBox(`
        <div style="text-align: center;">
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(brandName)}</p>
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; color: ${TERRA}; margin: 0;">Due in 48 hours</p>
        </div>
      `)}
      ${p("Post your Instagram Reel and submit the link in the nayba app. It doesn't need to be perfect — just authentic.")}
      ${p("Missing the deadline affects your completion rate, which brands can see when choosing creators for future campaigns.")}
      ${btn('Submit Your Reel', `${APP_URL}?campaign=${campaignId}`)}
    `),
  };
}

function businessWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to Nayba!',
    html: wrapEmail(`
      ${heading(`Welcome, ${escapeHtml(name)}!`)}
      ${subtext('Great to have you on board.')}
      ${p("Nayba turns local creators into your marketing team — no budget required. Create a collab, local creators claim it, visit your business, and post an authentic Instagram Reel about the experience.")}
      ${p("<strong>Getting started is simple:</strong>")}
      ${stepList([
        'Create your first collab (a free coffee, a discount — whatever feels right)',
        'Creators discover and claim it',
        'They visit, you scan their QR code, and they post a Reel',
      ])}
      ${divider()}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${TERRA}; font-weight: 600; margin: 0;">
          Your account is being reviewed
        </p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: ${INK_60}; margin: 6px 0 0;">
          We'll email you once approved. Complete your profile while you wait!
        </p>
      `)}
      ${btn('Set Up Your Profile', APP_URL)}
    `),
  };
}

function offerClaimedCreatorEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const offerTitle = meta.offer_title || 'an offer';
  const businessName = meta.business_name || 'a local business';
  return {
    subject: `You claimed ${offerTitle} from ${businessName}`,
    html: wrapEmail(`
      ${heading('Collab Claimed!')}
      ${subtext(`Nice one, ${escapeHtml(name)}.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(offerTitle)}</p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">from ${escapeHtml(businessName)}</p>
      `)}
      ${p("<strong>What happens next:</strong>")}
      ${stepList([
        `Visit <strong>${escapeHtml(businessName)}</strong> and show your QR pass`,
        'Enjoy the experience',
        'Post an Instagram Reel within <strong>48 hours</strong> of your visit',
      ])}
      ${btn('View Your Pass', APP_URL)}
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
    subject: 'Visit confirmed — your 48hr Reel clock has started',
    html: wrapEmail(`
      ${heading('Visit Confirmed!')}
      ${subtext(`${escapeHtml(businessName)} confirmed your visit — nice work, ${escapeHtml(name)}.`)}
      ${infoBox(`
        <div style="text-align: center;">
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; color: ${TERRA}; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">48-Hour Reel Clock Started</p>
          ${deadlineStr ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 800; color: ${INK}; margin: 0;">${escapeHtml(deadlineStr)}</p>` : ''}
        </div>
      `)}
      ${p('Post your Instagram Reel and submit the link in the app before the deadline.')}
      ${p(`Keep it authentic — just share your honest experience at ${escapeHtml(businessName)}. That's what makes Nayba work.`)}
      ${btn('Submit Your Reel', APP_URL)}
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
      ${heading('Reel Due Soon')}
      ${subtext(`Don't forget, ${escapeHtml(name)} — less than 24 hours left.`)}
      ${infoBox(`
        <div style="text-align: center;">
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(businessName)}</p>
          ${deadlineStr ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; color: ${TERRA}; margin: 0;">Due by ${escapeHtml(deadlineStr)}</p>` : ''}
        </div>
      `)}
      ${p("Post your Instagram Reel and paste the link in the Nayba app. It doesn't need to be perfect — just authentic.")}
      ${p("If you miss the deadline, the claim will be marked as overdue. Don't let a good experience go to waste!")}
      ${btn('Submit Your Reel Now', APP_URL)}
    `),
  };
}

function newClaimBusinessEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const creatorName = meta.creator_name || 'A creator';
  const offerTitle = meta.offer_title || 'your offer';
  return {
    subject: `${creatorName} just claimed ${offerTitle}`,
    html: wrapEmail(`
      ${heading('New Claim!')}
      ${subtext(`Good news, ${escapeHtml(name)}.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(creatorName)}</p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">claimed ${escapeHtml(offerTitle)}</p>
      `)}
      ${p("<strong>What happens next:</strong>")}
      ${stepList([
        "They'll visit your business soon",
        'When they arrive, scan their QR code in the app to confirm',
        "They post an Instagram Reel within 48 hours — you'll be notified",
      ])}
      ${btn('Open Nayba', APP_URL)}
    `),
  };
}

function creatorApprovedEmail(name: string): { subject: string; html: string } {
  return {
    subject: "You're approved — welcome to Nayba!",
    html: wrapEmail(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#127881;</div>
      </div>
      ${heading("You're Approved!")}
      ${subtext(`Welcome to Nayba, ${escapeHtml(name)}. You're all set.`)}
      ${p('You can now browse collabs from local businesses in your area, claim the ones you like, and start creating.')}
      ${p("<strong>Here's how it works:</strong>")}
      ${stepList([
        'Browse and claim a collab',
        'Visit the business and show your QR pass',
        'Post an Instagram Reel within 48 hours',
      ])}
      ${p('Jump in and claim your first collab — there are businesses waiting to work with you.')}
      ${btn('Explore Collabs', APP_URL)}
    `),
  };
}

function businessApprovedEmail(name: string): { subject: string; html: string } {
  return {
    subject: "You're approved — welcome to Nayba!",
    html: wrapEmail(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#127881;</div>
      </div>
      ${heading("You're Approved!")}
      ${subtext(`Welcome to Nayba, ${escapeHtml(name)}. You're live on the platform.`)}
      ${p('Create your first collab and local creators will be able to discover and claim it right away.')}
      ${p("If you need any help getting started, just reply to this email — we're here for you.")}
      ${btn('Create Your First Collab', APP_URL)}
    `),
  };
}

function creatorDeniedEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Update on your Nayba application',
    html: wrapEmail(`
      ${heading('Application Update')}
      ${subtext(`Hi ${escapeHtml(name)}, thanks for your interest in Nayba.`)}
      ${p("After reviewing your application, we're unable to approve your creator account at this time.")}
      ${p('This could be for a number of reasons — incomplete profile, follower count, or content fit.')}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">
          Think this was a mistake? Just reply to this email and we'll take another look.
        </p>
      `, INK_08, INK_08)}
      ${p('We appreciate your time and hope to welcome you in the future.')}
    `),
  };
}

function businessDeniedEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Update on your Nayba application',
    html: wrapEmail(`
      ${heading('Application Update')}
      ${subtext(`Hi ${escapeHtml(name)}, thanks for your interest in Nayba.`)}
      ${p("After reviewing your application, we're unable to approve your business account at this time.")}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">
          If you believe this was a mistake, just reply to this email and we'll be happy to help.
        </p>
      `, INK_08, INK_08)}
      ${p('We appreciate your interest and hope to work with you in the future.')}
    `),
  };
}

function adminApprovalRequestEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const displayName = meta.display_name || 'Unknown';
  const userEmail = meta.email || 'Unknown';
  const timestamp = new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return {
    subject: `New ${userType} awaiting approval — ${displayName}`,
    html: wrapEmail(`
      ${heading(`New ${escapeHtml(userType)} signup`)}
      ${subtext('Awaiting your review.')}
      <table style="width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 2; border-collapse: collapse;">
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0; white-space: nowrap;">Type</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(userType)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0; white-space: nowrap;">Name</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(displayName)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0; white-space: nowrap;">Email</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(userEmail)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0; white-space: nowrap;">Time</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(timestamp)}</td></tr>
      </table>
      ${btn('Review in Dashboard', `${APP_URL}?demo=admin`, INK)}
    `, INK),
  };
}

function adminSignupEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const displayName = meta.display_name || 'Unknown';
  const email = meta.email || 'Unknown';
  const timestamp = meta.timestamp || new Date().toISOString();
  return {
    subject: `New ${userType} signup: ${displayName}`,
    html: wrapEmail(`
      ${heading(`New ${escapeHtml(userType)} signup`)}
      <table style="width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 2; border-collapse: collapse;">
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">Type</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(userType)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">Name</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(displayName)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">Email</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(email)}</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">Time</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(timestamp)}</td></tr>
      </table>
    `, INK),
  };
}

function feedbackEmail(meta: Record<string, string>): { subject: string; html: string } {
  const userType = meta.user_type || 'unknown';
  const userId = meta.user_id || 'unknown';
  const page = meta.page || 'unknown';
  const feedbackText = meta.feedback || '';
  return {
    subject: `Feedback from ${userType} (${meta.display_name || userId})`,
    html: wrapEmail(`
      ${heading('New Feedback')}
      <table style="width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 2; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">From</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(meta.display_name || userId)} (${escapeHtml(userType)})</td></tr>
        <tr><td style="color: ${INK_35}; padding: 0 16px 0 0;">Page</td><td style="color: ${INK}; font-weight: 600;">${escapeHtml(page)}</td></tr>
      </table>
      <div style="background: ${INK_08}; border-radius: 14px; padding: 20px 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.7; color: ${INK};">
        ${escapeHtml(feedbackText)}
      </div>
    `, INK),
  };
}

function reelSubmittedCreatorEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const offerTitle = meta.offer_title || 'your collab';
  const businessName = meta.business_name || 'a local business';
  return {
    subject: 'Your Nayba collab is complete \u{1F389}',
    html: wrapEmail(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#127881;</div>
      </div>
      ${heading('Collab Complete!')}
      ${subtext(`Amazing work, ${escapeHtml(name)}.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(offerTitle)}</p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">with ${escapeHtml(businessName)}</p>
      `)}
      ${p("Your Reel has been submitted and the collab is now complete. Thanks for supporting a local business \u2014 that's what Nayba is all about.")}
      ${p('Ready for your next one? There are more collabs waiting for you.')}
      ${btn('Explore More Collabs', APP_URL)}
    `),
  };
}

function slotReadyEmail(name: string, meta: Record<string, string>): { subject: string; html: string } {
  const offerTitle = meta.offer_title || 'a collab';
  const businessName = meta.business_name || 'a local business';
  const expiresAt = meta.expires_at || '';
  let deadlineStr = '';
  if (expiresAt) {
    try {
      const d = new Date(expiresAt);
      deadlineStr = d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    } catch { deadlineStr = ''; }
  }
  return {
    subject: `A spot just opened — ${offerTitle} at ${businessName}`,
    html: wrapEmail(`
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#128276;</div>
      </div>
      ${heading('Your spot is ready!')}
      ${subtext(`Great news, ${escapeHtml(name)} — a slot just opened up.`)}
      ${infoBox(`
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; color: ${INK}; margin: 0 0 4px;">${escapeHtml(offerTitle)}</p>
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: ${INK_60}; margin: 0;">at ${escapeHtml(businessName)}</p>
      `)}
      ${p('You were next on the waitlist and this spot is yours — but you need to claim it before it moves to the next person.')}
      ${deadlineStr ? infoBox(`
        <div style="text-align: center;">
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; color: ${TERRA}; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Claim by</p>
          <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 800; color: ${INK}; margin: 0;">${escapeHtml(deadlineStr)}</p>
        </div>
      `) : ''}
      ${btn('Claim Now', APP_URL)}
    `),
  };
}

function genericNotificationEmail(name: string, message: string): { subject: string; html: string } {
  return {
    subject: `Nayba — ${message.slice(0, 60)}`,
    html: wrapEmail(`
      ${heading('New Notification')}
      ${subtext(`Hi ${escapeHtml(name)}`)}
      ${p(escapeHtml(message))}
      ${btn('Open Nayba', APP_URL)}
    `),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    console.log('[send-email] Payload received:', JSON.stringify(payload).slice(0, 500));

    if (payload.table !== 'notifications' || payload.type !== 'INSERT') {
      console.log('[send-email] Skipped: not a notifications INSERT', payload.type, payload.table);
      return new Response(JSON.stringify({ skipped: true, reason: 'not_insert' }), { status: 200 });
    }

    const notification = payload.record as NotificationRecord;
    console.log('[send-email] Notification:', JSON.stringify(notification).slice(0, 500));

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

    // Check if this email type is enabled via notification_settings table.
    // Default to true if no row exists (fail-open, better than silent drop).
    if (emailType) {
      const { data: setting } = await supabase
        .from('notification_settings')
        .select('enabled')
        .eq('email_type', emailType)
        .maybeSingle();
      if (setting && setting.enabled === false) {
        console.log(`[send-email] Skipping ${emailType} — disabled in notification_settings`);
        return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    let recipientEmail: string | null = null;
    let recipientName = '';

    if (emailType === 'admin_signup' || emailType === 'feedback' || emailType === 'admin_approval_request') {
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

    // Test-send override: if email_meta contains test_to_email, route the
    // email there regardless of who user_id points to. Used by the admin's
    // "Send test email" button in the email template editor.
    if (meta.test_to_email) {
      recipientEmail = meta.test_to_email;
      recipientName = meta.test_to_name || recipientName || 'Test User';
      console.log(`[send-email] Test-send override: routing to ${recipientEmail}`);
    }

    if (!recipientEmail) {
      console.log('[send-email] No recipient found. emailType:', emailType, 'user_type:', notification.user_type, 'user_id:', notification.user_id);
      return new Response(JSON.stringify({ error: 'No recipient found', emailType, user_type: notification.user_type }), { status: 200 });
    }

    console.log('[send-email] Sending', emailType, 'to', recipientEmail);

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
      case 'business_campaign_live':
        email = {
          subject: `Your campaign is live — ${meta.campaign_title}`,
          html: wrapEmail(`
            ${heading('Your Campaign is Live!')}
            ${subtext(`Great news, ${escapeHtml(recipientName)}. Your campaign is now visible to creators in your area.`)}
            ${infoBox(`
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 6px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              ${meta.headline ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 12px;font-size:14px;color:${INK_60};">${escapeHtml(meta.headline)}</p>` : ''}
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 4px;font-size:13px;color:${INK_60};">Perk: ${escapeHtml(meta.perk_description || 'Not specified')}</p>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 4px;font-size:13px;color:${INK_60};">Looking for: ${escapeHtml(meta.creator_target || '5')} creators</p>
              ${meta.expression_deadline ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0;font-size:13px;color:${INK_60};">Apply by: ${escapeHtml(meta.expression_deadline)}</p>` : ''}
            `)}
            ${p('Creators can now express interest. We\'ll handle the selection process and keep you updated as things progress.')}
            ${p('Log in anytime to see how your campaign is doing.')}
            ${btn('View Campaign', APP_URL)}
          `),
        };
        break;
      case 'creator_confirmed': {
        const brandIg = (meta.brand_instagram || '').replace('@', '');
        const hasInstructions = !!(meta.brand_instructions && meta.brand_instructions.trim().length > 0);
        // When brand has set custom instructions, replace the generic "visit
        // anytime" step with the brand's own first action (e.g. book in
        // advance via DM). Keep the brand IG handle inline if present so
        // creators have a one-tap channel.
        const firstStep = hasInstructions
          ? `<strong>${escapeHtml(meta.brand_instructions!)}</strong>${brandIg ? ` (DM <a href="https://instagram.com/${brandIg}" style="color:${TERRA};font-weight:600;">@${brandIg}</a>)` : ''}`
          : 'Visit the brand whenever suits you';
        email = {
          subject: `You're confirmed for ${meta.brand_name} — here's what happens next`,
          html: wrapEmail(`
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, ${TERRA_LIGHT}, ${VIOLET_LIGHT}); line-height: 56px; font-size: 28px;">&#10004;</div>
            </div>
            ${heading("You're In!")}
            ${subtext(`Nice one, ${escapeHtml(recipientName)}. You're confirmed for ${escapeHtml(meta.brand_name || '')}'s campaign.`)}
            ${infoBox(`
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 6px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 4px;font-size:13px;color:${INK_60};">Perk: ${escapeHtml(meta.perk_description || '')}</p>
              ${meta.brand_address ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0;font-size:13px;color:${INK_60};">&#128205; ${escapeHtml(meta.brand_address)}</p>` : ''}
            `)}
            ${p('<strong>What happens next:</strong>')}
            ${stepList([
              firstStep,
              "When you arrive, mention you're with Nayba or show your Instagram",
              'After your visit, film a short Reel and submit the link in the app',
            ])}
            ${btn('View Campaign', APP_URL)}
          `),
        };
        break;
      }
      case 'business_creator_confirmed':
        email = {
          subject: `${meta.creator_name} is confirmed for your campaign`,
          html: wrapEmail(`
            ${heading('Creator Confirmed')}
            ${subtext(`A creator has confirmed their spot on your campaign and will visit soon.`)}
            ${infoBox(`
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 8px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.creator_name || '')}</p>
              ${meta.creator_instagram ? `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 12px;font-size:14px;color:${TERRA};font-weight:500;">@${escapeHtml(meta.creator_instagram.replace('@', ''))}</p>` : ''}
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0 0 4px;font-size:13px;color:${INK_60};">Campaign: ${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin:0;font-size:13px;color:${INK_60};">Perk: ${escapeHtml(meta.perk_description || '')}</p>
            `)}
            ${p('They\'ll visit your venue to redeem their perk and create content. They may show their Instagram profile or mention Nayba when they arrive.')}
            ${p('You don\'t need to do anything — just welcome them when they visit.')}
            ${btn('View in Dashboard', APP_URL)}
          `),
        };
        break;
      case 'admin_signup':
        email = adminSignupEmail(meta);
        break;
      case 'admin_approval_request':
        email = adminApprovalRequestEmail(meta);
        break;
      case 'admin_interest_expressed':
        email = { subject: `${meta.creator_name} interested in ${meta.brand_name}`, html: wrapEmail(`${heading('New Interest')}${p(`<strong>${escapeHtml(meta.creator_name || '')}</strong> expressed interest in <strong>${escapeHtml(meta.brand_name || '')}</strong>'s campaign: ${escapeHtml(meta.campaign_title || '')}`)}${btn('View in Dashboard', APP_URL, INK)}`, INK) };
        break;
      case 'admin_creator_confirmed':
        email = { subject: `${meta.creator_name} confirmed for ${meta.brand_name}`, html: wrapEmail(`${heading('Creator Confirmed')}${p(`<strong>${escapeHtml(meta.creator_name || '')}</strong> confirmed their spot for <strong>${escapeHtml(meta.brand_name || '')}</strong>'s campaign: ${escapeHtml(meta.campaign_title || '')}`)}${btn('View in Dashboard', APP_URL, INK)}`, INK) };
        break;
      case 'admin_content_submitted':
        email = { subject: `${meta.creator_name} submitted a Reel for ${meta.brand_name}`, html: wrapEmail(`${heading('Reel Submitted')}${p(`<strong>${escapeHtml(meta.creator_name || '')}</strong> submitted a Reel for <strong>${escapeHtml(meta.brand_name || '')}</strong>'s campaign: ${escapeHtml(meta.campaign_title || '')}`)}${meta.reel_url ? p(`<a href="${meta.reel_url}" style="color:${TERRA};font-weight:600;">View Reel →</a>`) : ''}${btn('View in Dashboard', APP_URL, INK)}`, INK) };
        break;
      case 'feedback':
        email = feedbackEmail(meta);
        break;
      case 'reel_submitted_creator':
        email = reelSubmittedCreatorEmail(recipientName, meta);
        break;
      case 'slot_ready':
        email = slotReadyEmail(recipientName, meta);
        break;
      case 'campaign_notification':
        email = campaignNotificationEmail(recipientName, meta);
        break;
      case 'creator_selected':
        email = creatorSelectedEmail(recipientName, meta);
        break;
      case 'creator_selection_reminder_24h':
        email = {
          subject: `~24h left to confirm ${meta.brand_name || 'your'} spot`,
          html: wrapEmail(`
            ${heading('Heads up — your spot closes soon')}
            ${subtext(`Hey ${escapeHtml(recipientName)}, about a day left to confirm your selection before it opens back up for another creator.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${escapeHtml(meta.brand_name || '')}</p>
            `)}
            ${p("Tap confirm in the app to lock it in. If the timing doesn't work for you anymore, let us know so we can offer the spot to a reserve.")}
            ${btn('Confirm your spot', `${APP_URL}?campaign=${meta.campaign_id || ''}`)}
          `),
        };
        break;
      case 'business_selection_expired':
        email = {
          subject: `${meta.creator_name || 'A creator'} didn't confirm — slot reopened`,
          html: wrapEmail(`
            ${heading('A slot just reopened')}
            ${subtext(`Hey ${escapeHtml(recipientName)}, ${escapeHtml(meta.creator_name || 'the creator')} didn't confirm within the 48-hour window, so their spot on ${escapeHtml(meta.campaign_title || 'your campaign')} is open again.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${meta.reserves_remaining && parseInt(meta.reserves_remaining) > 0 ? `${escapeHtml(meta.reserves_remaining)} reserve${parseInt(meta.reserves_remaining) === 1 ? '' : 's'} available to promote` : 'No reserves in the pool — open for new applicants'}</p>
            `)}
            ${p("Open the Selection tab to pick a replacement from your reserves.")}
            ${btn('Open campaign', `${APP_URL}?campaign=${meta.campaign_id || ''}`, INK)}
          `),
        };
        break;
      case 'admin_selection_expired':
        email = {
          subject: `Selection expired — ${meta.brand_name || 'a campaign'} / ${meta.campaign_title || ''}`,
          html: wrapEmail(`
            ${heading('Selection expired')}
            ${p(`<strong>${escapeHtml(meta.creator_name || 'A creator')}</strong> didn't confirm for <strong>${escapeHtml(meta.brand_name || '')}</strong> — ${escapeHtml(meta.campaign_title || '')}.`)}
            ${p(`Reserves remaining: <strong>${escapeHtml(meta.reserves_remaining || '0')}</strong>.`)}
            ${btn('Open admin dashboard', APP_URL, INK)}
          `),
        };
        break;
      case 'selection_expired':
        email = {
          subject: `Your ${meta.brand_name || 'campaign'} spot has expired`,
          html: wrapEmail(`
            ${heading('Selection expired')}
            ${subtext(`Hey ${escapeHtml(recipientName)}, the 48-hour window to confirm your spot for ${escapeHtml(meta.brand_name || 'the campaign')} has passed.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${escapeHtml(meta.brand_name || '')}</p>
            `)}
            ${p("We've opened your spot back up so another creator can take it. Plenty more campaigns land every week — next time, try to confirm as soon as you see the selection email.")}
            ${btn('Browse campaigns', APP_URL)}
          `),
        };
        break;
      case 'content_deadline_reminder':
      case 'creator_deadline_reminder':
        email = contentDeadlineReminderEmail(recipientName, meta);
        break;
      case 'creator_content_received':
        email = {
          subject: `We got your Reel — thanks for sharing!`,
          html: wrapEmail(`
            ${heading('Reel received!')}
            ${subtext(`Thanks for sharing your ${escapeHtml(meta.brand_name || 'campaign')} experience, ${escapeHtml(recipientName)}.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${escapeHtml(meta.brand_name || '')}</p>
            `)}
            ${p("We'll review your Reel and mark the campaign complete once everything looks good.")}
            ${p('Keep creating — more local collabs land in your feed every week.')}
            ${btn('Explore more campaigns', APP_URL)}
          `),
        };
        break;
      case 'creator_campaign_complete':
        email = {
          subject: `Campaign complete — nice work on ${meta.brand_name || 'your campaign'}!`,
          html: wrapEmail(`
            ${heading('Campaign complete!')}
            ${subtext(`Great work, ${escapeHtml(recipientName)}. Your ${escapeHtml(meta.brand_name || 'campaign')} campaign is wrapped.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${escapeHtml(meta.brand_name || '')}</p>
            `)}
            ${meta.total_campaigns ? p(`You've completed <strong>${escapeHtml(meta.completed_campaigns || meta.total_campaigns)}</strong> ${(parseInt(meta.total_campaigns) === 1) ? 'campaign' : 'campaigns'} so far${meta.completion_rate ? ` — ${escapeHtml(meta.completion_rate)}% completion rate` : ''}.`) : ''}
            ${p('Keep going — more collabs are waiting in your area.')}
            ${btn('Browse campaigns', APP_URL)}
          `),
        };
        break;
      case 'content_overdue':
        email = {
          subject: `Your Reel is overdue — ${meta.brand_name || 'a campaign'}`,
          html: wrapEmail(`
            ${heading('Reel is overdue')}
            ${subtext(`Hey ${escapeHtml(recipientName)}, your ${escapeHtml(meta.brand_name || 'campaign')} Reel${meta.content_deadline ? ` was due on ${escapeHtml(meta.content_deadline)}` : ' is overdue'}.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">${escapeHtml(meta.brand_name || '')}</p>
            `)}
            ${p('Still planning to post? Submit your Reel in the app. If your plans changed, let us know — no hard feelings.')}
            ${btn('Submit your Reel', `${APP_URL}${meta.campaign_id ? `?campaign=${meta.campaign_id}` : ''}`)}
          `),
        };
        break;
      case 'weekly_digest':
        email = {
          subject: `This week's local collabs — ${meta.campaign_count || '0'} new`,
          html: wrapEmail(`
            ${heading("This week's opportunities")}
            ${subtext(`${escapeHtml(meta.campaign_count || '0')} new ${parseInt(meta.campaign_count || '0') === 1 ? 'collab' : 'collabs'} in ${escapeHtml(meta.city || 'your area')} this week.`)}
            ${p('Log in to see the full list and register your interest.')}
            ${btn('Browse campaigns', APP_URL)}
          `),
        };
        break;
      // ─── Community Campaign (Prize Draw) ─────────────────────────
      case 'creator_entered_community':
        email = {
          subject: `You're entered — ${meta.campaign_title || 'community draw'}`,
          html: wrapEmail(`
            ${heading("You're in the draw!")}
            ${subtext(`Nice one, ${escapeHtml(recipientName)}. You've entered the community campaign.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">Nayba Community</p>
            `)}
            ${meta.perk_description ? p(`<strong>Prize:</strong> ${escapeHtml(meta.perk_description)}`) : ''}
            ${p('Now film and upload your Reel before the deadline. The Nayba team will pick the winner from all submitted entries.')}
            ${meta.content_deadline ? p(`<strong>Content deadline:</strong> ${escapeHtml(meta.content_deadline)}`) : ''}
            ${btn('Submit your Reel', APP_URL)}
          `),
        };
        break;
      case 'creator_won_community':
        email = {
          subject: `You won! 🎉 ${meta.campaign_title || 'Community draw'}`,
          html: wrapEmail(`
            ${heading('You won!')}
            ${subtext(`Congratulations, ${escapeHtml(recipientName)}! The Nayba team picked your Reel as the winner.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">Nayba Community</p>
            `)}
            ${meta.perk_description ? p(`<strong>Your prize:</strong> ${escapeHtml(meta.perk_description)}`) : ''}
            ${p("We'll be in touch shortly to arrange delivery. Thanks for being part of the community!")}
          `),
        };
        break;
      case 'creator_not_selected_community':
        email = {
          subject: `${meta.campaign_title || 'Community draw'} — winners announced`,
          html: wrapEmail(`
            ${heading('Winners are in')}
            ${subtext(`Hey ${escapeHtml(recipientName)}, the winners for this community draw have been picked.`)}
            ${infoBox(`
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 4px;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(meta.campaign_title || '')}</p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;font-size:13px;color:${INK_60};">Nayba Community</p>
            `)}
            ${p("You weren't picked this time — but thanks for entering and sharing your content. Keep an eye on the Discover feed for the next one.")}
            ${btn('Browse campaigns', APP_URL)}
          `),
        };
        break;
      case 'admin_community_winners_picked':
        email = {
          subject: `Winners picked — ${meta.campaign_title || 'community campaign'}`,
          html: wrapEmail(`
            ${heading('Winners announced')}
            ${p(`${escapeHtml(meta.num_winners || '1')} winner${(meta.num_winners || '1') === '1' ? '' : 's'} picked for <strong>${escapeHtml(meta.campaign_title || '')}</strong> from ${escapeHtml(meta.num_entries || '0')} entries.`)}
            ${p('Winner and not-selected emails have been sent. The campaign is now marked as completed.')}
          `),
        };
        break;
      default:
        email = genericNotificationEmail(recipientName, notification.message);
    }

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

