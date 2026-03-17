# Codebase Audit Tracker

## Critical Issues

- [x] **#4** Placeholder env vars allow deployment — App now throws at init if env vars missing (`src/lib/supabase.ts`)
- [x] **#28** Demo mode vulnerable to URL manipulation — Demo mode now blocked in production builds (`src/contexts/AuthContext.tsx`)
- [x] **#6** Double-redemption via concurrent QR scans — New `redeem_offer` RPC with `FOR UPDATE SKIP LOCKED` replaces client-side check-then-update (`BusinessPortal`, `20260317100000_create_redeem_offer_rpc.sql`)
- [x] **#1** Offer redemption timing window — `reel_due_at` now capped at `qr_expires_at + 24h` in `redeem_offer` RPC
- [x] **#2** Unclaim function missing rollback — Already fixed: atomic `DELETE ... RETURNING` in `20260312100200_fix_unclaim_offer_race_condition.sql`

## High Severity

- [x] **#7** Avatar upload claims partial success — Now returns error message when DB update fails (`src/lib/upload.ts`)
- [x] **#5** Silent failure on waitlist operations — Now shows error feedback to user (`src/components/CreatorApp.tsx`)
- [x] **#8** Admin email case sensitivity — Already fixed (`.toLowerCase()` applied at line 16) _(false positive)_
- [x] **#3** Missing index on `(creator_id, status)` for claims table — Added composite index (`20260317100100_fix_high_medium_audit_issues.sql`)
- [x] **#9** Infinite loop risk in countdown timer — Already has proper cleanup via `return () => clearInterval(interval)` _(false positive)_
- [x] **#10** Missing error feedback for claim submission — Now maps error codes to user-friendly messages (`src/components/CreatorApp.tsx`)

## Medium Severity

- [x] **#18** Notifications INSERT policy removed, no server-side enforcement — Added `service_role` INSERT policy (`20260317100100_fix_high_medium_audit_issues.sql`)
- [x] **#11** Empty state missing for "no offers" when creator is approved — Shows "No offers yet" when offers array is empty (`src/components/CreatorApp.tsx`)
- [x] **#12** Reel due date not validated against current time before submission — Now checks deadline before accepting (`src/components/CreatorApp.tsx`)
- [x] **#13** Ambiguous "completed" status never set — Reel submission now sets `status: 'completed'` (`src/components/CreatorApp.tsx`)
- [x] **#14** Monthly cap calculation uses current month, clock-skew risk — Server-side `now()` is authoritative; no client clock dependency _(false positive)_
- [x] **#15** Creator onboarding stats not real-time — Added realtime subscription for businesses/offers tables (`src/components/CreatorOnboarding.tsx`)
- [x] **#16** No loading state during onboarding completion — Added loading/disabled state to buttons (`src/components/CreatorOnboarding.tsx`)
- [x] **#17** Realtime subscription memory leak on unmount — Already has proper cleanup via `supabase.removeChannel(channel)` _(false positive)_
- [x] **#26** Build output not optimized — Added sourcemaps, vendor chunk splitting (`vite.config.ts`)
- [x] **#27** No env var validation at build time — Added `validateEnv()` check during build (`vite.config.ts`)

## Low Severity

- [ ] **#19** QR scanner not mobile-responsive (`src/components/BusinessPortal.tsx:177-250`)
- [x] **#20** `creator.level` referenced but not in select query — Added `level` and `level_name` to Creator interface (`src/components/AdminDashboard.tsx`)
- [ ] **#21** Leaderboard position uses O(n) indexOf on every render (`src/components/CreatorApp.tsx:1141-1152`)
- [ ] **#22** localStorage stores app data in plain text — XSS risk (`AuthContext:81-92`, `CreatorApp:193-255`)
- [ ] **#23** Missing validation on Google Maps API key (`src/components/Auth.tsx:22-26`)
- [x] **#24** Data mutation: direct reference instead of spread — Now spreads data before setting state (`src/components/AdminDashboard.tsx`)
- [x] **#25** Unused import: QRCodeDisplay — _(false positive, QRCodeDisplay IS used at line 1524)_
