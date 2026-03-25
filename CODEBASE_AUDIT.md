# Codebase Audit — juice-creators (nayba)

**Stack:** Vite + React 18 + TypeScript, Tailwind CSS 3, Supabase, Leaflet maps

---

## 1. Routes & Pages

This is a **single-page app with state-based routing** (no React Router). `App.tsx` conditionally renders based on auth state and user role:

| View | Component | File | Internal Views |
|------|-----------|------|----------------|
| **Auth** | `Auth` | `src/components/Auth.tsx` | Sign-in, Sign-up (3-step creator, 3-step business), Password reset, Role selection |
| **Creator Dashboard** | `CreatorApp` | `src/components/CreatorApp.tsx` | `offers` (discovery feed), `saved`, `active`, `claims`, `all_offers`, `profile` (main/edit/alerts) |
| **Business Dashboard** | `BusinessPortal` | `src/components/BusinessPortal.tsx` | `home`, `offers`, `claims`, `scan` (QR), `notifications`, `profile` (main/edit) |
| **Admin Panel** | `AdminDashboard` | `src/components/AdminDashboard.tsx` | `stats`, `creators`, `businesses`, `offers`, `claims`, `settings` |

**Special states in App.tsx:** Error boundary, Demo banner (`?demo=`), Redeem landing (`?redeem=`), Loading screen, Account-not-found fallback.

---

## 2. All Components

| Component | File | Pattern |
|-----------|------|---------|
| `Auth` | `src/components/Auth.tsx` | Full-page auth flow (includes `AddressAutocomplete`, `FloatingInput`) |
| `CreatorApp` | `src/components/CreatorApp.tsx` | Dashboard (includes `StatusPill`, `FlameIcon`, `useCountdown`) |
| `BusinessPortal` | `src/components/BusinessPortal.tsx` | Dashboard (includes `QRScanner`, `OfferBuilder`) |
| `AdminDashboard` | `src/components/AdminDashboard.tsx` | Dashboard (includes `StatusPill`) |
| `CreatorOnboarding` | `src/components/CreatorOnboarding.tsx` | 4-screen wizard modal |
| `BusinessOnboarding` | `src/components/BusinessOnboarding.tsx` | 5-screen wizard modal |
| `DiscoveryMap` | `src/components/DiscoveryMap.tsx` | Leaflet map with business markers |
| `QRCodeDisplay` | `src/components/QRCodeDisplay.tsx` | QR generator with Reed-Solomon ECC |
| `DisputeModal` | `src/components/DisputeModal.tsx` | Modal form for claim disputes |
| `FeedbackButton` | `src/components/FeedbackButton.tsx` | Floating action button + bottom sheet |
| `Logo` | `src/components/Logo.tsx` | Brand logo (variants: icon, wordmark, icon-word) |
| `LevelBadge` | `src/components/LevelBadge.tsx` | Creator level badge (sm/md/lg) |
| `DoodleIcon` | `src/lib/doodle-icons.tsx` | Icon wrapper (100+ icons from doodle-icons lib) |
| `CategoryIcon` | `src/lib/categories.tsx` | Category-specific icons with color |

**Lib files:** `supabase.ts`, `avatar.ts`, `upload.ts`, `notifications.ts`, `levels.ts`, `categories.tsx`

**Context:** `AuthContext.tsx` — auth provider wrapping the app

**Supabase edge functions:** `check-overdue-reels`, `send-email`, `seed-test-users`

---

## 3. Color Tokens (`src/styles/theme.css`)

### Core Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--shell` | `#F8F6F1` | Page background |
| `--card` | `#F0ECE4` | Card/elevated surfaces |
| `--border` | `#E4DDD4` | Borders |
| `--ink` | `#28201A` | Primary text |
| `--terra` | `#C4674A` | Primary accent (buttons, links) |
| `--forest` | `#1A4A2E` | Dark green |
| `--ochre` | `#E8A020` | Golden/warning |
| `--sage` | `#E8EEE7` | Soft green bg |
| `--dusty-blue` | `#E4EAED` | Soft blue bg |
| `--peach` | `#F2E8E0` | Soft peach bg |
| `--butter` | `#EDE8D0` | Warm cream bg |

