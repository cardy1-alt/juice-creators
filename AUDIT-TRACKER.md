# Codebase Audit Tracker

## Critical Issues

- [ ] **#4** Placeholder env vars allow deployment — App loads with fake Supabase URL/key, silent failures (`src/lib/supabase.ts:3-4`, `src/main.tsx:8-12`)
- [ ] **#28** Demo mode vulnerable to URL manipulation — `?demo=admin` bypasses auth (`src/contexts/AuthContext.tsx:58-64`)
- [ ] **#6** Double-redemption via concurrent QR scans — No atomic check-then-update on redemption (`BusinessPortal`)
- [ ] **#1** Offer redemption timing window — reel_due_at can extend beyond qr_expires_at (`claim_offer()` RPC)
- [ ] **#2** Unclaim function missing rollback — Partial state corruption if post-deletion ops fail (`unclaim_offer()` RPC)

## High Severity

- [ ] **#7** Avatar upload claims partial success — Storage succeeds but DB update fails silently (`src/lib/upload.ts:45-47`)
- [ ] **#5** Silent failure on waitlist operations — No user feedback on join/leave errors (`src/components/CreatorApp.tsx:305-325`)
- [ ] **#8** Admin email case sensitivity — AuthContext doesn't lowercase, RLS policies do (`AuthContext:16`)
- [ ] **#3** Missing index on `(creator_id, status)` for claims table
- [ ] **#9** Infinite loop risk in countdown timer — Intervals stack on multiple claims (`src/components/CreatorApp.tsx:15-44`)
- [ ] **#10** Missing error feedback for claim submission — Vague errors, no guidance (`src/components/CreatorApp.tsx:452-475`)

## Medium Severity

- [ ] **#18** Notifications INSERT policy removed, no server-side enforcement (migrations line 1305)
- [ ] **#11** Empty state missing for "no offers" when creator is approved (`src/components/CreatorApp.tsx:1193-1199`)
- [ ] **#12** Reel due date not validated against current time before submission (`src/components/CreatorApp.tsx:484-528`)
- [ ] **#13** Ambiguous "completed" status never set — dead code path (`CreatorApp StatusPill`)
- [ ] **#14** Monthly cap calculation uses current month, clock-skew risk (`claim_offer()` RPC)
- [ ] **#15** Creator onboarding stats not real-time (`src/components/CreatorOnboarding.tsx:19-31`)
- [ ] **#16** No loading state during onboarding completion (`src/components/CreatorOnboarding.tsx:34-45`)
- [ ] **#17** Realtime subscription memory leak on unmount (`src/components/AdminDashboard.tsx:56-65`)
- [ ] **#26** Build output not optimized — no minify/sourcemap/splitChunks config (`vite.config.ts:7-9`)
- [ ] **#27** No env var validation at build time

## Low Severity

- [ ] **#19** QR scanner not mobile-responsive (`src/components/BusinessPortal.tsx:177-250`)
- [ ] **#20** `creator.level` referenced but not in select query (`src/components/AdminDashboard.tsx:314`)
- [ ] **#21** Leaderboard position uses O(n) indexOf on every render (`src/components/CreatorApp.tsx:1141-1152`)
- [ ] **#22** localStorage stores app data in plain text — XSS risk (`AuthContext:81-92`, `CreatorApp:193-255`)
- [ ] **#23** Missing validation on Google Maps API key (`src/components/Auth.tsx:22-26`)
- [ ] **#24** Data mutation: direct reference instead of spread (`src/components/AdminDashboard.tsx:82-84`)
- [ ] **#25** Unused import: QRCodeDisplay (`src/components/CreatorApp.tsx:5`)
