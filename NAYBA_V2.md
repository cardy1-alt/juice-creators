# NAYBA_V2.md — Authoritative Product & Design Spec
# Version 2.0 | April 2026

> THIS FILE SUPERSEDES ALL PREVIOUS SPEC FILES.
> NAYBA_DESIGN.md, NAYBA_REVERT.txt, AUDIT_MVP_LAUNCH.md, CODEBASE_AUDIT.md, AUDIT-TRACKER.md, and CLAUDE.md are now DEPRECATED.
> Do not follow instructions in those files. Follow this file only.
> If anything conflicts between this file and a deprecated file, this file wins.

---

## What is Nayba?

Nayba is a hyperlocal creator-brand marketplace, modelled on Hummingbirds (US).

Brands post campaigns. Local creators express interest. Brands (or the nayba admin) select creators. Selected creators receive an in-kind perk, visit the business or purchase the product, post an Instagram Reel, and submit proof. Brands get authentic, hyperlocal UGC and word-of-mouth reach from real people with real local audiences.

No cash to creators. Ever. Perks only — free experiences, products, or gift cards.
No follower minimums. A creator with 500 engaged local followers is valuable.
No agencies. No briefs written by committees. Just real people, real places, real content.

**The name:** "Nayba" is neighbour, respelled. Hyperlocal, human, unpretentious. Always lowercase.

**Pilot geography:** Bury St Edmunds. Expanding to Ipswich, Norwich, Cambridge.

**Live at:** app.nayba.app

---

## The Core Loop

1. Admin (Jacob) creates a campaign on behalf of a brand via the admin panel
2. Creators in the target city/county are notified by email (and WhatsApp at pilot)
3. Email contains a deep link directly to that campaign's detail page
4. Creator taps "I'm Interested" — submits optional pitch
5. Admin (acting as brand) reviews applicants and selects creators
6. Selected creators are notified by email and confirmed in the app
7. Creator receives their perk (manually at pilot), visits the business or buys the product
8. Creator posts a Reel, submits the link in their Campaigns tab
9. Admin reviews submission, marks complete
10. Brand dashboard updates with reach, engagement, UGC gallery

---

## Pilot Operating Model

Jacob runs everything manually at pilot stage:

- Creates all campaigns via the admin panel on behalf of brands
- Selects creators from the applicant list in the admin panel
- Sends perks manually (e-gift card, arranges free visit with business)
- Reviews submitted Reels and marks campaigns complete
- Monitors analytics per campaign

The brand dashboard is built and ready but brands do not have active logins at pilot. Jacob operates it on their behalf. When a brand is ready to self-serve, Jacob creates their account and hands over access.

The creator-facing app is fully live. Creators sign up, browse campaigns, express interest, and submit content independently.

---

## Admin Self-Sufficiency — Running the Platform Solo

The admin panel must allow Jacob to operate the entire platform without any creators or brands present. This is essential for testing, demonstration, and internal use.

### Manual creator creation (admin panel)
Jacob can create a creator account directly from the Creators tab in the admin dashboard without the creator needing to self-register. Fields required:

- Display name
- Email address (used for auth — a Supabase auth user is created)
- Instagram handle (optional at creation)
- City / location
- Level (defaults to 1 — Newcomer)
- A temporary password is set and emailed to the creator automatically

This allows Jacob to:
- Onboard creators who contact him directly outside the app
- Create test/demo creator accounts
- Seed the platform before the WhatsApp Community launch
- Represent a creator in a campaign end-to-end without them self-registering

### Manual application creation (admin panel)
From within any campaign in the Campaigns tab, Jacob can manually add a creator as an applicant — bypassing the "I'm Interested" flow entirely. Useful when a creator has expressed interest via WhatsApp or email and Jacob wants to move them into the platform flow.

### Manual participation management (admin panel)
Jacob can manually move any application through the full participation lifecycle:
- Mark as selected
- Mark perk as sent
- Enter Reel URL on behalf of a creator
- Enter reach/engagement data manually
- Mark as complete

This means the entire campaign lifecycle can be run from the admin panel alone, with no creator or brand action required.

