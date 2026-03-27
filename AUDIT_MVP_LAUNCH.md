# NAYBA MVP LAUNCH AUDIT

**Date:** 2026-03-27
**Status:** Report only — no fixes applied

---

## 1. HARDCODED VALUES

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 1.1 | `supabase/functions/send-email/index.ts:8` | `ADMIN_EMAIL = 'hello@nayba.app'` hardcoded — not configurable via env | Admin notifications go to wrong address if email changes | **BLOCKER** |
| 1.2 | `supabase/functions/send-email/index.ts:9` | `APP_URL = 'https://nayba.vercel.app'` hardcoded | All email links break if domain changes or on staging | **BLOCKER** |
| 1.3 | `supabase/functions/send-email/index.ts:7` | `FROM_EMAIL = 'Nayba <hello@nayba.app>'` hardcoded | Cannot change sender address without code deploy | **HIGH** |
| 1.4 | `supabase/migrations/20260318150000_update_admin_email.sql` (all policies) | RLS admin policies hardcode `'hello@nayba.app'` — changing admin email requires a new migration | Admin locked to a single email at the DB layer | **BLOCKER** |
| 1.5 | `.env.example:6` | Default admin email still reads `admin@juicecreators.com` — contradicts the migration that changed it to `hello@nayba.app` | Confusing for anyone setting up the project | **MEDIUM** |
| 1.6 | `src/contexts/AuthContext.tsx:57` | Demo admin profile hardcodes `email: 'hello@nayba.app'` | Minor — demo only, but leaks real admin email | **LOW** |
| 1.7 | `supabase/functions/seed-test-users/index.ts:19-112` | 8 test users with `password: 'password123'` and real-looking emails | Must never run in production | **MEDIUM** |
| 1.8 | `src/lib/notifications.ts:109,165,196` | Placeholder UUID `00000000-0000-0000-0000-000000000000` used for admin notification `userId` | Could conflict with FK constraints | **MEDIUM** |

---

## 2. MISSING ENVIRONMENT VARIABLES

| # | Variable | Where referenced | Issue | Priority |
|---|----------|-----------------|-------|----------|
| 2.1 | `RESEND_API_KEY` | `supabase/functions/send-email/index.ts:533` | Required for all email sending — **not documented** in `.env.example` | **BLOCKER** |
| 2.2 | `APP_URL` | `supabase/functions/send-email/index.ts:9` | Hardcoded instead of reading from `Deno.env` — no env var exists | **HIGH** |
| 2.3 | `VITE_GOOGLE_MAPS_API_KEY` | `.env.example:9` | Documented but **never referenced** in any source file — dead config | **LOW** |
| 2.4 | `SUPABASE_SERVICE_ROLE_KEY` | `send-email/index.ts:443`, `check-overdue-reels/index.ts:16` | Auto-set by Supabase but undocumented in `.env.example` — confusing for local dev | **LOW** |

---

## 3. SECURITY ISSUES

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 3.1 | `supabase/migrations/20260315100000_create_waitlist_table.sql:15,19,23` | Waitlist RLS uses `auth.uid()` while rest of codebase uses `auth.jwt()->>'email'` — `creator_id` is a table PK, not the auth UID, so policies likely **never match** | Waitlist feature silently broken | **BLOCKER** |
| 3.2 | `supabase/migrations/20260318140000_add_email_type_and_feedback.sql:21-23` | Feedback INSERT policy is `WITH CHECK (true)` — any authenticated user can insert feedback with **any** `user_id` | Spoofed feedback possible | **MEDIUM** |
| 3.3 | `src/contexts/AuthContext.tsx:61-67` | Demo mode grants full admin access via `?demo=admin` URL param when `VITE_ENABLE_DEMO=true` | If accidentally enabled in prod, anyone gets admin | **HIGH** |
| 3.4 | `vite.config.ts` | `sourcemap: true` in production build | Exposes full source code to anyone who opens DevTools | **MEDIUM** |
| 3.5 | `index.html` | No `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options` headers | Clickjacking and XSS injection surface | **MEDIUM** |

---

