/**
 * Client-side email preview rendering.
 * Mirrors the helpers in supabase/functions/send-email/index.ts
 * so admin can preview emails without calling the edge function.
 */

// Mirrors the helpers in supabase/functions/send-email/index.ts so admin
// preview matches what creators actually receive. Tokens and layout must
// stay in sync — if you change one, change the other.
const TERRA = '#D95F3B';
const TERRA_LIGHT = '#F9E8E1';
const TERRA_BORDER = '#F2DDD5';
const INK = '#2A2018';
const INK_60 = '#7A7168';
const INK_35 = '#B0AAA4';
const CHALK = '#F6F3EE';
const LOGOMARK_URL = '/logomark.png';

export function heading(text: string) {
  return `<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:600;color:${INK};margin:0 0 8px;letter-spacing:-0.3px;">${text}</h1>`;
}

export function subtext(text: string) {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:${INK_60};margin:0 0 24px;">${text}</p>`;
}

export function p(text: string) {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:${INK};margin:0 0 16px;">${text}</p>`;
}

export function btn(text: string, bg = TERRA) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0 auto;">
    <tr>
      <td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:10px;">
        <a href="#" style="display:inline-block;background-color:${bg};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:15px;letter-spacing:-0.2px;">${text}</a>
      </td>
    </tr>
  </table>`;
}

export function infoBox(content: string, bg = TERRA_LIGHT, border = TERRA_BORDER) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border-collapse:separate;">
    <tr>
      <td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;">${content}</td>
    </tr>
  </table>`;
}

export function wrapEmail(body: string) {
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
          <tr>
            <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:12px;padding:36px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 0 0 0;">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:${INK_35};">The Nayba Team &middot; Connecting creators with local businesses</p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:${INK_35};">You're receiving this because you signed up for Nayba.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Replace {{variable}} placeholders with sample data */
function interpolate(template: string, data: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => esc(data[key] || `{{${key}}}`));
}

// ─── Template definitions ─────────────────────────────────────────