### Manual brand/campaign creation (admin panel)
Jacob can create a brand account and a campaign in full without the brand being involved. All campaign fields are editable by admin at any time regardless of status.

### Demo mode
The existing ?demo=creator|business|admin URL parameter stays. Jacob can demonstrate the platform to prospective creators or brands using demo mode without creating real accounts.

### What this means for Claude Code
When building the admin Campaigns tab, every stage of the campaign lifecycle must have a manual override action available to the admin. No stage should require creator or brand action to proceed. Admin is always able to act on behalf of either side.

---

## Infrastructure — DO NOT CHANGE

All of the following stays exactly as is. Do not alter connection strings, project references, or deployment configuration.

| Layer | Detail |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS 3 |
| Build | Vite 5 |
| Database | Supabase — project: uwegcqabvlcswviexuax.supabase.co |
| Auth | Supabase email/password |
| Backend | Supabase Edge Functions (Deno) |
| Email | Resend — sending domain nayba.app |
| Hosting | Vercel — deploys on push to main |
| Repo | github.com/cardy1-alt/juice-creators |
| Cron | Vercel cron → Supabase Edge Function |

State-based routing in App.tsx — no React Router. This stays.

---

## Routing

| State | Renders |
|---|---|
| Unauthenticated | Auth.tsx |
| role: creator | CreatorApp.tsx |
| role: business | BusinessPortal.tsx (brand dashboard) |
| role: admin | AdminDashboard.tsx |
| /campaign/:id or ?campaign=id | Campaign detail — deep link from email |
| #type=recovery | Password reset flow |

The campaign deep link is new and critical. Every notification email links directly to a specific campaign page. Creator must be able to land on that page without navigating from the discover feed.

---

## Design Direction

### The shift

The previous app was built as a consumer-facing mobile product — image-heavy, photo-first cards, warm and tactile. This pivot changes the primary use case. The brand dashboard and admin panel are professional tools used on desktop. The creator side remains mobile-optimised but the overall aesthetic shifts toward editorial and data-forward rather than consumer lifestyle.

Less: full-bleed hero images, frosted glass badges, swipeable carousels as primary navigation
More: clean typography, clear data hierarchy, well-structured campaign briefs, purposeful use of colour

Images still appear on campaign cards and in the UGC gallery. They are no longer the structural backbone of the UI.

### Responsive approach

- Creator app: mobile-first, optimised for 390px viewport (iPhone). Works fine on desktop.
- Brand dashboard: desktop-first, minimum 1280px wide. Degrades gracefully on tablet. Not designed for mobile.
- Admin dashboard: desktop-first. Same as brand.

---

## Colour System

Defined in src/styles/theme.css. Mapped in tailwind.config.js under nayba-* namespace.

| Token | Hex | Role |
|---|---|---|
| `--shell` | `#F7F7F5` | Page background — slightly cooler than previous for desktop legibility |
| `--card` | `#FFFFFF` | Card surfaces, input backgrounds, dashboard panels |
| `--terra` | `#C4674A` | All CTAs, active nav, progress bars, active states — the single action colour |
| `--terra-light` | `rgba(196,103,74,0.08)` | Terra tint for hover states, selected rows, highlights |
| `--ink` | `#222222` | Primary text |
| `--ink-60` | `rgba(34,34,34,0.60)` | Secondary text, descriptions, metadata |
| `--ink-35` | `rgba(34,34,34,0.35)` | Helper text, timestamps, muted labels |
| `--ink-10` | `rgba(34,34,34,0.10)` | Hairline borders, dividers, table lines |
| `--border` | `#E8E3DC` | Card borders, panel edges |
| `--success` | `#2D7A4F` | Completed status, confirmed states |
| `--warning` | `#C4674A` | Overdue, urgent — reuses terra intentionally |
| `--neutral` | `#6B7280` | Pending, inactive status badges |

