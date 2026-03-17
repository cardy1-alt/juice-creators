# Codebase Audit Tracker

## Critical Issues

- [x] **#4** Placeholder env vars allow deployment — App now throws at init if env vars missing (`src/lib/supabase.ts`)
- [x] **#28** Demo mode vulnerable to URL manipulation — Demo mode now blocked in production builds (`src/contexts/AuthContext.tsx`)
- [ ] **#6** Double-redemption via concurrent QR scans — No atomic check-then-update on redemption (`BusinessPortal`)
- [ ] **#1** Offer redemption timing window — reel_due_at can extend beyond qr_expires_at (`claim_offer()` RPC)
- [ ] **#2** Unclaim function missing rollback — Partial state corruption if post-deletion ops fail (`unclaim_offer()` RPC)

## High Severity

- [x] **#7** Avatar upload claims partial success — Now returns error message when DB update fails (`src/lib/upload.ts`)
- [x] **#5** Silent failure on waitlist operations — Now shows error feedback to user (`src/components/CreatorApp.tsx`)
- [x] **#8** Admin email case sensitivity — Already fixed (`.toLowerCase()` applied at line 16) _(false positive)_
- [ ] **#3** Missing index on `(creator_id, status)` for claims table
- [x] **#9** Infinite loop risk in countdown timer — Already has proper cleanup via `return () => clearInterval(interval)` _(false positive)_
- [x] **#10** Missing error feedback for claim submission — Now maps error codes to user-friendly messages (`src/components/CreatorApp.tsx`)

## Medium Severity

- [ ] **#18** Notifications INSERT policy removed, no server-side enforcement (migrations line 1305)
- [ ] **#11** Empty state missing for "no offers" when creator is approved (`src/components/CreatorApp.tsx:1193-1199`)
- [x] **#12** Reel due date not validated against current time before submission — Now checks deadline before accepting (`src/components/CreatorApp.tsx`)
- [ ] **#13** Ambiguous "completed" status never set — dead code path (`CreatorApp StatusPill`)
- [ ] **#14** Monthly cap calculation uses current month, clock-skew risk (`claim_offer()` RPC)
- [ ] **#15** Creator onboarding stats not real-time (`src/components/CreatorOnboarding.tsx:19-31`)
- [x] **#16** No loading state during onboarding completion — Added loading/disabled state to buttons (`src/components/CreatorOnboarding.tsx`)
- [ ] **#17** Realtime subscription memory leak on unmount (`src/components/AdminDashboard.tsx:56-65`)
- [ ] **#26** Build output not optimized — no minify/sourcemap/splitChunks config (`vite.config.ts:7-9`)
- [ ] **#27** No env var validation at build time

## Low Severity

- [ ] **#19** QR scanner not mobile-responsive (`src/components/BusinessPortal.tsx:177-250`)
- [x] **#20** `creator.level` referenced but not in select query — Added `level` and `level_name` to Creator interface (`src/components/AdminDashboard.tsx`)
- [ ] **#21** Leaderboard position uses O(n) indexOf on every render (`src/components/CreatorApp.tsx:1141-1152`)
- [ ] **#22** localStorage stores app data in plain text — XSS risk (`AuthContext:81-92`, `CreatorApp:193-255`)
- [ ] **#23** Missing validation on Google Maps API key (`src/components/Auth.tsx:22-26`)
- [x] **#24** Data mutation: direct reference instead of spread — Now spreads data before setting state (`src/components/AdminDashboard.tsx`)
- [x] **#25** Unused import: QRCodeDisplay — _(false positive, QRCodeDisplay IS used at line 1524)_