export interface EmailTemplate {
  key: string;
  name: string;
  group: 'creator' | 'business' | 'admin';
  description: string;
  variables: string[];
  defaultSubject: string;
  defaultBody: string; // uses {{variable}} placeholders
  sampleData: Record<string, string>;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ── Creator ──
  {
    key: 'creator_welcome', name: 'Welcome', group: 'creator',
    description: 'Sent when a creator signs up',
    variables: ['name'],
    defaultSubject: 'Welcome to Nayba, {{name}}!',
    defaultBody: `${heading("Welcome to Nayba!")}${subtext("Hey {{name}}, you're in. Let's get you your first collab.")}${p("Browse local campaigns, express your interest, and get rewarded with free experiences — no follower minimums, ever.")}${btn("Start Exploring")}`,
    sampleData: { name: 'Sophie Turner' },
  },
  {
    key: 'creator_approved', name: 'Account approved', group: 'creator',
    description: 'Sent when admin approves a creator',
    variables: ['name'],
    defaultSubject: "You're approved — welcome to Nayba!",
    defaultBody: `${heading("You're Approved!")}${subtext("Great news, {{name}}. Your creator account is live.")}${p("Start exploring local campaigns and express your interest. When a brand selects you, we'll send you all the details.")}${btn("Browse Campaigns")}`,
    sampleData: { name: 'Sophie Turner' },
  },
  {
    key: 'creator_denied', name: 'Account denied', group: 'creator',
    description: 'Sent when admin denies a creator',
    variables: ['name'],
    defaultSubject: 'Update on your Nayba application',
    defaultBody: `${heading("Application Update")}${subtext("Hi {{name}}, thanks for your interest in Nayba.")}${p("After reviewing your application, we're unable to approve your creator account at this time.")}${p("This could be for a number of reasons — incomplete profile, follower count, or content fit.")}${p("You're welcome to reapply in the future. If you have questions, just reply to this email.")}`,
    sampleData: { name: 'Sophie Turner' },
  },
  {
    key: 'creator_selected', name: 'Selected for campaign', group: 'creator',
    description: 'Sent when admin selects a creator for a campaign',
    variables: ['name', 'brand_name', 'campaign_title'],
    defaultSubject: "You've been selected for {{brand_name}}'s campaign!",
    defaultBody: `${heading("You've Been Selected!")}${subtext("Great news, {{name}} — {{brand_name}} wants to work with you.")}${p("You've been selected for their campaign: <strong>{{campaign_title}}</strong>.")}${p("Confirm your spot in the app to lock in your perk and get started.")}${btn("Confirm Your Spot")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'creator_confirmed', name: 'Spot confirmed', group: 'creator',
    description: 'Sent when creator confirms — includes perk, brand address, and any brand-specific instructions',
    variables: ['name', 'brand_name', 'campaign_title', 'perk_description', 'brand_address', 'brand_instructions', 'brand_instagram'],
    defaultSubject: "You're confirmed for {{brand_name}} — here's what happens next",
    defaultBody: `${heading("You're In!")}${subtext("Nice one, {{name}}. You're confirmed for {{brand_name}}'s campaign.")}${infoBox(`<p style="margin:0 0 6px;font-size:16px;font-weight:600;color:${INK};">{{campaign_title}}</p><p style="margin:0 0 4px;font-size:13px;color:${INK_60};">Perk: {{perk_description}}</p><p style="margin:0;font-size:13px;color:${INK_60};">📍 {{brand_address}}</p>`)}${p("<strong>What happens next:</strong>")}${p("1. <strong>{{brand_instructions}}</strong> (DM @{{brand_instagram}})")}${p("2. When you arrive, mention you're with Nayba or show your Instagram")}${p("3. After your visit, film a short Reel and submit the link in the app")}${btn("View Campaign")}`,
    sampleData: {
      name: 'Sophie Turner',
      brand_name: 'Revamp Gym',
      campaign_title: 'Summer Fitness Challenge',
      perk_description: 'Free week pass + PT session worth £45',
      brand_address: '12 High Street, Bury St Edmunds',
      brand_instructions: "Please book your visit at least 24h ahead by DMing us on Instagram. We'll meet you at reception.",
      brand_instagram: 'revampgym',
    },
  },
  {
    key: 'creator_campaign_complete', name: 'Campaign complete', group: 'creator',
    description: 'Sent when campaign is marked complete',
    variables: ['name', 'brand_name', 'campaign_title'],
    defaultSubject: 'Campaign complete — nice work on {{brand_name}}!',
    defaultBody: `${heading("Nice Work!")}${subtext("You've completed your campaign with {{brand_name}}.")}${p("Thanks for sharing your experience at {{brand_name}}. Your completion rate has been updated and you're one step closer to levelling up.")}${btn("View Your Profile")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'creator_deadline_reminder', name: 'Deadline reminder', group: 'creator',
    description: 'Sent 48 hours before content deadline',
    variables: ['name', 'brand_name', 'campaign_title', 'content_deadline'],
    defaultSubject: "Heads up — your Reel for {{brand_name}} is due in 48 hours",
    defaultBody: `${heading("Deadline Approaching")}${subtext("Hey {{name}}, just a reminder that your Reel for {{brand_name}} is due soon.")}${infoBox(`<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${INK};">{{campaign_title}}</p><p style="margin:0;font-size:13px;color:${INK_60};">Due by: {{content_deadline}}</p>`)}${p("If you've already visited, now's the time to film and submit your Reel. If you haven't visited yet, head over soon!")}${btn("Submit Your Reel")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge', content_deadline: '19 Apr 2026' },
  },
  {
    key: 'creator_content_received', name: 'Content received', group: 'creator',
    description: 'Sent when creator submits their Reel',
    variables: ['name', 'brand_name', 'campaign_title'],
    defaultSubject: "We got your Reel for {{brand_name}} — thanks!",
    defaultBody: `${heading("Reel Received!")}${subtext("Thanks, {{name}}. We've got your Reel for {{brand_name}}.")}${p("We'll review it and mark the campaign as complete once everything looks good. Your completion rate and level will update automatically.")}${btn("View Your Campaigns")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'weekly_digest', name: 'Weekly digest', group: 'creator',
    description: 'Weekly roundup of new campaigns in their area',
    variables: ['name', 'city', 'campaign_count'],
    defaultSubject: "This week's campaigns in {{city}} — {{campaign_count}} new opportunities",
    defaultBody: `${heading("New This Week")}${subtext("Hey {{name}}, here's what's new in {{city}}.")}${p("There are <strong>{{campaign_count}} new campaigns</strong> available in your area. Browse them now and express your interest before they fill up.")}${btn("Browse Campaigns")}`,
    sampleData: { name: 'Sophie Turner', city: 'Bury St Edmunds', campaign_count: '3' },
  },
  // ── Business ──
  {
    key: 'business_welcome', name: 'Welcome', group: 'business',
    description: 'Sent when a brand account is created',
    variables: ['name'],
    defaultSubject: 'Welcome to Nayba, {{name}}!',
    defaultBody: `${heading("Welcome to Nayba!")}${subtext("Hey {{name}}, your brand is live on the platform.")}${p("Local creators can now discover your campaigns and express interest. We'll handle the matching and keep you updated.")}${btn("View Dashboard")}`,
    sampleData: { name: 'Revamp Gym' },
  },
  {
    key: 'business_campaign_live', name: 'Campaign live', group: 'business',
    description: 'Sent when a campaign is published',
    variables: ['name', 'campaign_title', 'headline', 'perk_description', 'creator_target', 'expression_deadline'],
    defaultSubject: 'Your campaign is live — {{campaign_title}}',
    defaultBody: `${heading("Your Campaign is Live!")}${subtext("Great news, {{name}}. Your campaign is now visible to creators in your area.")}${infoBox(`<p style="margin:0 0 6px;font-size:16px;font-weight:600;color:${INK};">{{campaign_title}}</p><p style="margin:0 0 4px;font-size:13px;color:${INK_60};">Perk: {{perk_description}}</p><p style="margin:0;font-size:13px;color:${INK_60};">Looking for: {{creator_target}} creators</p>`)}${p("Creators can now express interest. We'll handle the selection process and keep you updated.")}${btn("View Campaign")}`,
    sampleData: { name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge', headline: 'Free week pass + PT session', perk_description: 'Free week pass worth £45', creator_target: '5', expression_deadline: '19 Apr 2026' },
  },
  {
    key: 'business_creator_confirmed', name: 'Creator confirmed', group: 'business',
    description: 'Sent when a creator confirms — brand knows who to expect',
    variables: ['name', 'creator_name', 'creator_instagram', 'campaign_title', 'perk_description'],
    defaultSubject: '{{creator_name}} is confirmed for your campaign',
    defaultBody: `${heading("Creator Confirmed")}${subtext("A creator has confirmed their spot and will visit soon.")}${infoBox(`<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${INK};">{{creator_name}}</p><p style="margin:0 0 12px;font-size:14px;color:${TERRA};font-weight:500;">@{{creator_instagram}}</p><p style="margin:0 0 4px;font-size:13px;color:${INK_60};">Campaign: {{campaign_title}}</p><p style="margin:0;font-size:13px;color:${INK_60};">Perk: {{perk_description}}</p>`)}${p("They'll visit your venue to redeem their perk and create content. They may show their Instagram or mention Nayba when they arrive.")}${p("You don't need to do anything — just welcome them when they visit.")}${btn("View in Dashboard")}`,
    sampleData: { name: 'Revamp Gym', creator_name: 'Sophie Turner', creator_instagram: 'sophieturner_bse', campaign_title: 'Summer Fitness Challenge', perk_description: 'Free week pass + PT session worth £45' },
  },
  {
    key: 'business_approved', name: 'Account approved', group: 'business',
    description: 'Sent when admin approves a brand',
    variables: ['name'],
    defaultSubject: "You're approved — welcome to Nayba!",
    defaultBody: `${heading("You're Approved!")}${subtext("Welcome to Nayba, {{name}}. You're live on the platform.")}${p("Create your first campaign and local creators will be able to discover and express interest right away.")}${p("If you need any help getting started, just reply to this email — we're here for you.")}${btn("View Dashboard")}`,
    sampleData: { name: 'Revamp Gym' },
  },
  {
    key: 'business_denied', name: 'Account denied', group: 'business',
    description: 'Sent when admin denies a brand',
    variables: ['name'],
    defaultSubject: 'Update on your Nayba application',
    defaultBody: `${heading("Application Update")}${subtext("Hi {{name}}, thanks for your interest in Nayba.")}${p("After reviewing your application, we're unable to approve your business account at this time.")}${p("If you have questions or would like to reapply, reply to this email and we'll help.")}`,
    sampleData: { name: 'Revamp Gym' },
  },
  // ── Admin ──
  {
    key: 'admin_interest_expressed', name: 'Interest expressed', group: 'admin',
    description: 'Notified when a creator applies to a campaign',
    variables: ['creator_name', 'brand_name', 'campaign_title'],
    defaultSubject: '{{creator_name}} interested in {{brand_name}}',
    defaultBody: `${heading("New Interest")}${p("<strong>{{creator_name}}</strong> expressed interest in <strong>{{brand_name}}</strong>'s campaign: {{campaign_title}}")}${btn("View in Dashboard", INK)}`,
    sampleData: { creator_name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'admin_creator_confirmed', name: 'Creator confirmed', group: 'admin',
    description: 'Notified when a creator confirms their spot',
    variables: ['creator_name', 'brand_name', 'campaign_title'],
    defaultSubject: '{{creator_name}} confirmed for {{brand_name}}',
    defaultBody: `${heading("Creator Confirmed")}${p("<strong>{{creator_name}}</strong> confirmed their spot for <strong>{{brand_name}}</strong>'s campaign: {{campaign_title}}")}${btn("View in Dashboard", INK)}`,
    sampleData: { creator_name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'admin_content_submitted', name: 'Content submitted', group: 'admin',
    description: 'Notified when a creator submits a Reel',
    variables: ['creator_name', 'brand_name', 'campaign_title'],
    defaultSubject: '{{creator_name}} submitted a Reel for {{brand_name}}',
    defaultBody: `${heading("Reel Submitted")}${p("<strong>{{creator_name}}</strong> submitted a Reel for <strong>{{brand_name}}</strong>'s campaign: {{campaign_title}}")}${btn("View in Dashboard", INK)}`,
    sampleData: { creator_name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'admin_signup', name: 'New signup', group: 'admin',
    description: 'Notified when a new creator or brand signs up',
    variables: ['user_type', 'display_name', 'email'],
    defaultSubject: 'New {{user_type}} signup: {{display_name}}',
    defaultBody: `${heading("New Signup")}${p("A new <strong>{{user_type}}</strong> has signed up:")}${infoBox(`<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${INK};">{{display_name}}</p><p style="margin:0;font-size:13px;color:${INK_60};">{{email}}</p>`)}${btn("Review in Dashboard", INK)}`,
    sampleData: { user_type: 'creator', display_name: 'Sophie Turner', email: 'sophie@example.com' },
  },
  {
    key: 'admin_approval_request', name: 'Approval request', group: 'admin',
    description: 'Notified when a creator needs approval',
    variables: ['user_type', 'display_name', 'email'],
    defaultSubject: 'New {{user_type}} awaiting approval: {{display_name}}',
    defaultBody: `${heading("Approval Needed")}${p("A new <strong>{{user_type}}</strong> is waiting for approval:")}${infoBox(`<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${INK};">{{display_name}}</p><p style="margin:0;font-size:13px;color:${INK_60};">{{email}}</p>`)}${p("Review their profile and approve or deny their application.")}${btn("Review Now", INK)}`,
    sampleData: { user_type: 'creator', display_name: 'Sophie Turner', email: 'sophie@example.com' },
  },
  {
    key: 'feedback', name: 'Feedback received', group: 'admin',
    description: 'Notified when a user submits feedback',
    variables: ['display_name', 'user_type', 'page', 'feedback'],
    defaultSubject: 'Feedback from {{display_name}}',
    defaultBody: `${heading("New Feedback")}${subtext("{{display_name}} ({{user_type}}) sent feedback from the {{page}} page.")}${infoBox(`<p style="margin:0;font-size:14px;color:${INK};line-height:1.6;">{{feedback}}</p>`)}${btn("View in Dashboard", INK)}`,
    sampleData: { display_name: 'Sophie Turner', user_type: 'creator', page: 'Profile', feedback: 'Love the app! Would be great to see more campaigns in Ipswich.' },
  },
];

/** Render a full email preview HTML string from a template */
export function renderPreview(template: EmailTemplate, overrides?: { subject?: string; body?: string }): string {
  const body = overrides?.body || template.defaultBody;
  const interpolated = interpolate(body, template.sampleData);
  return wrapEmail(interpolated);
}

/** Get the subject line with sample data interpolated */
export function renderSubject(template: EmailTemplate, overrides?: { subject?: string }): string {
  const subject = overrides?.subject || template.defaultSubject;
  return interpolate(subject, template.sampleData);
}