### Ink Opacity Scale

| Token | Value |
|-------|-------|
| `--ink-60` | `rgba(40,32,26,0.60)` |
| `--ink-35` | `rgba(40,32,26,0.35)` |
| `--ink-15` | `rgba(40,32,26,0.15)` |
| `--ink-08` | `rgba(40,32,26,0.08)` |

### Terra Opacity Scale

| Token | Value |
|-------|-------|
| `--terra-5` | `rgba(196,103,74,0.05)` |
| `--terra-10` | `rgba(196,103,74,0.10)` |
| `--terra-15` | `rgba(196,103,74,0.15)` |
| `--terra-20` | `rgba(196,103,74,0.20)` |
| `--terra-40` | `rgba(196,103,74,0.40)` |
| `--terra-hover` | `#A8573E` |
| `--terra-ring` | `rgba(196,103,74,0.30)` |

### Category Gradients

| Token | Value |
|-------|-------|
| `--grad-food` | `linear-gradient(160deg, #C07858, #9A5C40)` |
| `--grad-beauty` | `linear-gradient(160deg, #5A9470, #3E7254)` |
| `--grad-cafe` | `linear-gradient(160deg, #C09840, #8C6E20)` |
| `--grad-wellness` | `linear-gradient(160deg, #6A8EAE, #4A6E8E)` |
| `--grad-experience` | `linear-gradient(160deg, #9068A8, #6A4880)` |

### Category Flat Colors (for card zones)

| Token | Value | Description |
|-------|-------|-------------|
| `--cat-food` | `#D4897A` | Dusted rose |
| `--cat-beauty` | `#7AAE8C` | Faded sage |
| `--cat-cafe` | `#C9A96E` | Warm straw |
| `--cat-wellness` | `#7A9EBE` | Washed blue |
| `--cat-fitness` | `#A888BE` | Dusty lilac |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(40,32,26,0.05)` |
| `--shadow-md` | `0 2px 12px rgba(40,32,26,0.06)` |
| `--shadow-lg` | `0 4px 16px rgba(40,32,26,0.10)` |

### Border Radii

| Token | Value |
|-------|-------|
| `--r-card` | `20px` |
| `--r-pill` | `999px` |

### Legacy Aliases (backward compatibility)

| Alias | Maps To |
|-------|---------|
| `--white` | `var(--shell)` |
| `--bg` | `var(--shell)` |
| `--elevated` | `var(--card)` |
| `--pressed` | `var(--border)` |
| `--near-black` | `var(--ink)` |
| `--mid` | `var(--ink-60)` |
| `--soft` | `var(--ink-35)` |
| `--faint` | `var(--ink-08)` |
| `--warm-mid-grey` | `var(--ink-35)` |
| `--card-bg` | `var(--card)` |
| `--card-border` | `var(--border)` |

---

## 4. Typography

### Fonts (loaded via Google Fonts CDN in `index.html`)

- **Display:** `Corben`, serif (weight 400 only) — headings, screen titles, offer card titles
- **Body:** `DM Sans`, sans-serif (weights 300–700) — everything else

### Tailwind Config

```js
fontFamily: {
  display: ['Corben', 'serif'],
  sans: ['DM Sans', 'sans-serif'],
}
```

### Base Styles (theme.css)

- `h1–h5`: Corben 400, letter-spacing `-0.025em`
- `body/p/span/button/input`: DM Sans, 17px, 400 weight, `color: var(--ink)`

### Size Range Used Across Components

10px–28px (per DESIGN_SPEC.md)

---

## 5. Component Patterns

### Cards

- `border-radius: 20px` (small cards: `14px`)
- `background: var(--card)`
- `box-shadow: var(--shadow-md)`
- `border: 1.5px solid var(--border)`

### Buttons

- Pill-shaped (`border-radius: 999px`)
- Primary fill: `var(--terra)` with hover `var(--terra-hover)`
- Focus ring: `var(--terra-ring)`
- Text sizes vary: 10–15px

### Navigation

- Tab-based within each dashboard
- State-driven view switching via `setView()`
- Bottom nav in creator, top tabs in business/admin

### Forms

- Floating label inputs (`FloatingInput` sub-component in Auth)
- Height ~52px
- Font: DM Sans

### Modals/Overlays

- Full-screen overlays for onboarding wizards, QR display, dispute forms
- Slide animations

### Toasts/Notifications

- Success states rendered inline within modals

### Scrollbar

- Custom 6px thin scrollbar
- Thumb: `var(--ink-35)`

---

## 6. Category Color System (`src/lib/categories.tsx`)

### Tailwind Color Classes

| Category | Class |
|----------|-------|
| Food & Drink | `bg-orange-500` |
| Hair & Beauty | `bg-pink-500` |
| Health & Fitness | `bg-green-500` |
| Retail | `bg-blue-500` |
| Cafe & Coffee | `bg-amber-500` |
| Arts & Entertainment | `bg-purple-500` |
| Wellness & Spa | `bg-teal-500` |
| Pets | `bg-yellow-500` |
| Education | `bg-indigo-500` |
| Services | `bg-gray-500` |

### Solid Dark Colors (for overlays)

| Category | Color |
|----------|-------|
| Food & Drink | `#3D2314` |
| Cafe & Coffee | `#2E1A0A` |
| Hair & Beauty | `#2D1F2E` |
| Wellness & Spa | `#1A2E2A` |
| Health & Fitness | `#0F1F2E` |
| Retail | `#1A1F3A` |
| Arts & Entertainment | `#2A1F2E` |
| Education | `#0F2318` |
| Pets | `#2A1A0F` |
| Services | `#2C2420` |