## 4. BROKEN FEATURES

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 4.1 | `src/components/Auth.tsx:106` | Password reset sends email with `redirectTo: '…/reset-password'` but **no route handler exists** — App.tsx has no path matching, no component renders | Users **cannot reset passwords** | **BLOCKER** |
| 4.2 | `src/contexts/AuthContext.tsx` (15+ lines) | 15 `console.log` statements leaking auth flow details (`Admin detected`, `Creator INSERT payload: …`, user IDs) | Exposes internal state in production browser console | **HIGH** |
| 4.3 | `src/components/AdminDashboard.tsx:151,168,179,213,216,231,312,327,394` | Raw `error.message` strings displayed directly in UI | Users see Supabase/Postgres error internals | **HIGH** |
| 4.4 | `src/components/Auth.tsx:111,132` | Raw `error.message` shown on login/signup failure | Leaks backend details (e.g., "duplicate key violates unique constraint") | **HIGH** |
| 4.5 | `src/components/CreatorApp.tsx:551,617,643` | Raw `error.message` set into state and displayed | Same as above | **HIGH** |
| 4.6 | `src/components/BusinessPortal.tsx:1195,1205,1224,1249` | Raw `error.message` shown for offer create/update failures | Same as above | **HIGH** |
| 4.7 | `src/components/DisputeModal.tsx:36` | Raw `error.message` displayed | Same as above | **MEDIUM** |
| 4.8 | `src/components/CreatorOnboarding.tsx:91,140` | `console.error` for avatar upload and skip — skip failure shows no feedback to user | Silent failure on onboarding skip | **MEDIUM** |

---

## 5. INCOMPLETE FLOWS

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 5.1 | `src/components/Auth.tsx:106` + `src/App.tsx` | Password reset email links to `/reset-password` — **page does not exist** in the SPA | Account recovery completely broken | **BLOCKER** |
| 5.2 | `src/components/CreatorApp.tsx:683-688, 2367-2375` | Pending-approval creators are force-routed to profile showing "Account Under Review" — no refresh/poll, no estimated timeline, no way to check if approved | Dead-end screen; creators must manually reload to discover approval | **HIGH** |
| 5.3 | `src/components/BusinessPortal.tsx:1320-1323` | Same dead-end for pending-approval businesses — tabs disabled, no status update mechanism | Businesses stuck in limbo | **HIGH** |
| 5.4 | `src/components/BusinessOnboarding.tsx:58-60, 103-108` | "Finish Later" saves current step but resume logic does not validate step bounds — fragile if schema changes | Could show blank or wrong onboarding step | **MEDIUM** |
| 5.5 | `src/components/Auth.tsx:688` | "By signing up you agree to our terms" — but **no link**, no terms page, no checkbox | Consent not actually captured | **BLOCKER** (see §6) |

---

## 6. MISSING LEGAL / COMPLIANCE

| # | Issue | What's missing | Launch impact | Priority |
|---|-------|---------------|---------------|----------|
| 6.1 | **Terms of Service** | No ToS page, no ToS document, no link anywhere. `Auth.tsx:688` references "our terms" as plain text with no link | Cannot legally operate — no liability protection | **BLOCKER** |
| 6.2 | **Privacy Policy** | No privacy policy page or document anywhere in codebase | GDPR/UK-GDPR violation — cannot collect personal data (email, name, DOB, Instagram, location) without disclosure | **BLOCKER** |
| 6.3 | **Cookie / Storage consent** | No consent banner. App uses `localStorage` extensively (`nayba_saved_offers`, `nayba_login_attempts`, `nayba_lockout_until`) | UK PECR / ePrivacy violation | **HIGH** |
| 6.4 | **Age verification** | `Auth.tsx:627` requires DOB but **performs no age check** — no minimum age validation | Under-13 users can sign up (COPPA), under-16 without parental consent (GDPR Art. 8) | **HIGH** |
| 6.5 | **Account deletion** | No "delete my account" UI or API endpoint anywhere | GDPR Art. 17 right to erasure not supported | **HIGH** |
| 6.6 | **Data export** | No "export my data" feature | GDPR Art. 20 data portability not supported | **MEDIUM** |
| 6.7 | **Email opt-in** | No explicit consent checkbox for marketing/notification emails | Could violate CAN-SPAM / PECR | **MEDIUM** |