Rules:
- Terra is the single action colour. One primary CTA per screen.
- All shadows use rgba(34,34,34,…) — never black or rgba(0,0,0,…)
- Forest green (#1A3C34) is retired from the UI entirely. Wordmark only if used.
- No gradients on functional UI elements. Gradients only on decorative/illustration elements.

---

## Typography

One font only: Instrument Sans. Loaded via Google Fonts link in index.html.
Remove Corben from index.html entirely — it is no longer used anywhere.

| Weight | Usage |
|---|---|
| 700 | Page titles, campaign names, hero headlines, button labels |
| 600 | Section headers, card titles, active nav labels, field labels |
| 500 | Secondary labels, metadata, badge text, filter chips |
| 400 | Body copy, descriptions, placeholders, table content |

Sizing:
- Page titles: 28px desktop / 24px mobile, weight 700, letter-spacing -0.4px
- Section headers: 18px, weight 600
- Card titles: 16px, weight 600
- Body / descriptions: 15px, weight 400, line-height 1.65
- Metadata / timestamps: 13px, weight 400, ink-35
- Button labels: 15px, weight 600
- Table headers: 12px, weight 600, uppercase, letter-spacing 0.6px, ink-60

---

## Spacing & Shape

| Token | Value | Usage |
|---|---|---|
| `--r-pill` | 999px | Primary CTA buttons only |
| `--r-card` | 12px | Cards, panels, modals — slightly tighter than before for desktop |
| `--r-sm` | 8px | Badges, chips, small elements |
| `--r-input` | 8px | Input fields |
| Border width | 1px | All borders — inputs, cards, dividers |

Dashboard panels use a subtle border (--border) rather than shadow to feel more structured and less floaty on desktop.

---

## Component Patterns

### Buttons
- Primary: terra fill (#C4674A), pill radius, Instrument Sans 600, white text, 48px height desktop / 52px mobile
- Shadow: 0 4px 16px rgba(196,103,74,0.28)
- Secondary: white background, 1px --border border, ink text, same radius as primary
- Ghost/text: no background, no border, terra text, used for back actions and inline links

### Inputs
- Background: white
- Border: 1px --ink-10 at rest, 1px terra on focus
- Focus ring: rgba(196,103,74,0.12)
- Border-radius: 8px
- Label above field — not floating. Floating labels removed. Clean label + input stack.

### Cards (creator-facing)
- Background: white
- Border: 1px --border
- Border-radius: 12px
- Shadow: 0 2px 8px rgba(34,34,34,0.06)
- Campaign image: 16:9 aspect ratio, object-fit cover, rounded top corners only

### Dashboard panels (brand/admin)
- Background: white
- Border: 1px --border
- Border-radius: 12px
- No shadow — border only, cleaner on desktop

### Status badges
- Pill shape, 8px radius, 12px font, weight 600
- Interested: terra-light background, terra text
- Selected: success green background (rgba(45,122,79,0.1)), success green text
- Confirmed: same as selected
- Content submitted: blue tint (rgba(59,130,246,0.1)), blue text
- Completed: ink-10 background, ink-60 text
- Overdue: red tint (rgba(220,38,38,0.1)), red text

### Data tables (brand/admin)
- Full width, no outer border
- Header row: 12px uppercase labels, ink-60, ink-10 bottom border
- Row height: 52px
- Row hover: --shell background
- Selected row: terra-light background
- Alternating row colours: off. Clean white rows only.

---

## Database — Key Changes

The following tables are being replaced or significantly altered. Infrastructure (Supabase project, auth, RLS) stays the same.

### Retiring
- `offers` table — replaced by `campaigns`
- `claims` table — replaced by `applications` and `participations`
- `waitlist` table — no longer needed

### New tables needed

**campaigns**
- id, brand_id, title, headline, about_brand, perk_description, perk_value (£), perk_type (gift_card / experience / product)
- target_city, target_county
- content_requirements (text), talking_points (text array), inspiration (json array of {title, description})
- deliverables (json — e.g. {reel: true, story: false})
- creator_target (integer — how many creators wanted)
- open_date, expression_deadline, content_deadline
- status (draft / active / selecting / live / completed)
- min_level (1/3/5 — optional creator tier gating)
- created_at, created_by (admin user id)

**applications** (replaces claims — the expression of interest)
- id, campaign_id, creator_id
- pitch (text — optional message from creator)
- status (interested / selected / confirmed / declined)
- applied_at, selected_at, confirmed_at

**participations** (created when creator is confirmed)
- id, application_id, campaign_id, creator_id
- perk_sent (boolean), perk_sent_at
- reel_url, reel_submitted_at
- reach, likes, comments, views (populated manually at pilot, via API later)
- status (confirmed / visited / content_submitted / completed / overdue)
- completion_rate_snapshot (creator's rate at time of selection)
- completed_at

**creator_stats** (updated on each completion)
- creator_id, total_campaigns, completed_campaigns, completion_rate (calculated)
- total_reach, average_engagement_rate
- last_campaign_at

### Keeping (with minor updates)
- creators — add completion_rate field, instagram_connected boolean, instagram_access_token (encrypted)
- businesses — keep as is, now called "brands" in UI copy but table stays businesses
- notifications — keep, add campaign_id foreign key
- disputes — keep
- AdminDashboard user management — keep

---

## Creator App (CreatorApp.tsx)

### Navigation — 5 tabs
Discover / Campaigns / Naybahood / Profile / More

### Discover tab
- Campaign cards in a clean vertical feed (not horizontal rows)
- Each card: brand name, campaign headline, perk summary (e.g. "Free facial — worth £60"), city tag, expression deadline pill
- Category filter chips at top: All / Food / Beauty / Wellness / Experience
- Search bar — searches campaign titles and brand names
- No image-first hero cards. Campaign card has a small brand logo/image left, content right. Clean and scannable.
- If creator has active confirmed participations, a "You're in — see your campaigns" banner appears at top

### Campaign detail page
This is the most important screen. Creators land here from email deep links.

Sections (accordion on mobile, all visible on desktop):
1. Hero — brand name, campaign headline, perk detail, deadline
2. About the brand — short description
3. What's in it for you — perk breakdown, value, how delivered
4. What to post — deliverables (Reel required), content requirements, required tags/hashtags
5. Talking points — 3 key messages to weave in naturally
6. Inspiration — 2-4 specific video concept briefs with title and description
7. Campaign dates — open, expression deadline, content deadline

Sticky bottom bar: "I'm Interested" CTA (terra pill button). If already applied: "Interest registered — we'll be in touch". If selected: "You're selected — confirm your spot".

### Campaigns tab (replaces Active Claims + History)
Two sub-tabs: Active / Past

Active shows confirmed participations with status stepper:
Selected → Confirmed → Perk Received → Content Due → Submitted → Complete

Each active campaign card shows: brand name, perk, content deadline countdown, submit Reel link button.

Past shows completed and declined applications.

### Naybahood tab
Locked until first campaign completed. Shows a locked state with "Complete your first campaign to unlock The Naybahood" message.
Once unlocked: link to WhatsApp Community at pilot. In-app community feed post-pilot.

### Profile tab
- Avatar, display name, Instagram handle (tappable link)
- Completion rate — prominently shown (e.g. "4/4 campaigns completed — 100%"). This is visible to brands.
- Stats: total campaigns, total reach (manual at pilot), campaigns completed
- Level badge and progress
- Instagram connection status — "Connect Instagram" CTA when not connected (for future API integration)
- Profile completeness indicator

### More tab
- Campaign history (all-time)
- Account settings
- Refer a creator
- Help / support link
- Sign out

---

## Brand Dashboard (BusinessPortal.tsx)

Desktop-first. Five tabs.

### Summary tab
- Campaign name, status pill, dates
- Key stats row: Applicants / Selected / Content submitted / Completed / Total reach (when available)
- Campaign brief summary (read-only — what was briefed)
- Perk details
- Export campaign report button (PDF — post-pilot)

### Selection tab
- Table of all creators who expressed interest
- Columns: Creator name, Instagram handle (linked), followers, completion rate, level, applied at, pitch (expandable), action (Select / Decline)
- Bulk select option
- Filter by: level, completion rate, city
- Selected creators shown in confirmed table below with status

### Participation tab
- Per-creator status tracking
- Columns: Creator, status badge, perk sent (checkbox), content deadline, Reel submitted (link), reach, engagement
- Quick actions: mark perk sent, mark visited, approve content

### Content tab
- UGC gallery — grid of submitted Reels
- Each card: creator name, thumbnail (from Reel link), reach, engagement, posted date
- View on Instagram link
- Download button (when API connected — pulls video file)
- Repurpose tag — admin can flag content as "approved for repurposing"

### Analytics tab
- Total reach across all creators in campaign
- Average engagement rate — benchmarked against platform average (3-4% target)
- Total pieces of content
- Reach by creator bar chart
- Engagement rate distribution
- Platform benchmark comparison: "Your campaign vs nayba average"
- At pilot: data is manually entered. Fields are present, populated by admin.
- Post-pilot: populated automatically via Instagram API

---

## Admin Dashboard (AdminDashboard.tsx)

Six tabs. Desktop only.

### Campaigns tab (new — primary tab)
- Create campaign (full form matching campaign fields above)
- Campaign list with status, brand, city, applicant count, selected count, content submitted count
- Click into any campaign to see full detail and manage selection/participation

### Creators tab
- List of all creators with approval status, level, completion rate, city, Instagram handle
- Approve / deny applications
- View creator profile detail
- Manually adjust completion rate if needed

### Brands tab (replaces Businesses tab in copy only — table stays businesses)
- List of brands
- Create brand account
- View campaigns per brand
- Access brand dashboard on behalf of brand

### Analytics tab (new)
- Platform-wide stats: total campaigns, total creators, total Reels posted, total estimated reach
- City-level breakdown
- Creator acquisition over time
- Campaign completion rate trend

### Notifications tab
- Trigger campaign notification emails to all eligible creators in a city
- Preview email before sending
- Log of sent notifications

### Settings tab
- Admin email, platform config
- Feature flags (e.g. instagram_api_enabled, naybahood_enabled)

---

## Email & Notifications

### Trigger: new campaign goes live
- Admin publishes a campaign
- Email sent to all creators in target city/county
- Subject: "New campaign just dropped — [Brand Name]"
- Body: campaign headline, perk summary, content deadline, deep link CTA button → /campaign/[id]
- Sent via Resend

### Trigger: creator selected
- Email to selected creator
- Subject: "You've been selected — [Brand Name] wants you"
- Body: campaign recap, what happens next, confirm your spot CTA

### Trigger: confirmation
- Creator taps confirm in app
- Email confirmation sent to creator
- Admin notified

### Trigger: content deadline approaching
- 48 hours before content_deadline
- Email to confirmed creators who haven't submitted yet

### Trigger: content submitted
- Creator submits Reel link
- Admin notified via email

### Weekly digest (post-pilot)
- Every Tuesday — all active campaigns in creator's city
- Automated via Resend scheduled send or cron job

---

## Instagram API — Roadmap

### Pilot (now)
- Creators submit Reel URL manually in the app
- Admin manually checks the post and enters reach/engagement data in the participation record
- Instagram connection UI is present on creator profile but shows "coming soon" state
- Begin Meta developer app approval process now — runs in parallel with build

### Post-pilot (when Meta approval received)
- Creator connects Instagram via OAuth on profile screen
- Platform stores access token (encrypted) in creators table
- On Reel submission: platform automatically fetches reach, views, likes, comments from Instagram API
- Analytics dashboard populates automatically
- Completion verification: system checks for required hashtags and tags in post content
- Creator profile shows real follower count and engagement rate pulled from API

### What the OAuth flow requests
- View profile (follower count, bio, profile picture)
- Access insights (reach, impressions, engagement per post)
- Access and manage comments (for content verification)

---

## Gift Card / Perk Delivery — Roadmap

### Pilot (now)
- Jacob manually arranges perks per campaign
- For experiences: Jacob contacts the business, they agree to honour the visit
- For products: Jacob coordinates delivery or in-store collection
- For gift cards: Jacob manually sends an e-gift card (Tillo dashboard, no API needed)

### Post-pilot
- Tillo API integration — UK's leading digital gift card delivery platform
- Supports 3,000+ brands, 25 currencies, instant delivery via email link
- Triggered automatically when admin marks "perk sent" in participation record
- Creator receives branded email with gift card link
- No prepaid Visa cards at launch — retailer-specific gift cards only (cleaner, more authentic)

---

## Completion Rate System

Every creator has a completion_rate field — visible on their profile and in the brand Selection tab.

Calculation: completed_campaigns / total_confirmed_campaigns × 100

Rules:
- Expressing interest and not being selected: does not affect rate
- Being selected, confirming, then not submitting content by deadline: counts as incomplete
- Being selected and completing: counts as complete
- Admin can manually override in exceptional circumstances

Display: shown as percentage with campaign count (e.g. "100% — 4 of 4 campaigns")
Threshold: creators with below 60% completion rate are flagged in the selection tab for brands to see.

---

## Creator Levels

Kept from V1 — database fields preserved.

| Level | Name | Requirement |
|---|---|---|
| 1 | Newcomer | 0 campaigns |
| 2 | Explorer | 1-2 campaigns |
| 3 | Regular | 3-5 campaigns |
| 4 | Local | 6-10 campaigns |
| 5 | Trusted | 11-20 campaigns + high completion rate |
| 6 | Nayba ✦ | 21+ campaigns + 95%+ completion rate |

Gamification UI (streaks, leaderboard, level-up overlays) is stripped from the visible UI at pilot. Database fields remain. Levels are visible on profiles and in the brand selection view because they signal creator experience to brands.

---

## The Naybahood

- Equivalent to Hummingbirds' "The Charm"
- Unlocks after a creator completes their first campaign
- At pilot: links to the existing WhatsApp Community
- Post-pilot: in-app community feed, possibly Circle embed
- Tab appears in creator nav from signup but shows locked state until unlocked
- Unlocking triggers a celebratory moment in the UI ("Welcome to The Naybahood")

---

## Campaign Categories

| Category | Notes |
|---|---|
| Food & Drink | Cafes, restaurants, delis, bakeries, food/drink products |
| Beauty | Salons, nail studios, skincare, makeup products |
| Wellness | Gyms, yoga, spa, health products |
| Experience | Events, activities, venues, anything else |
| Retail | Product-in-store campaigns for brands in supermarkets/retailers |

---

## Geographic Rollout

| Location | Status |
|---|---|
| Bury St Edmunds | Live — pilot |
| Suffolk (county-wide) | Phase 2 |
| Ipswich | Phase 2 |
| Norwich | Phase 3 |
| Cambridge | Phase 3 |
| East Anglia | Phase 4 |

Campaigns target city or county — admin selects when creating. Creators see campaigns matching their registered location.

---

## What to Tell Claude Code

When working with Claude Code on this codebase:

1. This file (NAYBA_V2.md) is the only authoritative spec. Ignore NAYBA_DESIGN.md, NAYBA_REVERT.txt, AUDIT_MVP_LAUNCH.md, CODEBASE_AUDIT.md, AUDIT-TRACKER.md.

2. The core mechanic has changed from offer/claim to campaign/application. Offers are now campaigns. Claims are now applications. The UI and database reflect this.

3. Infrastructure is unchanged. Same Supabase project, same Vercel deployment, same GitHub repo, same Resend config. Do not change any connection strings or environment variables.

4. Font is Instrument Sans only. Remove Corben from index.html. Do not use Plus Jakarta Sans.

5. The app is now desktop-first for brand and admin views. Creator app remains mobile-first.

6. Campaign detail page must support deep linking from email (/campaign/:id or ?campaign=id) — creator can land directly on it without going through the discover feed.

7. All old QR code redemption logic is removed. The confirmation mechanic (business tapping to confirm visit) is removed. Visit confirmation is now implicit — creator submits a Reel link as proof.

8. Image-heavy UI patterns are replaced with data-forward, editorial layouts. No swipeable carousels as primary navigation. No frosted glass badges. Clean tables and clear typography.

9. When in doubt about design decisions, refer to the colour system and component patterns in this file.

10. Scope each Claude Code prompt to a single file or small change set. Do not attempt to rebuild multiple components in one prompt.

---

*Last updated: April 2026 — nayba V2 pivot to campaign-based model*