### Pastel Background Colors

| Category | Color |
|----------|-------|
| Food & Drink | `#EDE8D0` |
| Cafe & Coffee | `#F0E4D0` |
| Hair & Beauty | `#EDD4D4` |
| Wellness & Spa | `#D0E8E4` |
| Health & Fitness | `#D4E0ED` |
| Retail | `#D4D8ED` |
| Arts & Entertainment | `#E8D8ED` |
| Education | `#D4E8D0` |
| Pets | `#F0E6D4` |
| Services | `#EDE8DC` |

### Pastel Icon Colors

| Category | Color |
|----------|-------|
| Food & Drink | `#9E7A5A` |
| Cafe & Coffee | `#8A6842` |
| Hair & Beauty | `#A06A82` |
| Wellness & Spa | `#5A8A82` |
| Health & Fitness | `#5A8A72` |
| Retail | `#5A6A8E` |
| Arts & Entertainment | `#8A6A9E` |
| Education | `#4A7A5E` |
| Pets | `#8E7244` |
| Services | `#6E6A62` |

---

## 7. Design System Files

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Extended theme (fonts, colors, radii, border widths) |
| `src/styles/theme.css` | All CSS custom properties + base `@layer` styles |
| `src/styles/fonts.css` | Font documentation (actual loading in index.html) |
| `src/index.css` | Global resets, scrollbar, imports theme.css |
| `src/lib/categories.tsx` | Category color maps (Tailwind classes, solid, pastel, icon colors) |
| `DESIGN_SPEC.md` | Full design specification document |
| `postcss.config.js` | PostCSS + Tailwind + Autoprefixer |

---

## 8. Key Observations

- **No React Router** — all navigation is state-driven within monolithic page components
- **Large monolithic components** — `CreatorApp.tsx`, `BusinessPortal.tsx`, and `Auth.tsx` contain all their sub-views inline rather than split into separate files
- **Styling approach:** Tailwind utility classes + CSS custom properties (no CSS modules, no styled-components)
- **No custom breakpoints** — using Tailwind defaults, mobile-first
- **Category system** has 4 separate color mappings (Tailwind classes, solid dark, pastel bg, pastel icon) spread across `theme.css` and `categories.tsx`
- **Legacy color aliases** suggest the design system was recently refactored from an older naming convention