---

## 7. BUSINESS LOGIC GAPS

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 7.1 | `src/components/Auth.tsx:59-149` | Business self-registration is fully open — anyone can sign up as a business | For a manual-onboarding pilot this creates unvetted supply; spam signups possible | **HIGH** |
| 7.2 | `src/components/Auth.tsx:472-474, 550-552` | Three locations (Ipswich, Norwich, Cambridge) show as "coming soon — DISABLED" in signup dropdowns | Acceptable if intentional, but confusing UX — users see options they can't use | **LOW** |
| 7.3 | `src/contexts/AuthContext.tsx:17` | `ADMIN_EMAIL` fallback is `'hello@nayba.app'` but `.env.example` says `admin@juicecreators.com` — conflicting defaults | Which email is the real admin? Misconfigured deploys grant admin to wrong person | **HIGH** |
| 7.4 | `supabase/functions/seed-test-users/index.ts` (entire file) | Seed function creates test creators, businesses, offers, and an admin — no guard against running in production | If triggered in prod, creates fake data mixed with real users | **MEDIUM** |

---

## 8. PERFORMANCE / MOBILE

| # | File : Line | Issue | Launch impact | Priority |
|---|------------|-------|---------------|----------|
| 8.1 | `src/components/CreatorApp.tsx` (2,943 lines), `BusinessPortal.tsx` (2,654 lines), `AdminDashboard.tsx` (1,351 lines) | Monolithic components — no code splitting, no `React.lazy`, no `Suspense` | Entire app downloaded on first load even if user only needs one tab; slow on 3G | **HIGH** |
| 8.2 | Entire codebase | Zero usage of `React.memo`, `useMemo`, or `useCallback` | Every state change re-renders all children — laggy on mid-range phones | **HIGH** |
| 8.3 | `public/nayba_logo.svg` | **126 KB** SVG logo — extremely oversized | Blocks first paint on slow connections | **HIGH** |
| 8.4 | `src/components/CreatorApp.tsx:2394-2407, 1855-1860` + `BusinessPortal.tsx:1650` | All `<img>` tags missing `loading="lazy"` and `width`/`height` attributes | Layout shift (CLS) and unnecessary network requests for off-screen images | **MEDIUM** |
| 8.5 | `vite.config.ts` | Only `react` + `react-dom` in `manualChunks` — `leaflet` (~200KB), `html5-qrcode` (~50KB) not split | Large libs bundled into main chunk even if user never opens map or QR scanner | **MEDIUM** |
| 8.6 | `index.html:11` | 5 font weights of Plus Jakarta Sans + Corben loaded synchronously on every page | Render-blocking; Corben only used in one wordmark component | **MEDIUM** |
| 8.7 | `src/components/AdminDashboard.tsx:94` | `fetchAll()` on mount loads up to 500 each of creators, businesses, offers, claims with no pagination | Admin dashboard hangs with large datasets | **MEDIUM** |
| 8.8 | `src/App.tsx:10-53` | Single `ErrorBoundary` at app root — crash in one tab takes down entire app | No graceful degradation per feature | **LOW** |
| 8.9 | No `manifest.json` or service worker | No PWA support — no installability, no offline fallback | Not a blocker but missed mobile engagement opportunity | **LOW** |

---

## SUMMARY

| Priority | Count | Key items |
|----------|-------|-----------|
| **BLOCKER** | 7 | Password reset broken, no Terms of Service, no Privacy Policy, RLS admin email hardcoded, waitlist RLS broken, RESEND_API_KEY undocumented, APP_URL hardcoded in emails |
| **HIGH** | 14 | Raw errors shown to users, console.log leak, no age verification, no account deletion, no cookie consent, business signup open for pilot, pending-approval dead-ends, no code splitting, unoptimised 126KB SVG, admin email mismatch between config and code |
| **MEDIUM** | 13 | Sourcemaps in prod, feedback RLS too permissive, missing CSP headers, onboarding resume fragile, data export missing, font loading, admin pagination, seed function unguarded |
| **LOW** | 5 | Unused Google Maps env var, demo email leak, disabled town labels, PWA missing, single error boundary |

**Total issues found: 39**
