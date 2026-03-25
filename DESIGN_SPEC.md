# Nayba UI Overhaul — Design Spec

Reference prototype: `/nayba-v7.html` (in project root)
Fonts: Corben (Google Fonts) + DM Sans (Google Fonts)
Status: In progress

-----

## Progress

|Chunk|Task                          |Status|
|-----|------------------------------|------|
|1    |Design tokens + fonts         |⬜     |
|2    |Auth screen                   |⬜     |
|3    |Bottom navigation             |⬜     |
|4    |Discover screen — swipe stack |⬜     |
|5    |Claims screen                 |⬜     |
|6    |All Offers screen             |⬜     |
|7    |Cleanup — remove dead features|⬜     |

Mark each chunk ✅ when complete before ending the session.

-----

## Ground Rules

- Do not touch any backend logic, Supabase queries, auth logic, or data fetching
- Do not change any routing structure or component file organisation
- Only change visual presentation — CSS, layout, component markup, typography, colour
- Read `tailwind.config.js` and `src/styles/theme.css` before touching anything
- Read `/nayba-v7.html` before starting each chunk — it is the single source of truth
- When in doubt, do less. Preserve existing behaviour and leave a single inline comment flagging it
- Complete the assigned chunk fully in one pass. Do not start the next chunk.

-----

## Chunk 1 — Design tokens + fonts

### Goal

Replace all colour variables and font imports across the project. Every subsequent chunk depends on this being correct.

### Fonts

Remove all existing font imports everywhere in the project.

Add to the project (Google Fonts import):

```
Corben — weight 400 only
DM Sans — weights 300, 400, 500, 600, 700
```

Apply globally:

- `font-family: 'Corben', serif` — wordmark, screen titles, offer card titles only
- `font-family: 'DM Sans', sans-serif` — everything else without exception

Update `tailwind.config.js` fontFamily:

```js
fontFamily: {
  display: ['Corben', 'serif'],
  sans: ['DM Sans', 'sans-serif'],
},
```

### Colour tokens

Replace ALL existing colour variables in `src/styles/theme.css` and `tailwind.config.js` with exactly these. Remove everything else.

```css
:root {
  --shell:   #F8F6F1;
  --card:    #F0ECE4;
  --border:  #E4DDD4;
  --ink:     #28201A;
  --ink-60:  rgba(40,32,26,0.60);
  --ink-35:  rgba(40,32,26,0.35);
  --ink-15:  rgba(40,32,26,0.15);
  --ink-08:  rgba(40,32,26,0.08);
  --terra:   #C4674A;
  --terra-10: rgba(196,103,74,0.10);
  --terra-20: rgba(196,103,74,0.20);
  --r-card:  20px;
  --r-pill:  999px;
}
```

Tailwind colours to match:

```js
colors: {
  nayba: {
    shell:   '#F8F6F1',
    card:    '#F0ECE4',
    border:  '#E4DDD4',
    ink:     '#28201A',
    terra:   '#C4674A',
  }
}
```

**Terra rule:** `#C4674A` is used ONLY for:

- Primary CTA buttons (claim, sign in)
- Urgent slot count badges (1–2 slots remaining)
- Active countdown timers
- Active nav indicator
- Nowhere else

### Category gradient variables

Add these to `:root` — used for offer card image zones:

```css
--grad-food:      linear-gradient(160deg, #C07858, #9A5C40);
--grad-beauty:    linear-gradient(160deg, #5A9470, #3E7254);
--grad-cafe:      linear-gradient(160deg, #C09840, #8C6E20);
--grad-wellness:  linear-gradient(160deg, #6A8EAE, #4A6E8E);
--grad-experience:linear-gradient(160deg, #9068A8, #6A4880);
```

### Border radius

```js
borderRadius: {
  'pill': '999px',
  'card': '20px',
  'card-sm': '14px',
}
```

### Done when

- `tailwind.config.js` uses new tokens
- `src/styles/theme.css` uses new tokens
- Google Fonts imports updated
- No old colour variables remain anywhere
- App builds without errors

-----

## Chunk 2 — Auth screen

### Goal

Replace the current dark auth screen with a light, calm, Scandi-inspired design.

### Layout

Full screen, `--shell` background. Vertically centred content with consistent gaps. Three sections top to bottom: brand, hero copy, form.

### Brand section

- Wordmark "nayba" in Corben Regular, 38px, `--ink`, letter-spacing -1px
- A 32px wide, 2px tall terra rule (`--terra`) directly below the wordmark, border-radius 2px

### Hero copy

- Headline: "Local offers. Yours to claim." in Corben Regular, 28px, `--ink`, line-height 1.15, letter-spacing -0.6px
- Subtext: "Vetted creators only. Claim offers from local businesses, visit in person, post your Reel." in DM Sans 400, 14px, `--ink-60`, line-height 1.7

