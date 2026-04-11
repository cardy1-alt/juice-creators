/**
 * Client-side email preview rendering.
 * Mirrors the helpers in supabase/functions/send-email/index.ts
 * so admin can preview emails without calling the edge function.
 */

const TERRA = '#D95F3B';
const INK = '#2A2018';
const INK_60 = '#7A7168';
const INK_35 = '#B0AAA4';
const INK_08 = '#F4F3F1';
const TERRA_LIGHT = '#FDF5F2';
const TERRA_BORDER = '#F2DDD5';

export function heading(text: string) {
  return `<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 22px; font-weight: 600; color: ${INK}; margin: 0 0 8px; letter-spacing: -0.3px;">${text}</h1>`;
}

export function subtext(text: string) {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: ${INK_60}; margin: 0 0 24px;">${text}</p>`;
}

export function p(text: string) {
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.7; color: ${INK}; margin: 0 0 16px;">${text}</p>`;
}

export function btn(text: string, bg = TERRA) {
  return `<div style="text-align: center; margin: 28px 0 0;">
    <a href="#" style="display: inline-block; background: ${bg}; color: #FFFFFF; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: -0.2px;">${text}</a>
  </div>`;
}

export function infoBox(content: string) {
  return `<div style="background: ${INK_08}; border-radius: 10px; padding: 20px; margin: 20px 0;">${content}</div>`;
}

export function wrapEmail(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #FAFAF9; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 24px; font-weight: 700; color: ${INK}; letter-spacing: -0.04em;">Nayba</span>
    </div>
    <div style="background: #FFFFFF; border-radius: 12px; padding: 36px 28px; box-shadow: 0 1px 4px rgba(42,32,24,0.04);">
      ${body}
    </div>
    <div style="text-align: center; padding: 28px 0 0;">
      <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: ${INK_35};">The Nayba Team &middot; Connecting creators with local businesses</p>
      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: ${INK_35};">You're receiving this because you signed up for Nayba.</p>
    </div>
  </div>
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
    key: 'creator_selected', name: 'Selected for campaign', group: 'creator',
    description: 'Sent when admin selects a creator for a campaign',
    variables: ['name', 'brand_name', 'campaign_title'],
    defaultSubject: "You've been selected for {{brand_name}}'s campaign!",
    defaultBody: `${heading("You've Been Selected!")}${subtext("Great news, {{name}} — {{brand_name}} wants to work with you.")}${p("You've been selected for their campaign: <strong>{{campaign_title}}</strong>.")}${p("Confirm your spot in the app to lock in your perk and get started.")}${btn("Confirm Your Spot")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
  },
  {
    key: 'creator_confirmed', name: 'Spot confirmed', group: 'creator',
    description: 'Sent when creator confirms — includes perk and brand address',
    variables: ['name', 'brand_name', 'campaign_title', 'perk_description', 'brand_address'],
    defaultSubject: "You're confirmed for {{brand_name}} — here's what happens next",
    defaultBody: `${heading("You're In!")}${subtext("Nice one, {{name}}. You're confirmed for {{brand_name}}'s campaign.")}${infoBox(`<p style="margin:0 0 6px;font-size:16px;font-weight:600;color:${INK};">{{campaign_title}}</p><p style="margin:0 0 4px;font-size:13px;color:${INK_60};">Perk: {{perk_description}}</p><p style="margin:0;font-size:13px;color:${INK_60};">📍 {{brand_address}}</p>`)}${p("Your perk is ready — visit the brand whenever suits you. When you arrive, just mention you're with Nayba or show your Instagram.")}${p("After your visit, film a short Reel sharing your experience and submit the link in the app.")}${btn("View Campaign")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge', perk_description: 'Free week pass + PT session worth £45', brand_address: '12 High Street, Bury St Edmunds' },
  },
  {
    key: 'creator_campaign_complete', name: 'Campaign complete', group: 'creator',
    description: 'Sent when campaign is marked complete',
    variables: ['name', 'brand_name', 'campaign_title'],
    defaultSubject: 'Campaign complete — nice work on {{brand_name}}!',
    defaultBody: `${heading("Nice Work!")}${subtext("You've completed your campaign with {{brand_name}}.")}${p("Thanks for sharing your experience at {{brand_name}}. Your completion rate has been updated and you're one step closer to levelling up.")}${btn("View Your Profile")}`,
    sampleData: { name: 'Sophie Turner', brand_name: 'Revamp Gym', campaign_title: 'Summer Fitness Challenge' },
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