### Form

- Email input: `--card` background, `1px solid --border`, border-radius 12px, padding 15px 16px, DM Sans 400 15px, `--ink` text, `--ink-35` placeholder
- Password input: same styling
- Sign in button: `--ink` background, `--shell` text, full pill radius, DM Sans 600 15px, full width, margin-top 2px
- "Not a member? Apply for access" — DM Sans 400 13px, `--ink-35` base, "Apply for access" underlined in `--ink-60`, text-underline-offset 3px

### Feel

Light, warm, approachable. No dark backgrounds. No gradients. Feels like a considered independent lifestyle brand, not a SaaS product.

### Done when

- Auth screen background is `--shell`
- All text is dark ink on light background
- Corben wordmark with terra rule renders correctly
- Form inputs use `--card` surface
- Sign in button is `--ink` not `--terra`

-----

## Chunk 3 — Bottom navigation

### Goal

Replace the existing 5-item nav with 3 items only.

### Items

1. **Discover** — stack/layers SVG icon
1. **Claims** — gift/ticket SVG icon. Shows a 6px terra notification pip (with `--shell` border) when active claims exist
1. **All offers** — list/lines SVG icon

Remove: Saved, Profile, Active (these nav items are gone for now)

### Styling

- Background: `rgba(248,246,241,0.95)` with `backdrop-filter: blur(20px)`
- Top border: `1px solid var(--border)`
- Bottom padding accounts for iOS safe area (`padding-bottom: env(safe-area-inset-bottom, 28px)`)
- Inactive state: icon stroke `--ink-35`, label `--ink-35`, DM Sans 500 10px
- Active state: icon stroke `--terra`, label `--terra`
- No background highlight on active item — colour change only

### Done when

- Nav shows exactly 3 items
- Terra active state works correctly
- Notification pip shows on Claims when active claims exist
- Safe area padding correct on iOS

-----

## Chunk 4 — Discover screen (swipe stack)

### Goal

Remove the existing explore grid entirely. Implement a swipe card stack. This is the most significant change.

### Remove from this screen

- Browse/explore grid of offer cards
- Category filter tabs (All / Food / Beauty / More)
- Search bar
- Leaderboard section
- Streak warning banner
- "Near you" horizontal scroll section
- "New this week" section
- Level badge and progress bar
- Your passes horizontal slider (replaced by active claim bar below)

### Screen structure (top to bottom, nothing scrolls)

1. Fixed header
1. Active claim bar (conditional)
1. Card stack (fills remaining space)
1. Progress dots
1. Action buttons (fixed above nav)

### 1. Fixed header

- Background `--shell`, bottom border `1px solid --border`
- Left: wordmark "nayba" in Corben Regular 24px, `--ink`, letter-spacing -0.4px
- Right: location pill + avatar initials

Location pill: `--card` bg, `1px solid --border`, pill radius, 12px DM Sans 500 `--ink-60`, location pin SVG icon

Avatar: 30px circle, `--card` bg, `1px solid --border`, DM Sans 600 10px initials `--ink-60`

### 2. Active claim bar

Only render when creator has ≥ 1 active claim. Full width, no margins.

- Background: `--ink`
- Left: "ACTIVE CLAIM" in DM Sans 600 9px uppercase letter-spaced `rgba(248,246,241,0.4)`. Below it: offer title + business name in DM Sans 500 13px `rgba(248,246,241,0.92)`
- Right: terra timer pill (DM Sans 600 10px) + chevron SVG in `rgba(248,246,241,0.4)`
- Tapping navigates to Claims screen

### 3. Card stack

Fills all vertical space between active claim bar and action buttons. Position absolute, overflow hidden.

**Card anatomy:**

- Left/right margin: 14px each side (so depth cards peek behind)
- Top margin: 12px
- Bottom: flush to top of action buttons
- Border radius: 20px
- Border: `1px solid var(--border)`
- Box shadow: `0 4px 24px rgba(40,32,26,0.09)`
- Background: `--shell`
- Display: flex, flex-direction: column

**Image zone (52% of card height):**

- If business has uploaded photo: `<img>` with `object-fit: cover`, width 100%, height 100%
- Fallback (no photo): category gradient background (see token variables) with centred emoji, font-size 72px, drop-shadow filter
- Slot badge: absolute top-right 12px. Pill shape, DM Sans 600 11px.
  - 3+ slots: `rgba(248,246,241,0.82)` background, `--ink` text
  - 1–2 slots: `--terra` background, `--shell` text, prepend 🔥

**Info panel (remaining height):**

- Background: `--shell`
- Top border: `1px solid var(--border)` (hard edge, no gradient)
- Padding: 13px 16px 12px
- Display flex column, gap 6px

Contents in order:

```
Category label    DM Sans 600, 10px, uppercase, letter-spacing 1px, --ink-35
Offer title       Corben Regular, 24px, letter-spacing -0.5px, --ink
Business row      [see below]
Divider           1px --border
Ask copy          DM Sans 400, 12px, --ink-60, line-height 1.5
```

Business row (flex, space-between):

- Left column: business name DM Sans 600 13px `--ink` / street + type DM Sans 400 12px `--ink-60`
- Right: distance pill — `--card` bg, `1px solid --border`, pill radius, DM Sans 500 11px `--ink-60`

Nothing in the info panel should overflow. Keep ask copy to one line maximum — truncate with ellipsis if needed.

**Stack depth:**

```
Top card:    z-index 10, transform: none
Second card: z-index 1,  transform: scale(0.96) translateY(10px)
Third card:  z-index 0,  transform: scale(0.92) translateY(20px)
```

**Swipe hint labels (on card, absolute positioned):**

- "Claim" label: left:14px, top:20px, green (#4E9468) border + text, rotate(-10deg)
- "Pass" label: right:14px, top:20px, `--terra` border + text, rotate(10deg)
- Both: pill shape, DM Sans 700 12px uppercase letter-spaced, border 2px solid
- Opacity: 0 at rest, tied to Math.min(Math.abs(dragX) / 60, 1) as user drags

**Drag behaviour:**

- Threshold: 85px
- Transform during drag: `translateX(${x}px) translateY(${y * 0.12}px) rotate(${x * 0.04}deg)`
- On release below threshold: `transition: transform 0.28s ease`, snap back
- On swipe right (claim): show success overlay, then remove card
- On swipe left (pass): remove card
- After removal: remaining cards animate to new positions with `transition: transform 0.28s ease`

**Claim success overlay:**

- Dark scrim `rgba(40,32,26,0.48)`, `backdrop-filter: blur(4px)`
- Centred white card, border-radius 22px, padding 28px 24px
- Contents: 46px ink circle with white checkmark SVG / offer title in Corben 21px / instruction copy in DM Sans 400 13px `--ink-60` / terra full-width pill button "View my claims →"
- Button navigates to Claims screen and dismisses overlay

**Empty state (when all cards swiped):**

- Fills stack area, `--shell` background
- "All caught up" in Corben Regular 24px `--ink`
- Subtitle DM Sans 400 14px `--ink-60` "New offers drop every Tuesday. Browse everything live below."
- `--ink` pill button "Browse all offers" → navigates to All Offers

### 4. Progress dots

- Positioned above action buttons, centred horizontally
- One dot per card in the deck
- Inactive: 5px circle, `--border` fill
- Active: 5px circle, `--ink-60` fill, scale(1.2)
- Transition: background 0.2s, transform 0.2s
- Hide when empty state shows

### 5. Action buttons

Fixed to bottom of screen above nav. Full width.

- Background: `rgba(248,246,241,0.95)`, `backdrop-filter: blur(16px)`
- Top border: `1px solid var(--border)`
- Padding: 10px 0 28px
- Layout: flex row, centred, gap 18px
- Contents: "pass" label · pass button · claim button · "claim" label
- Labels: DM Sans 500 10px `--ink-35`, width 42px, centred
- Pass button: 52px circle, `--card` bg, `1px solid --border`, X SVG stroke `--ink-60`
- Claim button: 64px circle, `--terra` bg, no border, checkmark SVG stroke white, box-shadow `0 4px 16px rgba(196,103,74,0.28)`
- Both buttons: transition transform 0.12s, scale(0.9) on active

### Done when

- Browse grid is completely gone
- Swipe stack renders with real offer data
- Drag to swipe works on both touch and mouse
- Claim and pass both function correctly
- Success overlay appears and routes to Claims
- Stack depth animation works correctly
- Empty state shows when all cards swiped
- Active claim bar shows/hides based on real data
- Nothing below the fold on any card

-----

## Chunk 5 — Claims screen

### Goal

Redesign the claims screen to match the prototype.

### Header

Sticky, `rgba(248,246,241,0.95)` background with backdrop blur, bottom border `1px solid --border`.

- "Claims" in Corben Regular 26px `--ink`, letter-spacing -0.5px
- "Show QR at the door · Post within 48 hrs of visiting" in DM Sans 400 12px `--ink-35`

### Claim cards

Each active claim renders as a card: `--card` background, `1px solid --border`, border-radius 20px, overflow hidden.

**Top section** (padding 14px 16px 12px, flex row):

- Left: offer title in Corben Regular 19px `--ink` / business name + street + distance in DM Sans 400 12px `--ink-60`
- Right: timer pill — DM Sans 600 10px, pill shape
  - Under 6 hours: `--terra` background, `--shell` text
  - 6+ hours: `rgba(40,32,26,0.06)` background, `--ink-60` text, `1px solid --border`

**QR section** (margin 0 14px 12px, `rgba(40,32,26,0.04)` bg, `1px solid --ink-15` border, 12px radius, padding 12px 14px):

- Left: 72px square, `--shell` background, `1px solid --border`, 8px radius — render actual QR code SVG
- Right column:
  - Ref code: DM Sans 600 10px, letter-spacing 2px, uppercase, `--ink` — e.g. "JACOB · 101"
  - Instruction: DM Sans 400 12px `--ink-60` line-height 1.5 — "Show at the door. Staff scan to confirm your visit."

**Buttons row** (padding 0 14px 14px, flex, gap 8px):

- "Release" button: flex 1, transparent bg, `1px solid --border`, pill radius, padding 10px, DM Sans 500 13px `--ink-60`
- "Submit Reel →" button: flex 2, `--ink` bg, `--shell` text, pill radius, padding 10px, DM Sans 600 13px

**Release behaviour:**
Confirm dialog → on confirm, card fades out (opacity 0, scale 0.97, transition 0.22s) → remove from DOM → show toast "Released back into the pool"

### Toast

- Position: fixed bottom ~90px, centred
- `--ink` background, `--shell` text, pill radius, DM Sans 500 12px
- Animate in (translateY 0, opacity 1), auto-dismiss after 2.2s

### Done when

- Each claim renders with correct Corben title
- QR code displays correctly
- Timer pill colour logic works (terra vs muted)
- Release flow works with toast confirmation
- Submit Reel button wired to existing submission logic
- Sticky header works correctly

-----

## Chunk 6 — All Offers screen

### Goal

Redesign the all offers list to match the prototype.

### Header

Same sticky pattern as Claims screen.

- "All offers" in Corben Regular 26px
- Subtitle: "{n} live this week · {city}" in DM Sans 400 12px `--ink-35`

### Offer rows

Each offer is a row: `--card` background, `1px solid --border`, border-radius 16px, padding 12px 13px, flex row, gap 12px.

**Icon (left):**

- 44px square, border-radius 11px, overflow hidden
- If business has uploaded photo: `<img>` object-fit cover
- Fallback: category gradient background with emoji centred, font-size 21px

**Info (centre, flex 1):**

- Offer title: DM Sans 500 13px `--ink`, letter-spacing -0.2px, margin-bottom 1px
- Business name + distance: DM Sans 400 11px `--ink-60`

**Right column (margin-left auto):**

- Slot badge (pill, DM Sans 600 10px):
  - 3+ slots: `--shell` bg, `--ink-60` text, `1px solid --border`
  - 1–2 slots: `--terra` bg, `--shell` text
  - 0 slots: transparent bg, `--ink-35` text, `1px solid --border`, label "Full"
- If creator has claimed this offer: "Claimed ✓" in DM Sans 500 10px `--terra` below the badge

### Done when

- All live offers render from real Supabase data
- Photo thumbnails show where available, gradient fallback otherwise
- Slot badge logic correct (terra / muted / full)
- Claimed status shows correctly per creator

-----

## Chunk 7 — Cleanup

### Goal

Remove dead code cleanly. No commented-out blocks, no unused components, no orphaned styles.

### Remove entirely

These features are removed for the pilot. Delete cleanly:

- Saved / wishlist screen and nav item
- Leaderboard component and any data fetching for it
- Streak warning banner component
- Category filter tabs on explore
- Search bar on explore
- Level badge and progress bar on explore
- "New this week" section
- "Near you" horizontal scroll section
- Your passes horizontal slider on explore (replaced by active claim bar in Chunk 4)
- Any CSS variables or Tailwind classes that are now unused

### Preserve — do not touch

- All Supabase data fetching and real-time subscriptions
- All auth flows (login, signup, session handling)
- QR code generation and scan confirmation logic
- Reel URL submission flow
- Claim creation, release, and status updates
- All TypeScript types and interfaces
- All environment variables
- The entire business portal — do not touch any business-facing screens or components

### Profile screen

Keep the route but replace the screen content with a simple placeholder:

- `--shell` background
- "Profile" in Corben Regular centred
- "Coming soon" in DM Sans 400 `--ink-60` centred below
- No other content

### Done when

- App builds with zero errors and zero TypeScript errors
- No dead imports anywhere
- No unused CSS variables
- No commented-out code blocks
- Business portal completely unaffected
- All preserved functionality still works end to end

-----

## Session instructions

Start every Claude Code session with this exact prompt:

> Read `DESIGN_SPEC.md` and `/nayba-v7.html` first.
> Complete **Chunk [N]** only. Do not start any other chunk.
> When Chunk [N] is fully complete, mark it ✅ in the progress table in `DESIGN_SPEC.md`.
> Leave everything outside Chunk [N] completely untouched.
> When done, give me a one-paragraph summary of what you changed and list any inline comments you left for review.
